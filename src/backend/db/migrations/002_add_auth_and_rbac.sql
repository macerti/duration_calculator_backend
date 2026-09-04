-- Audit Duration Engine — local email/password accounts + role-based access control
-- Migration: 002_add_auth_and_rbac
-- Created: 2026-09-04
-- Author: Claude (dev session, 2026-09-04)
--
-- What this migration does:
-- - Creates `roles` (admin-editable access levels: administrateur/technicien/
--   utilisateur, seeded but fully creatable/renameable/deletable by an admin)
-- - Creates `permissions` (machine-checkable "functions", e.g. manage_users)
-- - Creates `role_permissions` (many-to-many: which functions each role grants)
-- - Creates `users` (real persisted accounts — this app had NO users table at
--   all before this migration; Microsoft/Google SSO only ever stored an
--   ephemeral PHP-session array, never a DB row — see docs/BUGLOG.md/
--   docs/DEV_STATUS.md 2026-09-04 session entry for the full account-model
--   history and docs/ROADMAP.md FEAT-002 "Account model / migration
--   constraint" for the design requirement this satisfies)
-- - Creates `user_identities` (links a Microsoft/Google provider identity to
--   exactly one `users` row — the explicit account-linking policy FEAT-002
--   required and never had)
-- - Creates `email_verification_tokens` and `password_reset_tokens` (link-
--   based, not copy-paste-token-based — the raw token only ever appears in
--   the emailed URL; only its SHA-256 hash is stored)
-- - Creates `rate_limits` (generic DB-backed limiter, per SECURITY.md's own
--   "Todo #2" recommendation — no Redis/Memcached needed on shared hosting)
-- - Seeds 3 default roles and an initial set of permissions, and wires the
--   default role→permission grants. All seeding uses INSERT IGNORE against
--   UNIQUE keys so re-running this migration never duplicates or resets
--   data an admin has since edited via the admin UI.
--
-- Related: ROADMAP.md item 9 (local account creation), SECURITY.md "Todo #1
-- Authentication — the single biggest gap", "Todo #2 Rate limiting".
--
-- Every CREATE TABLE below is a brand-new table (IF NOT EXISTS is already
-- fully idempotent on its own) — unlike 001_initial_schema.sql, this
-- migration adds no columns/indexes/FKs to pre-existing tables, so none of
-- the PREPARE/EXECUTE/DEALLOCATE information_schema guard patterns from
-- db/migrations/README.md are needed here.

-- =====================================================================
-- roles — admin-manageable access levels
-- =====================================================================
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  -- is_system protects exactly one seeded row (the bootstrap admin role)
  -- from deletion, so the app can never end up with zero possible admins.
  -- Admin can still rename/edit it — this only blocks DELETE.
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- permissions — machine-checkable "functions" a role can be granted
-- =====================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- `key` is a reserved word in SQL — column is named key_name instead.
  key_name VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permissions_key (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- role_permissions — which permissions each role currently grants
-- =====================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- users — real persisted accounts (local password and/or SSO-linked)
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  -- Set while an email CHANGE is awaiting confirmation on the new address.
  -- The live `email` column never becomes unverified once set — see
  -- Guard.php / the profile-update endpoint for why this exists.
  pending_email VARCHAR(255) NULL,
  -- NULL for an account that has only ever signed in via Microsoft/Google.
  -- 255 wide (not a fixed bcrypt-60 width) so a future password_hash()
  -- algorithm change (e.g. to Argon2id) never requires a schema change.
  password_hash VARCHAR(255) NULL,
  email_verified_at DATETIME NULL,
  role_id INT UNSIGNED NOT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_id (role_id),
  -- ON DELETE RESTRICT: a role with users still assigned to it cannot be
  -- deleted at the database level, as a hard backstop for the same rule
  -- enforced in the API (see RoleRepo::deleteRole) — defense in depth.
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- user_identities — links one Microsoft/Google identity to one user row
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_identities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  provider ENUM('microsoft','google') NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_identities_provider (provider, provider_user_id),
  KEY idx_user_identities_user_id (user_id),
  CONSTRAINT fk_user_identities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- email_verification_tokens — link-based confirmation (registration AND
-- email-change), never a token the user has to copy/paste
-- =====================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  -- SHA-256 hex digest of the raw token. The raw token itself only ever
  -- exists in the emailed URL and briefly in PHP memory — never stored.
  token_hash CHAR(64) NOT NULL,
  purpose ENUM('verify_registration','verify_email_change') NOT NULL DEFAULT 'verify_registration',
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_verification_token_hash (token_hash),
  KEY idx_email_verification_user_id (user_id),
  CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- password_reset_tokens — link-based reset (also doubles as "set my
-- first local password" for an account that so far only has SSO)
-- =====================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_password_reset_token_hash (token_hash),
  KEY idx_password_reset_user_id (user_id),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- rate_limits — generic DB-backed limiter (SECURITY.md Todo #2)
-- =====================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bucket_key VARCHAR(191) NOT NULL,
  window_start DATETIME NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rate_limits_bucket (bucket_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Seed default roles (admin can rename/delete/replace all of this later
-- via the admin UI — this just guarantees the app is usable on first boot)
-- =====================================================================
INSERT IGNORE INTO roles (name, description, is_system) VALUES
  ('administrateur', 'Accès complet : utilisateurs, rôles/permissions, clients et calculs.', 1),
  ('technicien', 'Accès métier étendu : clients, calculs, et ajustements avancés (réductions/majorations).', 0),
  ('utilisateur', 'Accès de base : créer et consulter ses propres calculs.', 0);

-- =====================================================================
-- Seed initial permissions. Deliberately a small starting set — per
-- Mahdi's own instruction (2026-09-04), the rest will be identified
-- incrementally as specific features are gated; the admin UI to grant/
-- revoke and to create new permission entries is what this migration
-- and its API/UI must make durably possible, not an exhaustive list now.
-- =====================================================================
INSERT IGNORE INTO permissions (key_name, label, description) VALUES
  ('manage_users', 'Gérer les utilisateurs', 'Voir la liste des comptes, changer leur rôle, activer/désactiver un compte.'),
  ('manage_roles', 'Gérer les rôles et permissions', 'Créer, modifier, supprimer des rôles et choisir les fonctions attribuées à chacun.'),
  ('manage_clients', 'Gérer les clients', 'Créer, modifier, supprimer des fiches client.'),
  ('manage_calculations', 'Créer et modifier des calculs', 'Créer, modifier, supprimer des calculs de durée d\'audit.'),
  ('override_percentages', 'Modifier les pourcentages de réduction/majoration', 'Modifier manuellement les taux de réduction ou de majoration proposés par le moteur de calcul.'),
  ('add_custom_adjustment', 'Ajouter une réduction/majoration « Autre »', 'Ajouter un ajustement personnalisé (Autre réduction/augmentation) à un calcul.');

-- =====================================================================
-- Seed default role → permission grants (a reasonable starting point;
-- fully editable afterwards from the admin UI)
-- =====================================================================
-- administrateur: everything
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON TRUE
WHERE r.name = 'administrateur';

-- technicien: business-data + advanced adjustment permissions, no user/role admin
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.key_name IN ('manage_clients', 'manage_calculations', 'override_percentages', 'add_custom_adjustment')
WHERE r.name = 'technicien';

-- utilisateur: can create/manage calculations only
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.key_name IN ('manage_calculations')
WHERE r.name = 'utilisateur';
