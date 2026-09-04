#!/usr/bin/env php
<?php
/**
 * Database Migration Runner
 *
 * Applies pending migrations from the migrations/ directory to the database.
 * Idempotent — safe to run multiple times; already-applied migrations are skipped.
 *
 * Usage:
 *   php migrate.php
 *     Uses config.php in the parent directory for DB credentials
 *   php migrate.php --check
 *     Shows migration status without applying anything
 *   php migrate.php --status
 *     Alias for --check
 *
 * Exit codes:
 *   0 — success (migrations applied or already current)
 *   1 — failure (migration error, missing config, DB connection failed)
 *   2 — usage error (bad arguments)
 */

// Enable strict error handling
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Determine paths
$dbDir = __DIR__;
$backendDir = dirname($dbDir);
$configPath = $backendDir . '/config.php';

// Auto-find config.example.php if config.php doesn't exist (for CI environments)
if (!file_exists($configPath)) {
    $examplePath = $backendDir . '/config.example.php';
    if (file_exists($examplePath)) {
        $configPath = $examplePath;
    }
}

// Check if we're running from CLI (as intended) or from web
if (php_sapi_name() !== 'cli' && php_sapi_name() !== 'phpdbg') {
    // Allow web access but clearly mark it as a dangerous operation
    header('Content-Type: text/plain', true, 400);
    echo "❌ ERROR: migrations must run via CLI, not HTTP\n";
    echo "If you absolutely need to run migrations via HTTP, use /api/migrate endpoint instead.\n";
    exit(1);
}

// Parse command-line arguments
$args = array_slice($argv, 1);
$checkOnly = false;

foreach ($args as $arg) {
    if ($arg === '--check' || $arg === '--status') {
        $checkOnly = true;
    } elseif ($arg === '--help' || $arg === '-h') {
        showHelp();
        exit(0);
    } else {
        fwrite(STDERR, "❌ Unknown argument: $arg\n");
        showHelp();
        exit(2);
    }
}

// Load configuration
if (!file_exists($configPath)) {
    fwrite(STDERR, "❌ ERROR: config.php not found at $configPath\n");
    fwrite(STDERR, "   Please copy config.example.php to config.php and configure database credentials.\n");
    exit(1);
}

// NOTE: config.php (and config.example.php) use `return [...]` at file
// scope — the same convention as db/pdo.php's loadConfig() and every other
// consumer in this codebase. The return value MUST be captured; a bare
// require/require_once here discards it and leaves $config permanently
// undefined, which was BUG-040 (see docs/BUGLOG.md).
$config = require_once $configPath;

if (!isset($config) || !is_array($config)) {
    fwrite(STDERR, "❌ ERROR: Invalid config.php — missing or malformed \$config array\n");
    exit(1);
}

// Require the Migrations framework
require_once $dbDir . '/Migrations.php';

// Connect to database
try {
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $config['db']['host'] ?? 'localhost',
        $config['db']['name'] ?? ''
    );
    
    $pdo = new \PDO(
        $dsn,
        $config['db']['user'] ?? '',
        $config['db']['password'] ?? '',
        [
            \PDO::ATTR_ERRMODE                  => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE        => \PDO::FETCH_ASSOC,
            \PDO::MYSQL_ATTR_INIT_COMMAND        => "SET NAMES utf8mb4",
            // Defense-in-depth for BUG-042: without this, a query whose
            // result set isn't fully consumed/closed can strand the
            // connection and make the *next* query fail with MySQL error
            // 2014 ("unbuffered queries are active").
            \PDO::MYSQL_ATTR_USE_BUFFERED_QUERY  => true,
        ]
    );
} catch (\PDOException $e) {
    fwrite(STDERR, "❌ Database connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

// Initialize migration framework
try {
    $migrator = new \AuditEngine\Migrations($pdo);
} catch (\Exception $e) {
    fwrite(STDERR, "❌ Migration framework initialization failed: " . $e->getMessage() . "\n");
    exit(1);
}

// Show status (even in --check mode, this is what the user wants to see)
echo "\n📋 Migration Status:\n";
echo str_repeat("─", 60) . "\n";
$status = $migrator->getStatus();
if (empty($status)) {
    echo "(No migrations applied yet)\n";
} else {
    foreach ($status as $migration) {
        $badge = ($migration['status'] === 'success') ? '✅' : '❌';
        echo sprintf(
            "%s %-40s %s\n",
            $badge,
            $migration['migration_name'],
            $migration['applied_at']
        );
    }
}
echo str_repeat("─", 60) . "\n";

// If --check mode, stop here
if ($checkOnly) {
    echo "\n✓ Migration status checked (no changes applied).\n\n";
    exit(0);
}

// Run migrations
echo "\n🚀 Applying pending migrations...\n";
echo str_repeat("─", 60) . "\n";

try {
    $result = $migrator->run($dbDir . '/migrations');
    
    if ($result['success']) {
        echo "✅ Migration succeeded!\n";
        echo sprintf(
            "   Applied: %d new, Skipped: %d (already applied)\n",
            $result['applied'],
            $result['skipped']
        );
        
        if ($result['applied'] === 0 && $result['skipped'] === 0) {
            echo "   (No migrations needed)\n";
        }
        
        echo "\n✓ Database is current.\n\n";
        exit(0);
    } else {
        echo "❌ Migration failed: " . $result['error'] . "\n";
        echo sprintf(
            "   Applied before failure: %d, Skipped: %d\n",
            $result['applied'],
            $result['skipped']
        );
        echo "\n✗ Database may be in an inconsistent state. Review error above.\n\n";
        exit(1);
    }
} catch (\Exception $e) {
    fwrite(STDERR, "❌ Unexpected error: " . $e->getMessage() . "\n");
    exit(1);
}

// =====================================================================
// Helper function: show usage information
// =====================================================================
function showHelp() {
    global $argv;
    $prog = basename($argv[0]);
    echo <<<'HELP'
Audit Duration Calculator — Database Migration Runner

USAGE:
  php migrate.php              Apply pending migrations to the database
  php migrate.php --check      Show migration status without applying changes
  php migrate.php --status     Alias for --check
  php migrate.php --help       Show this message

REQUIREMENTS:
  - config.php must exist in the parent directory with database credentials
  - Migrations are read from migrations/ in the same directory as this script
  - Already-applied migrations are idempotent; safe to run multiple times

EXIT CODES:
  0 — success (migrations applied or no changes needed)
  1 — error (migration failed, config missing, or database error)
  2 — usage error (invalid arguments)

HELP;
}
