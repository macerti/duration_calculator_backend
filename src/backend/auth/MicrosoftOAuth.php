<?php
declare(strict_types=1);

namespace AuditEngine\Auth;

/**
 * Microsoft Entra ID (Azure AD) OAuth 2.0 / OIDC handler.
 *
 * Uses the authorization code flow (server-side):
 *   1. buildAuthUrl() → redirect the browser here to start login
 *   2. handleCallback($code, $state) → called on the redirect back from Microsoft
 *
 * References:
 *   https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 */

const MS_AUTHORITY    = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const MS_TOKEN_URL    = MS_AUTHORITY . '/token';
const MS_GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me';

/**
 * Build the Microsoft authorization URL. Redirect the browser here.
 *
 * @param  string $clientId     Azure Application (client) ID
 * @param  string $redirectUri  Must match what's registered in Azure Portal
 * @param  string $state        Random string (CSRF token) — store in session before redirecting
 * @return string               The full URL to redirect the browser to
 */
function microsoftBuildAuthUrl(string $clientId, string $redirectUri, string $state): string
{
    $params = http_build_query([
        'client_id'     => $clientId,
        'response_type' => 'code',
        'redirect_uri'  => $redirectUri,
        'response_mode' => 'query',
        'scope'         => 'openid profile email',
        'state'         => $state,
        // prompt=select_account forces Microsoft to show the account picker,
        // even if the user already has a session — useful for multi-account environments.
        'prompt'        => 'select_account',
    ]);
    return MS_AUTHORITY . '/authorize?' . $params;
}

/**
 * Exchange the authorization code for user identity.
 *
 * @param  string $clientId     Azure Application (client) ID
 * @param  string $clientSecret Azure client secret value
 * @param  string $redirectUri  Same URI used in buildAuthUrl
 * @param  string $code         The 'code' query param from Microsoft's redirect
 * @return array{id:string,name:string,email:string,provider:string}
 * @throws \RuntimeException on any failure
 */
function microsoftHandleCallback(
    string $clientId,
    string $clientSecret,
    string $redirectUri,
    string $code
): array {
    // 1. Exchange code → access token
    $tokenResponse = _microsoftHttpPost(MS_TOKEN_URL, [
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'code'          => $code,
        'redirect_uri'  => $redirectUri,
        'grant_type'    => 'authorization_code',
    ]);

    if (empty($tokenResponse['access_token'])) {
        throw new \RuntimeException('Microsoft token exchange failed: ' . json_encode($tokenResponse));
    }

    $accessToken = $tokenResponse['access_token'];

    // 2. Fetch user profile from Microsoft Graph
    $me = _microsoftHttpGet(MS_GRAPH_ME_URL, $accessToken);

    $id    = $me['id'] ?? null;
    $name  = $me['displayName'] ?? ($me['givenName'] . ' ' . $me['surname'] ?? '');
    $email = $me['mail'] ?? $me['userPrincipalName'] ?? null;

    if (!$id || !$email) {
        throw new \RuntimeException('Microsoft Graph did not return required user fields: ' . json_encode($me));
    }

    return [
        'id'       => 'ms_' . $id,
        'name'     => trim((string)$name),
        'email'    => strtolower((string)$email),
        'provider' => 'microsoft',
    ];
}

/** @internal POST to a URL with form-encoded body, return decoded JSON array. */
function _microsoftHttpPost(string $url, array $data): array
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
    if ($err) throw new \RuntimeException('Microsoft token HTTP error: ' . $err);
    return json_decode((string)$body, true) ?? [];
}

/** @internal GET a URL with Bearer token, return decoded JSON array. */
function _microsoftHttpGet(string $url, string $accessToken): array
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
    if ($err) throw new \RuntimeException('Microsoft Graph HTTP error: ' . $err);
    return json_decode((string)$body, true) ?? [];
}
