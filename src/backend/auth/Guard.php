<?php
declare(strict_types=1);

namespace AuditEngine\Auth;

use function AuditEngine\getPdo;
use function AuditEngine\getUserProfile;

/**
 * Auth/permission/CSRF guards for api/index.php. Session stores ONLY
 * user_id (see OAuthSession::sessionSetUser) — role and permissions are
 * always loaded fresh from the DB here, so an admin's role change, a
 * permission revocation, or disabling an account takes effect on that
 * user's very next request, not only after they log out and back in.
 *
 * Closes SECURITY.md's "Todo #1 — the single biggest gap": every route
 * that touches persisted business data now goes through requireAuth()
 * (see api/index.php's /clients and /cases routes).
 */

/**
 * Loads the current user's full profile if the session is valid and the
 * account is still active, else null. Never throws.
 */
function currentUser(): ?array
{
    sessionStart();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $profile = getUserProfile((int)$_SESSION['user_id']);
    if ($profile === null || $profile['status'] !== 'active') {
        return null;
    }
    return $profile;
}

/**
 * Ends the request with 401 if not authenticated. Call at the top of any
 * route handler that requires a signed-in user.
 */
function requireAuth(): array
{
    $user = currentUser();
    if ($user === null) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Authentification requise.']);
        exit;
    }
    return $user;
}

/**
 * Ends the request with 401 (not signed in) or 403 (signed in, missing
 * permission) as appropriate. Call at the top of any route handler gated
 * behind a specific function (e.g. requirePermission('manage_users')).
 */
function requirePermission(string $permissionKey): array
{
    $user = requireAuth();
    if (!in_array($permissionKey, $user['permissions'], true)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Vous n\'avez pas les droits nécessaires pour cette action.']);
        exit;
    }
    return $user;
}

/**
 * Double-submit CSRF check for state-changing requests made by an already
 * authenticated session (SameSite=Lax on the session cookie already blocks
 * the classic cross-site form POST vector; this is defense-in-depth on
 * top of that, per SECURITY.md's own recommendation once real accounts
 * with real consequences — role changes, disabling users — exist).
 *
 * The token is generated once per session (see ensureCsrfToken, called
 * from login/register/SSO callback) and returned to the frontend by
 * /auth/me; the frontend echoes it back as the X-CSRF-Token header on
 * every mutating request. Safe (GET) requests never need it.
 *
 * Applied so far to the new /auth/* (state-changing) and /admin/* routes.
 * NOT YET applied to the pre-existing /clients and /cases mutating routes
 * — recorded as the natural next step in docs/DEV_STATUS.md, not silently
 * skipped.
 */
function requireCsrf(): void
{
    sessionStart();
    $expected = $_SESSION['csrf_token'] ?? null;
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$expected || !is_string($provided) || !hash_equals((string)$expected, $provided)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Jeton de sécurité invalide ou manquant. Rechargez la page et réessayez.']);
        exit;
    }
}

/** Generates the session's CSRF token if it doesn't already have one. */
function ensureCsrfToken(): string
{
    sessionStart();
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}
