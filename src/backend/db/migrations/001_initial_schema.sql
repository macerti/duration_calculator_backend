-- Audit Duration Engine — Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2026-09-03
-- Target: MariaDB (DirectAdmin shared hosting), compatible with MySQL 8.0+
-- 
-- This migration creates the complete baseline schema for the audit duration calculator.
-- It is idempotent — safe to run multiple times; already-existing tables/columns are skipped.
--
-- Tables created:
--   - parameter_sets: versioned snapshots of IAF configuration
--   - clients: audit client names (no CRM data)
--   - calculation_cases: saved calculations (dossiers)
--   - parameter_change_log: audit trail of parameter modifications
--   - migrations_metadata: migration tracking (will be auto-created by Migrations.php)

SET NAMES utf8mb4;

-- =====================================================================
-- parameter_sets table
-- =====================================================================
CREATE TABLE IF NOT EXISTS parameter_sets (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  version       INT           NOT NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 0,
  change_note   TEXT          NULL,
  data          LONGTEXT      NOT NULL,  -- JSON blob
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parameter_sets_version (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- clients table
-- =====================================================================
CREATE TABLE IF NOT EXISTS clients (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_clients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- calculation_cases table (baseline + idempotent upgrades)
-- =====================================================================
CREATE TABLE IF NOT EXISTS calculation_cases (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_ref        VARCHAR(128)  NOT NULL,
  parameter_set_id   VARCHAR(64)   NOT NULL,
  commercial         VARCHAR(128)  NULL,
  scope_text         TEXT          NULL,
  input_json         LONGTEXT      NOT NULL,
  result_json        LONGTEXT      NULL,
  total_days         DECIMAL(8,2)  NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_calculation_cases_dossier_ref (dossier_ref),
  CONSTRAINT fk_calculation_cases_parameter_set
    FOREIGN KEY (parameter_set_id) REFERENCES parameter_sets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- parameter_change_log table
-- =====================================================================
CREATE TABLE IF NOT EXISTS parameter_change_log (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parameter_set_id  VARCHAR(64)  NOT NULL,
  changed_by        VARCHAR(128) NULL,
  change_summary    TEXT         NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_parameter_change_log_parameter_set
    FOREIGN KEY (parameter_set_id) REFERENCES parameter_sets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Upgrade: Add client_id, status, rounding_overrides_json to calculation_cases
-- =====================================================================
-- This guard checks if the column exists before adding it; safe to run multiple times.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calculation_cases' AND COLUMN_NAME = 'client_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE calculation_cases
     ADD COLUMN client_id INT UNSIGNED NULL AFTER dossier_ref,
     ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT ''draft'' AFTER client_id,
     ADD COLUMN rounding_overrides_json LONGTEXT NULL AFTER result_json,
     ADD CONSTRAINT fk_calculation_cases_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
     ADD KEY idx_calculation_cases_client_id (client_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================================
-- Ensure idx_calculation_cases_client_id exists
-- =====================================================================
-- This guard ensures the index exists even if added in a partial prior migration.
SET @has_client_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calculation_cases'
    AND INDEX_NAME = 'idx_calculation_cases_client_id'
);
SET @sql_idx := IF(@has_client_idx = 0,
  'ALTER TABLE calculation_cases ADD KEY idx_calculation_cases_client_id (client_id)',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- =====================================================================
-- Upgrade: Fix client foreign key to use ON DELETE CASCADE
-- =====================================================================
-- If an FK exists but is not ON DELETE CASCADE, drop it and re-add with the correct behavior.
-- Split into two ALTER TABLE statements to avoid MariaDB/InnoDB errno 121 "Duplicate key".
SET @fk_name := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calculation_cases'
    AND COLUMN_NAME = 'client_id' AND REFERENCED_TABLE_NAME = 'clients'
  LIMIT 1
);
SET @needs_fix := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = @fk_name AND DELETE_RULE != 'CASCADE'
);

-- Step 1: Drop old non-CASCADE FK if it exists and needs fixing
SET @sql2a := IF(@fk_name IS NOT NULL AND @needs_fix > 0,
  CONCAT('ALTER TABLE calculation_cases DROP FOREIGN KEY `', @fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt2a FROM @sql2a;
EXECUTE stmt2a;
DEALLOCATE PREPARE stmt2a;

-- Step 2: Re-check and add CASCADE FK if missing
SET @fk_name2 := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calculation_cases'
    AND COLUMN_NAME = 'client_id' AND REFERENCED_TABLE_NAME = 'clients'
  LIMIT 1
);
SET @sql2b := IF(@fk_name2 IS NULL,
  'ALTER TABLE calculation_cases ADD CONSTRAINT fk_calculation_cases_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt2b FROM @sql2b;
EXECUTE stmt2b;
DEALLOCATE PREPARE stmt2b;

-- =====================================================================
-- Upgrade: Add wizard_state_json column
-- =====================================================================
-- Stores full wizard state for restoring the editable UI when reopening a saved calculation.
SET @wiz_col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calculation_cases' AND COLUMN_NAME = 'wizard_state_json'
);
SET @sql3 := IF(@wiz_col_exists = 0,
  'ALTER TABLE calculation_cases ADD COLUMN wizard_state_json LONGTEXT NULL AFTER rounding_overrides_json',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
