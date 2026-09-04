<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Users — the real, persisted account model this app never had before
 * 2026-09-04 (see docs/DEV_STATUS.md for the full history: Microsoft/Google
 * SSO previously stored only an ephemeral PHP-session array, no DB row at
 * all). This file covers local email/password accounts, the SSO
 * account-linking policy FEAT-002 required, and email-verification /
 * password-reset tokens (link-based — see Mailer.php / api/index.php).
 *
 * Password hashing: PHP's password_hash()/password_verify() with
 * PASSWORD_DEFAULT (bcrypt as of PHP 8.3) — never hand-rolled, per
 * SECURITY.md's own explicit recommendation. Bcrypt silently truncates
 * input past 72 bytes, so MAX_PASSWORD_LENGTH below is enforced at
 * registration/reset time, not just documented.
 */

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72;
const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60; // 24h
const PASSWORD_RESET_TTL_SECONDS = 60 * 60;          // 1h

function hashPassword(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

function generateRawToken(): string
{
    return bin2hex(random_bytes(32)); // 64 hex chars, URL-safe as-is
}

function hashToken(string $rawToken): string
{
    return hash('sha256', $rawToken);
}

// =========================================================================
// Core user lookups
// =========================================================================

function findUserByEmail(string $email): ?array
{
    $stmt = getPdo()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([strtolower(trim($email))]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function findUserById(int $id): ?array
{
    $stmt = getPdo()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/**
 * Full, client-safe profile: id/name/email/role/permissions/verification
 * status. Never includes password_hash. Loaded fresh from the DB on every
 * call (rather than cached in the session) so a role change or account
 * deactivation by an admin takes effect on the user's very next request,
 * not only after they log out and back in.
 */
function getUserProfile(int $id): ?array
{
    $stmt = getPdo()->prepare(
        'SELECT u.id, u.name, u.email, u.pending_email, u.email_verified_at, u.status,
            u.last_login_at, u.created_at, u.role_id, r.name AS role_name,
            (u.password_hash IS NOT NULL) AS has_password
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $permStmt = getPdo()->prepare(
        'SELECT p.key_name FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?'
    );
    $permStmt->execute([$row['role_id']]);
    $permissions = array_column($permStmt->fetchAll(), 'key_name');

    $identStmt = getPdo()->prepare('SELECT provider FROM user_identities WHERE user_id = ?');
    $identStmt->execute([$id]);
    $providers = array_column($identStmt->fetchAll(), 'provider');

    return [
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'pendingEmail' => $row['pending_email'],
        'emailVerified' => $row['email_verified_at'] !== null,
        'status' => $row['status'],
        'hasPassword' => (bool)$row['has_password'],
        'linkedProviders' => array_values($providers),
        'role' => ['id' => (int)$row['role_id'], 'name' => $row['role_name']],
        'permissions' => array_values($permissions),
        'lastLoginAt' => $row['last_login_at'],
        'createdAt' => $row['created_at'],
    ];
}

function setLastLogin(int $id): void
{
    $stmt = getPdo()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?');
    $stmt->execute([$id]);
}

// =========================================================================
// Local (email/password) registration
// =========================================================================

/**
 * @throws \RuntimeException with a client-safe message on validation failure
 */
function validatePassword(string $password): void
{
    if (mb_strlen($password) < MIN_PASSWORD_LENGTH) {
        throw new \RuntimeException("Le mot de passe doit contenir au moins " . MIN_PASSWORD_LENGTH . " caractères.");
    }
    if (strlen($password) > MAX_PASSWORD_LENGTH) {
        throw new \RuntimeException("Le mot de passe ne doit pas dépasser " . MAX_PASSWORD_LENGTH . " caractères.");
    }
}

/**
 * Creates a brand-new local account. Caller (api/index.php) is responsible
 * for having already confirmed no user with this email exists at all —
 * see that route's comment on why duplicate emails are rejected before
 * reaching this function rather than handled here.
 *
 * The very first account ever created on a given install is promoted to
 * the system admin role automatically (see RoleRepo::getSystemAdminRoleId)
 * — otherwise a fresh install has no way to reach the admin UI at all.
 */
function createLocalUser(string $name, string $email, string $password): array
{
    validatePassword($password);
    $roleId = (countUsers() === 0)
        ? (getSystemAdminRoleId() ?? getDefaultRoleId())
        : getDefaultRoleId();

    $stmt = getPdo()->prepare(
        'INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, "active")'
    );
    $stmt->execute([trim($name), strtolower(trim($email)), hashPassword($password), $roleId]);
    $id = (int)getPdo()->lastInsertId();
    return findUserById($id);
}

// =========================================================================
// SSO account resolution (Microsoft / Google) — explicit linking policy
// =========================================================================

/**
 * Resolves an OAuth callback's verified identity to exactly one `users`
 * row, per FEAT-002's "Account model / migration constraint": never
 * silently create a duplicate user for an email that already has one.
 *
 *  1. Known identity (provider + provider_user_id already linked) → that user.
 *  2. Else, a user already exists with this verified email → link this
 *     identity to that existing user (covers: registered locally first,
 *     now also signing in via Microsoft/Google with the same address).
 *  3. Else → create a brand-new user. SSO providers verify the email
 *     themselves before returning it, so email_verified_at is set
 *     immediately (no separate confirmation link needed for SSO signups).
 *
 * @return array the full users row (as findUserById returns)
 */
function resolveSsoUser(string $provider, string $providerUserId, string $email, string $name): array
{
    $pdo = getPdo();
    $email = strtolower(trim($email));

    $identStmt = $pdo->prepare(
        'SELECT user_id FROM user_identities WHERE provider = ? AND provider_user_id = ? LIMIT 1'
    );
    $identStmt->execute([$provider, $providerUserId]);
    $ident = $identStmt->fetch();

    if ($ident) {
        $user = findUserById((int)$ident['user_id']);
        if ($user !== null) {
            return $user;
        }
        // Identity row pointed at a since-deleted user — fall through and
        // re-resolve/create as if this were a first-time sign-in.
    }

    $existing = findUserByEmail($email);
    if ($existing !== null) {
        $userId = (int)$existing['id'];
        $link = $pdo->prepare(
            'INSERT IGNORE INTO user_identities (user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?)'
        );
        $link->execute([$userId, $provider, $providerUserId, $email]);
        // The provider has (re-)verified ownership of this address —
        // reflect that even if the local account had never verified it.
        if ($existing['email_verified_at'] === null) {
            markEmailVerified($userId);
        }
        return findUserById($userId);
    }

    // Brand new user via SSO.
    $roleId = (countUsers() === 0)
        ? (getSystemAdminRoleId() ?? getDefaultRoleId())
        : getDefaultRoleId();

    $pdo->beginTransaction();
    try {
        $ins = $pdo->prepare(
            'INSERT INTO users (name, email, role_id, status, email_verified_at) VALUES (?, ?, ?, "active", NOW())'
        );
        $ins->execute([trim($name) !== '' ? trim($name) : $email, $email, $roleId]);
        $userId = (int)$pdo->lastInsertId();
        $link = $pdo->prepare(
            'INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?)'
        );
        $link->execute([$userId, $provider, $providerUserId, $email]);
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    return findUserById($userId);
}

// =========================================================================
// Profile self-service (name / email / password)
// =========================================================================

function updateUserName(int $id, string $name): void
{
    $stmt = getPdo()->prepare('UPDATE users SET name = ? WHERE id = ?');
    $stmt->execute([trim($name), $id]);
}

/** Stages an email change — takes effect only once the new address is confirmed. */
function setPendingEmail(int $id, string $newEmail): void
{
    $stmt = getPdo()->prepare('UPDATE users SET pending_email = ? WHERE id = ?');
    $stmt->execute([strtolower(trim($newEmail)), $id]);
}

function markEmailVerified(int $id): void
{
    $stmt = getPdo()->prepare('UPDATE users SET email_verified_at = NOW() WHERE id = ?');
    $stmt->execute([$id]);
}

/** Applies a previously-staged pending_email as the new live email. */
function applyPendingEmail(int $id): void
{
    $stmt = getPdo()->prepare(
        'UPDATE users SET email = pending_email, pending_email = NULL, email_verified_at = NOW()
         WHERE id = ? AND pending_email IS NOT NULL'
    );
    $stmt->execute([$id]);
}

function updateUserPasswordHash(int $id, string $passwordHash): void
{
    $stmt = getPdo()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->execute([$passwordHash, $id]);
}

// =========================================================================
// Email verification tokens (registration + email change)
// =========================================================================

/** @return string the RAW token — email it, never store it */
function createEmailVerificationToken(int $userId, string $purpose = 'verify_registration'): string
{
    $raw = generateRawToken();
    $expiresAt = (new \DateTimeImmutable('now'))
        ->modify('+' . EMAIL_VERIFICATION_TTL_SECONDS . ' seconds')
        ->format('Y-m-d H:i:s');
    $stmt = getPdo()->prepare(
        'INSERT INTO email_verification_tokens (user_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$userId, hashToken($raw), $purpose, $expiresAt]);
    return $raw;
}

/**
 * Validates + consumes a raw verification token. Returns the token's
 * {userId, purpose} on success, or null if invalid/expired/already used.
 * Applies the effect (mark verified, or apply a pending email change) here
 * too, so callers can't forget to.
 */
function consumeEmailVerificationToken(string $rawToken): ?array
{
    $pdo = getPdo();
    $stmt = $pdo->prepare(
        'SELECT id, user_id, purpose, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ? LIMIT 1'
    );
    $stmt->execute([hashToken($rawToken)]);
    $row = $stmt->fetch();
    if (!$row) return null;
    if ($row['used_at'] !== null) return null;
    if (strtotime((string)$row['expires_at']) < time()) return null;

    $mark = $pdo->prepare('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?');
    $mark->execute([$row['id']]);

    $userId = (int)$row['user_id'];
    if ($row['purpose'] === 'verify_email_change') {
        applyPendingEmail($userId);
    } else {
        markEmailVerified($userId);
    }

    return ['userId' => $userId, 'purpose' => $row['purpose']];
}

// =========================================================================
// Password reset tokens (also used to set a first local password for an
// SSO-only account — see api/index.php's /auth/forgot-password comment)
// =========================================================================

/** @return string the RAW token — email it, never store it */
function createPasswordResetToken(int $userId): string
{
    $raw = generateRawToken();
    $expiresAt = (new \DateTimeImmutable('now'))
        ->modify('+' . PASSWORD_RESET_TTL_SECONDS . ' seconds')
        ->format('Y-m-d H:i:s');
    $stmt = getPdo()->prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    );
    $stmt->execute([$userId, hashToken($raw), $expiresAt]);
    return $raw;
}

/** @return int|null the user_id on success, or null if invalid/expired/used */
function peekPasswordResetToken(string $rawToken): ?int
{
    $stmt = getPdo()->prepare(
        'SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1'
    );
    $stmt->execute([hashToken($rawToken)]);
    $row = $stmt->fetch();
    if (!$row || $row['used_at'] !== null || strtotime((string)$row['expires_at']) < time()) {
        return null;
    }
    return (int)$row['user_id'];
}

/**
 * Validates the token, sets the new password, marks this and every other
 * outstanding reset token for that user as used (an old, still-valid email
 * link should stop working the moment a newer one has been acted on), and
 * marks the email verified (the user just proved mailbox ownership).
 *
 * @return int|null the user_id on success, or null if the token was invalid
 */
function resetPasswordWithToken(string $rawToken, string $newPassword): ?int
{
    validatePassword($newPassword);
    $userId = peekPasswordResetToken($rawToken);
    if ($userId === null) return null;

    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        updateUserPasswordHash($userId, hashPassword($newPassword));
        if (findUserById($userId)['email_verified_at'] === null) {
            markEmailVerified($userId);
        }
        $inval = $pdo->prepare(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL'
        );
        $inval->execute([$userId]);
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return $userId;
}

// =========================================================================
// Admin: user list + role/status management
// =========================================================================

function listUsers(): array
{
    $rows = getPdo()->query(
        'SELECT u.id, u.name, u.email, u.status, u.email_verified_at, u.last_login_at, u.created_at,
            r.id AS role_id, r.name AS role_name
         FROM users u JOIN roles r ON r.id = u.role_id
         ORDER BY u.created_at ASC'
    )->fetchAll();
    return array_map(fn($r) => [
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'email' => $r['email'],
        'status' => $r['status'],
        'emailVerified' => $r['email_verified_at'] !== null,
        'role' => ['id' => (int)$r['role_id'], 'name' => $r['role_name']],
        'lastLoginAt' => $r['last_login_at'],
        'createdAt' => $r['created_at'],
    ], $rows);
}

function countActiveUsersWithRole(int $roleId): int
{
    $stmt = getPdo()->prepare("SELECT COUNT(*) AS c FROM users WHERE role_id = ? AND status = 'active'");
    $stmt->execute([$roleId]);
    return (int)$stmt->fetch()['c'];
}

/**
 * @throws \RuntimeException if this change would leave zero active users
 *         able to reach the admin UI at all (see Guard.php's caller)
 */
function setUserRole(int $userId, int $newRoleId): void
{
    $user = findUserById($userId);
    if ($user === null) throw new \RuntimeException("Utilisateur introuvable.");

    $systemRoleId = getSystemAdminRoleId();
    if ($systemRoleId !== null && (int)$user['role_id'] === $systemRoleId && $newRoleId !== $systemRoleId) {
        if (countActiveUsersWithRole($systemRoleId) <= 1) {
            throw new \RuntimeException(
                "Impossible de retirer ce rôle : c'est le dernier administrateur système actif. " .
                "Attribuez d'abord ce rôle à un autre utilisateur."
            );
        }
    }

    $stmt = getPdo()->prepare('UPDATE users SET role_id = ? WHERE id = ?');
    $stmt->execute([$newRoleId, $userId]);
}

/** @throws \RuntimeException with the same last-admin protection as setUserRole */
function setUserStatus(int $userId, string $status): void
{
    if (!in_array($status, ['active', 'disabled'], true)) {
        throw new \RuntimeException("Statut invalide.");
    }
    $user = findUserById($userId);
    if ($user === null) throw new \RuntimeException("Utilisateur introuvable.");

    if ($status === 'disabled') {
        $systemRoleId = getSystemAdminRoleId();
        if ($systemRoleId !== null && (int)$user['role_id'] === $systemRoleId
            && countActiveUsersWithRole($systemRoleId) <= 1) {
            throw new \RuntimeException(
                "Impossible de désactiver ce compte : c'est le dernier administrateur système actif."
            );
        }
    }

    $stmt = getPdo()->prepare('UPDATE users SET status = ? WHERE id = ?');
    $stmt->execute([$status, $userId]);
}
