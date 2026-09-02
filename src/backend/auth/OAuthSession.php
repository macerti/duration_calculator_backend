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
 * Store a signed-in user in the session.
 */
function sessionSetUser(array $user): void
{
    sessionStart();
    // Regenerate ID on privilege escalation to prevent session fixation.
    session_regenerate_id(true);
    $_SESSION['auth_user'] = $user;
}

/**
 * Return the signed-in user, or null if not authenticated.
 *
 * @return array{id:string,name:string,email:string,provider:string}|null
 */
function sessionGetUser(): ?array
{
    sessionStart();
    $u = $_SESSION['auth_user'] ?? null;
    if (!is_array($u)) return null;
    return $u;
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
