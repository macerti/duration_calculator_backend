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
