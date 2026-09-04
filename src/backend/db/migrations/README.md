# Database Migrations

This directory contains versioned database schema migrations for the Audit Duration Calculator.

## Overview

The migration system is **idempotent** — each migration can be safely run multiple times without causing errors or data loss. Already-applied migrations are tracked in the `migrations_metadata` table and skipped on subsequent runs.

**Key principles:**
- Each migration is a single `.sql` file with a numeric prefix (`001_`, `002_`, etc.)
- Migrations are executed in alphabetical order (numeric prefix ensures consistent ordering)
- Each migration is atomic — applied as a single database transaction
- The system tracks which migrations have been applied via the `migrations_metadata` table
- **No rollback capability yet** — migrations are one-way; rolling back requires manual work

## How Migrations Are Run

### Automatic (CI/CD)

After code is pushed to the source repository and deployed to `macerti/duration_calculator`, the deployment workflow runs:
```bash
php db/migrate.php
```

This automatically applies any new migrations in the `migrations/` directory that haven't been applied yet.

### Manual (Local Development)

To test migrations locally:
```bash
cd src/backend/db
php migrate.php
```

To check status without applying anything:
```bash
php migrate.php --check
```

## Writing a New Migration

### Naming Convention

Use a numeric prefix followed by a descriptive name:
- `002_add_auth_tables.sql`
- `003_add_users_email_unique.sql`
- `004_create_audit_log_table.sql`

The numeric prefix should be the next sequential number after the highest existing migration. For example, if `001_initial_schema.sql` exists, the next migration should be `002_*.sql`.

### Migration Template

```sql
-- Audit Duration Engine — [Description of what this migration does]
-- Migration: 002_[descriptive_name]
-- Created: 2026-MM-DD
-- Author: [Your name or team]
--
-- What this migration does:
-- - [Change 1]
-- - [Change 2]
-- - [Change 3]
--
-- Related issue/feature: FEAT-XXX or BUG-XXX

-- Use idempotent guards to ensure this migration is safe to run multiple times.
-- This is the pattern used throughout — never assume prior state.

-- =====================================================================
-- Example: Add a new table
-- =====================================================================
CREATE TABLE IF NOT EXISTS new_table (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_new_table_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Example: Add a column to an existing table (with guard)
-- =====================================================================
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_table' AND COLUMN_NAME = 'new_column'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE existing_table ADD COLUMN new_column VARCHAR(255) NULL AFTER some_field',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Example: Add an index with existence check
-- =====================================================================
SET @has_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'some_table' AND INDEX_NAME = 'idx_new_index'
);
SET @sql_idx := IF(@has_index = 0,
  'ALTER TABLE some_table ADD KEY idx_new_index (column_name)',
  'DO 0'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- =====================================================================
-- Example: Add a foreign key with existence check
-- =====================================================================
-- Note: if replacing an existing FK with different options, use two separate
-- ALTER TABLE statements (drop, then add) to avoid MariaDB errno 121.

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'table_name'
    AND COLUMN_NAME = 'fk_column' AND REFERENCED_TABLE_NAME = 'ref_table'
);
SET @sql_fk := IF(@fk_exists = 0,
  'ALTER TABLE table_name ADD CONSTRAINT fk_constraint_name FOREIGN KEY (fk_column) REFERENCES ref_table(id) ON DELETE CASCADE',
  'DO 0'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;
```

### Idempotent Patterns

#### Pattern 1: `CREATE TABLE IF NOT EXISTS`

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### Pattern 2: Add a Column (with guard)

```sql
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'email_verified'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER email',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

#### Pattern 3: Add an Index (with guard)

```sql
SET @has_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_email'
);
SET @sql_idx := IF(@has_index = 0,
  'ALTER TABLE users ADD KEY idx_users_email (email)',
  'DO 0'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
```

#### Pattern 4: Add a Foreign Key (with guard)

When **adding a new foreign key**:

```sql
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'users'
);
SET @sql_fk := IF(@fk_exists = 0,
  'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'DO 0'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;
```

When **modifying an existing foreign key** (e.g., changing `ON DELETE` behavior):
- **IMPORTANT**: Always use two separate `ALTER TABLE` statements, not one
- First statement drops the old FK
- Second statement adds the new FK
- This avoids MariaDB/InnoDB errno 121 ("Duplicate key on write or update")

```sql
-- Step 1: Drop the old FK (separate statement)
SET @fk_name := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);
SET @sql_drop := IF(@fk_name IS NOT NULL,
  CONCAT('ALTER TABLE orders DROP FOREIGN KEY `', @fk_name, '`'),
  'DO 0'
);
PREPARE stmt_drop FROM @sql_drop;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;

-- Step 2: Add the new FK with updated behavior (separate statement)
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'users'
);
SET @sql_add := IF(@fk_exists = 0,
  'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'DO 0'
);
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;
```

## Best Practices

1. **Test locally first** — Run the migration against a local database clone before pushing
   ```bash
   php migrate.php
   php migrate.php --check
   ```

2. **Make each migration small and focused** — One logical change per migration file
   - Good: `002_add_users_table.sql`, `003_add_email_verification.sql`
   - Bad: `002_do_everything.sql`

3. **Always use idempotent guards** — Even simple CREATE TABLE statements can fail if re-run
   - Use `IF NOT EXISTS` for tables and indexes
   - Use `information_schema` queries for columns and foreign keys

4. **Document what changed** — Add a header comment explaining the purpose
   ```sql
   -- Migration: 003_add_email_verification
   -- Purpose: Support email verification flow for local account creation
   -- Adds: users.email_verified (boolean), verify_tokens (new table)
   ```

5. **Test idempotence** — Run the migration twice, confirm second run is a no-op
   ```bash
   php migrate.php              # First run
   php migrate.php              # Second run (should show "Applied: 0")
   ```

6. **Never modify old migrations** — Once a migration is in the repo and has been deployed, it's locked
   - If a migration has a bug, create a new migration to fix it
   - Old migrations stay as-is for audit trail purposes

7. **Use UTF-8** — All tables should explicitly set `CHARSET=utf8mb4` (never rely on server default)

## Related Files

- **`Migrations.php`** — The migration framework class (handles discovery, tracking, execution)
- **`migrate.php`** — CLI runner for applying migrations
- **`001_initial_schema.sql`** — The baseline schema (all tables as they exist today)

## Troubleshooting

### "Migration failed: Already exists"
A table, column, or index creation failed because it already exists. This shouldn't happen if the migration uses `IF NOT EXISTS` or `information_schema` checks properly. Check the guard logic in your migration.

### "Duplicate key on write or update" (errno 121)
This typically occurs when dropping and re-adding a foreign key in the same `ALTER TABLE` statement. **Solution**: Split into two separate statements. See the "Modifying an existing foreign key" pattern above.

### Migration shows as "failed" but next run still applies it
Failed migrations are recorded in `migrations_metadata` with `status = 'failed'`. The system won't re-attempt them automatically — you must manually fix the migration file and update the database record. Contact your DBA or ask in the development Slack channel.

## Future Enhancements

- [ ] **Rollback capability** — Store reverse migrations to enable rollback (not yet implemented)
- [ ] **API endpoint** — Expose `/api/migrate` for web-based migration triggering (safer than current CI-only approach)
- [ ] **Migration validation** — Dry-run mode to preview changes before applying
- [ ] **Batch migrations** — Group related migrations into "update bundles" for better UX
