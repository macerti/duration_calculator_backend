<?php
declare(strict_types=1);

namespace AuditEngine\Auth;

/**
 * Secure server-side session management for SSO.
 *
 * Uses PHP sessions with HttpOnly + SameSite=Lax cookies.
 * The client never sees the user identity directly in JS —
 * the /api/auth/me endpoint is the only way to read it.
 */

/**
 * Start the PHP session with secure cookie parameters.
 * Call this before any session read/write, not before header output.
 */
function sessionStart(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;

    // SameSite=Lax allows cookies to be sent on top-level navigations
    // (the OAuth redirect back from Microsoft/Google), but not on
    // cross-origin sub-resource requests — a reasonable default.
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,           // session cookie — clears on browser close
        'path'     => '/',
        'domain'   => '',          // current domain
        'secure'   => $secure,     // only over HTTPS in production
        'httponly' => true,        // not accessible by JavaScript
        'samesite' => 'Lax',       // sent on top-level navigation, not sub-requests
    ]);

    session_start();
}

/**
 * Store a signed-in user's ID in the session.
 *
 * 2026-09-04 change: the session used to hold the entire user array
 * (raw OAuth provider claims — there was no `users` table at all). Now
 * that real accounts + roles/permissions exist, the session holds only
 * the numeric user_id; Guard.php's currentUser() loads the rest fresh
 * from the database on every request, so a role change or an admin
 * disabling the account takes effect immediately, not just after the
 * next login. Also generates this session's CSRF token (see Guard.php).
 */
function sessionSetUserId(int $userId): void
{
    sessionStart();
    // Regenerate ID on privilege escalation to prevent session fixation.
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    ensureCsrfToken();
}

/**
 * Return the signed-in user's ID, or null if no session is active.
 * Does NOT check whether the account still exists or is active —
 * that's Guard.php's currentUser()'s job, since it needs a DB lookup.
 */
function sessionGetUserId(): ?int
{
    sessionStart();
    $id = $_SESSION['user_id'] ?? null;
    return is_int($id) ? $id : (is_numeric($id) ? (int)$id : null);
}

/**
 * Destroy the session (logout).
 */
function sessionDestroy(): void
{
    sessionStart();
    session_unset();
    session_destroy();
    // Clear the session cookie from the browser.
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
}

/**
 * Store/retrieve the OAuth state parameter (CSRF protection).
 */
function sessionSetOAuthState(string $state, string $provider): void
{
    sessionStart();
    $_SESSION['oauth_state']    = $state;
    $_SESSION['oauth_provider'] = $provider;
}

function sessionGetOAuthState(): ?string
{
    sessionStart();
    return $_SESSION['oauth_state'] ?? null;
}

function sessionClearOAuthState(): void
{
    sessionStart();
    unset($_SESSION['oauth_state'], $_SESSION['oauth_provider']);
}

/**
 * Produce a client-safe, length-capped version of an internal OAuth
 * exception message, for display in the callback's error banner (see
 * BUG-039 in docs/BUGLOG.md).
 *
 * Same deliberate, scoped tradeoff already documented in SECURITY.md for
 * forwarding the provider's own `error_description` (BUG-038): this app
 * has exactly one person who will ever see this banner and no reliable
 * channel back to a session that can read host error logs, so limiting
 * this to "log server-side only" would stall every token-exchange
 * failure the same way BUG-030/031 stalled on host access.
 *
 * Safe to forward: `microsoftHandleCallback()`/`googleHandleCallback()`
 * only ever throw with either (a) the provider's own HTTP/JSON response
 * body, or (b) a curl transport error string — never our config values.
 * The client secret is sent as an outgoing request field and is never
 * echoed back by either provider's token endpoint on success or failure.
 */
function oauthClientSafeErrorDetail(string $message): string
{
    $max = 400;
    if (strlen($message) <= $max) {
        return $message;
    }
    return substr($message, 0, $max) . '…';
}
