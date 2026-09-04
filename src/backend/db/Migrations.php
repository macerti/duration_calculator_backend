<?php
/**
 * Database Migration Framework
 *
 * Manages versioned schema migrations with idempotent application.
 * Each migration is atomic (single transaction) and tracked in migrations_metadata table.
 *
 * Usage:
 *   $migrator = new Migrations($pdo);
 *   $result = $migrator->run(dirname(__FILE__) . '/migrations');
 *   if (!$result['success']) {
 *       error_log('Migration failed: ' . $result['error']);
 *   }
 */

namespace AuditEngine;

class Migrations {
    private \PDO $pdo;
    private string $metadataTable = 'migrations_metadata';

    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
        $this->ensureMetadataTable();
    }

    /**
     * Ensure the migrations_metadata table exists.
     * This must run first, before checking for applied migrations.
     */
    private function ensureMetadataTable(): void {
        $sql = <<<'SQL'
            CREATE TABLE IF NOT EXISTS migrations_metadata (
              id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              migration_name    VARCHAR(255)  NOT NULL UNIQUE,
              applied_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
              checksum          VARCHAR(64)   NULL,
              error_message     TEXT          NULL,
              status            VARCHAR(32)   NOT NULL DEFAULT 'success',
              KEY idx_migrations_applied_at (applied_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        SQL;
        
        try {
            $this->pdo->exec($sql);
        } catch (\Exception $e) {
            throw new \RuntimeException(
                'Failed to create migrations_metadata table: ' . $e->getMessage()
            );
        }
    }

    /**
     * Run all pending migrations in the specified directory.
     *
     * @param string $migrationsDir Path to migrations directory
     * @return array ['success' => bool, 'applied' => int, 'skipped' => int, 'error' => ?string]
     */
    public function run(string $migrationsDir): array {
        if (!is_dir($migrationsDir)) {
            return [
                'success' => false,
                'applied' => 0,
                'skipped' => 0,
                'error' => "Migrations directory not found: $migrationsDir"
            ];
        }

        $appliedCount = 0;
        $skippedCount = 0;
        $migrationFiles = $this->getMigrationFiles($migrationsDir);

        foreach ($migrationFiles as $file => $path) {
            try {
                $alreadyApplied = $this->isAlreadyApplied($file);
                
                if ($alreadyApplied) {
                    $skippedCount++;
                    continue;
                }

                $this->applyMigration($file, $path);
                $appliedCount++;
                
            } catch (\Exception $e) {
                // Record the failure in metadata for diagnostic purposes
                $this->recordMigrationError($file, $e->getMessage());
                
                return [
                    'success' => false,
                    'applied' => $appliedCount,
                    'skipped' => $skippedCount,
                    'error' => "Migration $file failed: " . $e->getMessage()
                ];
            }
        }

        return [
            'success' => true,
            'applied' => $appliedCount,
            'skipped' => $skippedCount,
            'error' => null
        ];
    }

    /**
     * Get all migration files, sorted alphabetically by name.
     * Only *.sql files are considered migrations.
     *
     * @param string $dir
     * @return array ['migration_name' => 'full_path', ...]
     */
    private function getMigrationFiles(string $dir): array {
        $files = [];
        
        if ($handle = opendir($dir)) {
            $entries = [];
            while (($entry = readdir($handle)) !== false) {
                if ($entry !== '.' && $entry !== '..' && str_ends_with($entry, '.sql')) {
                    $entries[] = $entry;
                }
            }
            closedir($handle);
            
            // Sort alphabetically — this determines execution order
            sort($entries);
            
            foreach ($entries as $entry) {
                $files[$entry] = $dir . '/' . $entry;
            }
        }
        
        return $files;
    }

    /**
     * Check if a migration has already been applied.
     *
     * @param string $migrationName
     * @return bool
     */
    private function isAlreadyApplied(string $migrationName): bool {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) as cnt FROM {$this->metadataTable} WHERE migration_name = ? AND status = 'success'"
        );
        $stmt->execute([$migrationName]);
        $result = $stmt->fetch(\PDO::FETCH_ASSOC);
        // Without this, the statement handle stays "active" on the
        // connection (no more rows were fetched to naturally close it),
        // and the very next query on this connection -- beginTransaction()'s
        // START TRANSACTION -- fails with MySQL error 2014 "unbuffered
        // queries are active" (BUG-042).
        $stmt->closeCursor();
        return ($result['cnt'] ?? 0) > 0;
    }

    /**
     * Apply a single migration atomically.
     *
     * @param string $migrationName
     * @param string $filePath
     * @throws \Exception
     */
    private function applyMigration(string $migrationName, string $filePath): void {
        $sql = file_get_contents($filePath);
        
        if ($sql === false) {
            throw new \RuntimeException("Failed to read migration file: $filePath");
        }

        // Calculate checksum for integrity tracking
        $checksum = hash('sha256', $sql);

        // IMPORTANT — MySQL/MariaDB DDL statements (CREATE TABLE, ALTER TABLE,
        // CREATE INDEX, etc.) each trigger an implicit COMMIT on the server,
        // silently ending whatever transaction beginTransaction() started.
        // PDO_MySQL tracks the *real* server transaction-status flag, so it
        // correctly notices this — which means calling commit()/rollBack()
        // again afterward throws "There is no active transaction" (this was
        // BUG-041). Guarding both calls with inTransaction() avoids the
        // crash. This also means: for DDL-heavy migrations (like this one),
        // beginTransaction()/commit() do NOT provide real all-or-nothing
        // atomicity — that is a hard MySQL/MariaDB limitation, not something
        // this framework can paper over. Safety instead comes from writing
        // every migration to be idempotent (IF NOT EXISTS / information_schema
        // guards), so a migration that fails partway through is safe to
        // re-run — the exact same pattern already used throughout
        // schema.sql. Migrations that are pure DML (INSERT/UPDATE/DELETE
        // only, no DDL) DO get real atomicity from this transaction wrapping.
        try {
            $this->pdo->beginTransaction();

            // Execute all statements in the migration file
            // Split on semicolons, but be careful of semicolons inside strings
            foreach ($this->splitSqlStatements($sql) as $statement) {
                $trimmed = trim($statement);
                if (empty($trimmed)) {
                    continue;
                }
                // Deliberately query()+closeCursor() instead of exec() here.
                // Migrations in this codebase use a PREPARE/EXECUTE/DEALLOCATE
                // idempotent-guard pattern (see migrations/README.md) whose
                // "nothing to do" branch EXECUTEs a dynamically-built no-op
                // statement. If that statement happens to return a result
                // set, PDO::exec() leaves it unconsumed and the connection
                // gets stuck: the *next* statement fails with MySQL error
                // 2014 "unbuffered queries are active" (BUG-043). query() +
                // closeCursor() drains any result set regardless of
                // statement type, so this is safe for plain DDL/DML too.
                $stmt = $this->pdo->query($trimmed);
                if ($stmt instanceof \PDOStatement) {
                    $stmt->closeCursor();
                }
            }

            // Only commit if a transaction is still actually open (DDL above
            // may have already implicitly committed it server-side).
            if ($this->pdo->inTransaction()) {
                $this->pdo->commit();
            }

            // Record in metadata. This runs as its own (auto-committed)
            // statement, deliberately outside the migration's own
            // transaction — see note above on why that transaction may
            // already be closed by the time we get here.
            $stmt = $this->pdo->prepare(
                "INSERT INTO {$this->metadataTable} (migration_name, checksum, status) VALUES (?, ?, 'success')"
            );
            $stmt->execute([$migrationName, $checksum]);

        } catch (\Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Split SQL file into individual statements.
     * Handles common cases (-- comments, block comments, strings).
     * This is a simplified splitter suitable for migration files.
     *
     * @param string $sql
     * @return array
     */
    private function splitSqlStatements(string $sql): array {
        $statements = [];
        $current = '';
        $inString = false;
        $stringChar = '';
        $i = 0;
        $len = strlen($sql);

        while ($i < $len) {
            $char = $sql[$i];
            $nextChar = ($i + 1 < $len) ? $sql[$i + 1] : '';

            // Handle string delimiters
            if (($char === "'" || $char === '"') && !$inString) {
                $inString = true;
                $stringChar = $char;
                $current .= $char;
                $i++;
                continue;
            }

            if ($inString && $char === $stringChar && ($i === 0 || $sql[$i - 1] !== '\\')) {
                $inString = false;
                $current .= $char;
                $i++;
                continue;
            }

            // Handle line comments (-- or #)
            if (!$inString && ($char === '-' && $nextChar === '-' || $char === '#')) {
                // Skip until end of line
                while ($i < $len && $sql[$i] !== "\n") {
                    $i++;
                }
                // Skip the newline too
                if ($i < $len) {
                    $i++;
                }
                continue;
            }

            // Handle block comments /* ... */
            if (!$inString && $char === '/' && $nextChar === '*') {
                $i += 2; // Skip /*
                while ($i < $len - 1) {
                    if ($sql[$i] === '*' && $sql[$i + 1] === '/') {
                        $i += 2;
                        break;
                    }
                    $i++;
                }
                continue;
            }

            // Handle statement terminator
            if (!$inString && $char === ';') {
                if (!empty(trim($current))) {
                    $statements[] = $current;
                }
                $current = '';
                $i++;
                continue;
            }

            $current .= $char;
            $i++;
        }

        // Add any remaining statement
        if (!empty(trim($current))) {
            $statements[] = $current;
        }

        return $statements;
    }

    /**
     * Record a migration error for diagnostic purposes.
     *
     * @param string $migrationName
     * @param string $errorMessage
     */
    private function recordMigrationError(string $migrationName, string $errorMessage): void {
        try {
            $stmt = $this->pdo->prepare(
                "INSERT INTO {$this->metadataTable} (migration_name, error_message, status) VALUES (?, ?, 'failed') 
                 ON DUPLICATE KEY UPDATE error_message = VALUES(error_message), status = 'failed'"
            );
            $stmt->execute([$migrationName, substr($errorMessage, 0, 500)]);
        } catch (\Exception $e) {
            // Silent fail — we're already in error handling
        }
    }

    /**
     * Get the status of all migrations (for debugging/logging).
     *
     * @return array
     */
    public function getStatus(): array {
        $stmt = $this->pdo->prepare(
            "SELECT migration_name, applied_at, status FROM {$this->metadataTable} ORDER BY applied_at ASC"
        );
        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
