<?php
declare(strict_types=1);

namespace AuditEngine\Auth;

/**
 * Google OAuth 2.0 / OIDC handler.
 *
 * Uses the authorization code flow (server-side):
 *   1. googleBuildAuthUrl() → redirect the browser here to start login
 *   2. googleHandleCallback($code) → called on the redirect back from Google
 *
 * References:
 *   https://developers.google.com/identity/openid-connect/openid-connect
 */

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ME_URL    = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * Build the Google authorization URL. Redirect the browser here.
 *
 * @param  string $clientId    Google OAuth client ID
 * @param  string $redirectUri Must match what's registered in Google Cloud Console
 * @param  string $state       Random string (CSRF token) — store in session before redirecting
 * @return string              The full URL to redirect the browser to
 */
function googleBuildAuthUrl(string $clientId, string $redirectUri, string $state): string
{
    $params = http_build_query([
        'client_id'     => $clientId,
        'redirect_uri'  => $redirectUri,
        'response_type' => 'code',
        'scope'         => 'openid profile email',
        'state'         => $state,
        // access_type=online: we only need a one-time identity, no refresh token
        'access_type'   => 'online',
        // prompt=select_account: shows Google account chooser even if already signed in
        'prompt'        => 'select_account',
    ]);
    return GOOGLE_AUTH_URL . '?' . $params;
}

/**
 * Exchange the authorization code for user identity.
 *
 * @param  string $clientId     Google OAuth client ID
 * @param  string $clientSecret Google OAuth client secret
 * @param  string $redirectUri  Same URI used in googleBuildAuthUrl
 * @param  string $code         The 'code' query param from Google's redirect
 * @return array{id:string,name:string,email:string,provider:string}
 * @throws \RuntimeException on any failure
 */
function googleHandleCallback(
    string $clientId,
    string $clientSecret,
    string $redirectUri,
    string $code
): array {
    // 1. Exchange code → access token
    $tokenResponse = _googleHttpPost(GOOGLE_TOKEN_URL, [
        'code'          => $code,
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri'  => $redirectUri,
        'grant_type'    => 'authorization_code',
    ]);

    if (empty($tokenResponse['access_token'])) {
        throw new \RuntimeException('Google token exchange failed: ' . json_encode($tokenResponse));
    }

    $accessToken = $tokenResponse['access_token'];

    // 2. Fetch user profile from Google's UserInfo endpoint
    $me = _googleHttpGet(GOOGLE_ME_URL, $accessToken);

    $id    = $me['sub'] ?? null;      // 'sub' is the stable Google user ID
    $name  = $me['name'] ?? '';
    $email = $me['email'] ?? null;

    if (!$id || !$email) {
        throw new \RuntimeException('Google did not return required user fields: ' . json_encode($me));
    }

    return [
        'id'       => 'g_' . $id,
        'name'     => trim((string)$name),
        'email'    => strtolower((string)$email),
        'provider' => 'google',
    ];
}

/** @internal POST to a URL with form-encoded body, return decoded JSON array. */
function _googleHttpPost(string $url, array $data): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($data),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err) throw new \RuntimeException('Google token HTTP error: ' . $err);
    return json_decode((string)$body, true) ?? [];
}

/** @internal GET a URL with Bearer token, return decoded JSON array. */
function _googleHttpGet(string $url, string $accessToken): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err) throw new \RuntimeException('Google userinfo HTTP error: ' . $err);
    return json_decode((string)$body, true) ?? [];
}
