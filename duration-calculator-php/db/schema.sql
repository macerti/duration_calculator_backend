-- Audit Duration Engine — database schema
-- Target: MariaDB (cPanel shared hosting), also compatible with MySQL 8.
-- Run this once via phpMyAdmin or `mysql -u USER -p DBNAME < schema.sql`.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Parameter sets: versioned snapshots of the whole rule configuration
-- (IAF duration tables, NACE table, factor catalogue, synergy grid,
-- validation bounds, coefficients). Stored as JSON blobs so the engine's
-- TypeScript ParameterSet shape can be persisted/loaded without a rigid
-- column-per-field schema that fights every future rule tweak.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parameter_sets (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  version       INT           NOT NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 0,
  change_note   TEXT          NULL,
  data          LONGTEXT      NOT NULL,  -- JSON: iafDurationTables, factorCatalogue, synergyGrid, etc.
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parameter_sets_version (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Only one parameter set should be active at a time; enforced in application code
-- (MariaDB doesn't support partial unique indexes cleanly across all versions we target).

-- ---------------------------------------------------------------------
-- Calculation cases (dossiers): one row per saved calculation.
-- Input and result are both stored as JSON so the full case (sites,
-- standards, factor selections, computed durations) round-trips exactly
-- as the engine produced it, without a giant relational fan-out.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculation_cases (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_ref        VARCHAR(128)  NOT NULL,
  parameter_set_id   VARCHAR(64)   NOT NULL,
  commercial         VARCHAR(128)  NULL,
  scope_text         TEXT          NULL,
  input_json         LONGTEXT      NOT NULL,   -- CalculationCaseInput
  result_json        LONGTEXT      NULL,       -- CaseCalculationResult (cached, recomputable)
  total_days         DECIMAL(8,2)  NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_calculation_cases_dossier_ref (dossier_ref),
  CONSTRAINT fk_calculation_cases_parameter_set
    FOREIGN KEY (parameter_set_id) REFERENCES parameter_sets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Audit log: who changed what parameter, when — accreditation-defensibility
-- trail, mirrors the "justification text is mandatory" design decision.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parameter_change_log (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parameter_set_id  VARCHAR(64)  NOT NULL,
  changed_by        VARCHAR(128) NULL,
  change_summary    TEXT         NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_parameter_change_log_parameter_set
    FOREIGN KEY (parameter_set_id) REFERENCES parameter_sets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Clients: just a name, not a CRM. A client can have many calculations
-- (audit programs) over time — different cycles, revisions, scope changes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_clients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Link calculations to a client, and add a status + manual rounding overrides
-- column. Idempotent guards since this may run against an already-seeded DB
-- from before clients existed.
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

-- Independent guard: ensure idx_calculation_cases_client_id exists even if
-- the column was added in an older/partial migration that didn't include it
-- (stmt1 above only creates it as part of the initial ADD COLUMN, so a
-- database that already had client_id before this index existed would
-- otherwise never get it). Checked and added on its own — never combined
-- with the foreign-key statements below, and safe to run repeatedly.
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

-- Explicit decision (revised 2026-08-24, see ROADMAP.md decisions log):
-- deleting a client now deletes its calculations too, rather than orphaning
-- them (the earlier 4.0.0 behavior). Re-points the FK to CASCADE regardless
-- of which earlier state it's currently in (un-set/RESTRICT-default, or the
-- SET NULL this project shipped with in 4.0.0).
--
-- IMPORTANT (fixed 2026-09-01, BUG-023): dropping and re-adding a foreign key
-- under the SAME constraint name inside one ALTER TABLE statement fails on
-- MariaDB/MySQL/InnoDB with errno 121 "Duplicate key on write or update" —
-- the new constraint's name is checked against the dictionary before the
-- drop in the same statement is considered final. The old single-statement
-- 'DROP FOREIGN KEY x, ADD CONSTRAINT x ...' form is broken on any database
-- where the FK already exists (which is every already-migrated database,
-- i.e. exactly the case this guard exists for). Fixed by splitting the drop
-- and the add into two separate ALTER TABLE statements/executions, and by
-- re-checking the FK's existence in between so this whole block is safe to
-- run any number of times against a fresh, partially-migrated, or
-- fully up-to-date database.
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

-- Step 1 of 2: if a foreign key exists but isn't ON DELETE CASCADE, drop it
-- (on its own, in its own statement — never combined with the re-add below).
SET @sql2a := IF(@fk_name IS NOT NULL AND @needs_fix > 0,
  CONCAT('ALTER TABLE calculation_cases DROP FOREIGN KEY `', @fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt2a FROM @sql2a;
EXECUTE stmt2a;
DEALLOCATE PREPARE stmt2a;

-- Re-check after the possible drop above: covers three cases in one guard —
-- (a) nothing to do, a CASCADE FK already existed and step 1 was a no-op;
-- (b) step 1 just dropped a non-CASCADE FK, so client_id has no FK now;
-- (c) client_id column exists from an older/partial migration that never
--     got a foreign key at all (self-heals a state stmt1 above can't reach,
--     since stmt1 only runs when the column itself is missing).
-- The explicit index (idx_calculation_cases_client_id, added by stmt1) is
-- untouched by dropping the foreign key, so it's reused rather than
-- recreated — no duplicate-index risk here.
SET @fk_name2 := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calculation_cases'
    AND COLUMN_NAME = 'client_id' AND REFERENCED_TABLE_NAME = 'clients'
  LIMIT 1
);

-- Step 2 of 2: (re-)add the foreign key with ON DELETE CASCADE if it's
-- missing. Also its own statement, so this never collides with step 1.
SET @sql2b := IF(@fk_name2 IS NULL,
  'ALTER TABLE calculation_cases ADD CONSTRAINT fk_calculation_cases_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt2b FROM @sql2b;
EXECUTE stmt2b;
DEALLOCATE PREPARE stmt2b;

-- Full wizard editing state (sites with sectors, personnel, per-standard
-- factor/synergy config) as its own JSON blob, separate from input_json
-- (the engine-ready computed input) and result_json (engine output).
-- Needed so reopening a saved calculation can fully restore the editable
-- wizard UI, not just show the last computed result — resolved risk levels
-- and factor totals in input_json/result_json don't carry enough
-- information to reconstruct which sectors were picked, which catalogue
-- items were ticked, etc.
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
