<?php
declare(strict_types=1);

require_once __DIR__ . '/../data/parameters.php';
require_once __DIR__ . '/../engine/nae.php';
require_once __DIR__ . '/../engine/duration.php';
require_once __DIR__ . '/../engine/factors.php';
require_once __DIR__ . '/../engine/synergy.php';
require_once __DIR__ . '/../engine/cycle.php';
require_once __DIR__ . '/../engine/orgRisk.php';
require_once __DIR__ . '/../engine/standardDuration.php';
require_once __DIR__ . '/../engine/case.php';
require_once __DIR__ . '/../engine/nace.php';
require_once __DIR__ . '/../db/pdo.php';
require_once __DIR__ . '/../db/parameterSetRepo.php';
require_once __DIR__ . '/../db/calculationCaseRepo.php';
require_once __DIR__ . '/../db/clientRepo.php';
require_once __DIR__ . '/../auth/OAuthSession.php';
require_once __DIR__ . '/../auth/MicrosoftOAuth.php';
require_once __DIR__ . '/../auth/GoogleOAuth.php';

use function AuditEngine\loadDefaultParameterSet;
use function AuditEngine\loadConfig;
use function AuditEngine\pingDb;
use function AuditEngine\getActiveParameterSet;
use function AuditEngine\calculateNae;
use function AuditEngine\calculateCase;
use function AuditEngine\findNaceEntry;
use function AuditEngine\searchNaceByDescription;
use function AuditEngine\saveCalculationCase;
use function AuditEngine\updateCalculationCase;
use function AuditEngine\listCalculationCases;
use function AuditEngine\getCalculationCase;
use function AuditEngine\createClient;
use function AuditEngine\listClients;
use function AuditEngine\getClient;
use function AuditEngine\updateClientName;
use function AuditEngine\deleteClient;
use function AuditEngine\deleteCalculationCase;
use function AuditEngine\Auth\sessionStart;
use function AuditEngine\Auth\sessionSetUser;
use function AuditEngine\Auth\sessionGetUser;
use function AuditEngine\Auth\sessionDestroy;
use function AuditEngine\Auth\sessionSetOAuthState;
use function AuditEngine\Auth\sessionGetOAuthState;
use function AuditEngine\Auth\sessionClearOAuthState;
use function AuditEngine\Auth\microsoftBuildAuthUrl;
use function AuditEngine\Auth\microsoftHandleCallback;
use function AuditEngine\Auth\googleBuildAuthUrl;
use function AuditEngine\Auth\googleHandleCallback;

// --- CORS ---
$config = null;
try { $config = loadConfig(); } catch (\Throwable $e) { /* config.php not set up yet — degrade gracefully below */ }
$allowedOrigins = $config['allowedOrigins'] ?? ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
if (in_array('*', $allowedOrigins, true) || in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . ($allowedOrigins === ['*'] ? '*' : $origin));
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Server-side length enforcement — the frontend already validates these,
 * but a request never has to come from the frontend. Caps match the DB
 * column sizes (see schema.sql) so we truncate/reject before MySQL would
 * have to, rather than relying on whatever the host's SQL strict-mode
 * setting happens to do with an oversized value.
 */
function requireNonEmptyString(string $value, string $fieldName, int $maxLen): string
{
    $trimmed = trim($value);
    if ($trimmed === '') respond(['error' => "'$fieldName' is required"], 400);
    if (mb_strlen($trimmed) > $maxLen) respond(['error' => "'$fieldName' must be $maxLen characters or fewer"], 400);
    return $trimmed;
}

function respond($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requireDb(bool $dbAvailable): void
{
    if (!$dbAvailable) {
        respond(['error' => 'Database not configured/available.'], 503);
    }
}

// --- Params: DB-backed if available, else in-memory bootstrap ---
$dbAvailable = false;
$params = loadDefaultParameterSet();
if (pingDb()) {
    $active = getActiveParameterSet();
    if ($active !== null) {
        $params = $active;
        $dbAvailable = true;
    }
}

// --- Routing ---
// Base path comes from explicit config, not from dirname($_SERVER['SCRIPT_NAME']).
// SCRIPT_NAME is set inconsistently by PHP's built-in dev server for
// router-script requests: it depends on whether the router script argument
// passed to `php -S` includes a directory component, which has nothing to
// do with the actual deployment topology. See BUG-030 in docs/BUGLOG.md —
// this silently broke every multi-segment route (/nace/*, /cases/:id) under
// some invocations of `php -S` but not others, while apparently working
// under real Apache + mod_rewrite (SCRIPT_NAME behaves consistently there).
// A fixed config value removes the ambiguity entirely: empty for local/dev
// testing (API served at the origin root), the real deployment subpath in
// production (e.g. '/duration_calculator/api').
$basePath = rtrim($config['basePath'] ?? '', '/');
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$path = $requestPath;
if ($basePath !== '' && str_starts_with($path, $basePath)) {
    $path = substr($path, strlen($basePath));
}
$path = '/' . ltrim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

$segments = array_values(array_filter(explode('/', $path), fn($s) => $s !== ''));

try {
    if ($method === 'GET' && $segments === ['health']) {
        respond([
            'status' => 'ok',
            'parameterSetId' => $params['id'],
            'version' => $params['version'],
            'dbConnected' => pingDb(),
            'dbBackedParameters' => $dbAvailable,
        ]);
    }

    if ($method === 'GET' && $segments === ['parameters']) {
        respond($params);
    }

    if ($method === 'GET' && $segments === ['nace', 'search']) {
        $q = $_GET['q'] ?? '';
        if ($q === '') respond(['error' => "query param 'q' is required"], 400);
        respond(searchNaceByDescription($q, $params));
    }

    if ($method === 'GET' && count($segments) === 2 && $segments[0] === 'nace') {
        $code = $segments[1];
        $entry = findNaceEntry($code, $params);
        if ($entry === null) respond(['error' => "No NACE entry for code $code"], 404);
        respond($entry);
    }

    if ($method === 'POST' && $segments === ['nae']) {
        respond(calculateNae(jsonBody()));
    }

    if ($method === 'POST' && $segments === ['calculate']) {
        respond(calculateCase(jsonBody(), $params));
    }

    // --- Clients ---
    if ($method === 'POST' && $segments === ['clients']) {
        requireDb($dbAvailable);
        $body = jsonBody();
        $name = requireNonEmptyString($body['name'] ?? '', 'name', 255);
        $id = createClient($name);
        respond(['id' => $id, 'name' => $name], 201);
    }

    if ($method === 'GET' && $segments === ['clients']) {
        requireDb($dbAvailable);
        respond(listClients());
    }

    if ($method === 'GET' && count($segments) === 2 && $segments[0] === 'clients') {
        requireDb($dbAvailable);
        $id = (int)$segments[1];
        $client = getClient($id);
        if ($client === null) respond(['error' => "No client with id $id"], 404);
        respond($client);
    }

    if ($method === 'PUT' && count($segments) === 2 && $segments[0] === 'clients') {
        requireDb($dbAvailable);
        $id = (int)$segments[1];
        $body = jsonBody();
        $name = requireNonEmptyString($body['name'] ?? '', 'name', 255);
        updateClientName($id, $name);
        respond(['id' => $id, 'name' => $name]);
    }

    if ($method === 'DELETE' && count($segments) === 2 && $segments[0] === 'clients') {
        requireDb($dbAvailable);
        $id = (int)$segments[1];
        deleteClient($id);
        respond(['deleted' => $id]);
    }

    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'clients' && $segments[2] === 'cases') {
        requireDb($dbAvailable);
        $clientId = (int)$segments[1];
        respond(listCalculationCases(50, $clientId));
    }

    // --- Calculation cases ---
    if ($method === 'POST' && $segments === ['cases']) {
        requireDb($dbAvailable);
        $body = jsonBody();
        $wizardState = $body['wizardState'] ?? null;
        $input = $body;
        unset($input['wizardState']);
        if (isset($input['dossierRef'])) {
            $input['dossierRef'] = requireNonEmptyString((string)$input['dossierRef'], 'dossierRef', 128);
        }
        $clientId = isset($input['clientId']) ? (int)$input['clientId'] : null;
        $status = $input['status'] ?? 'draft';
        $result = calculateCase($input, $params);
        $id = saveCalculationCase($input, $result, $clientId, $status, $wizardState);
        respond(['id' => $id, 'result' => $result], 201);
    }

    if ($method === 'PUT' && count($segments) === 2 && $segments[0] === 'cases') {
        requireDb($dbAvailable);
        $id = (int)$segments[1];
        $body = jsonBody();
        $input = $body['input'] ?? [];
        if (isset($input['dossierRef'])) {
            $input['dossierRef'] = requireNonEmptyString((string)$input['dossierRef'], 'dossierRef', 128);
        }
        $status = $body['status'] ?? null;
        $roundingOverrides = $body['roundingOverrides'] ?? null;
        $wizardState = $body['wizardState'] ?? null;
        $result = calculateCase($input, $params);
        updateCalculationCase($id, $input, $result, $status, $roundingOverrides, $wizardState);
        respond(['id' => $id, 'result' => $result]);
    }

    if ($method === 'DELETE' && count($segments) === 2 && $segments[0] === 'cases') {
        requireDb($dbAvailable);
        $id = (int)$segments[1];
        deleteCalculationCase($id);
        respond(['deleted' => $id]);
    }

    if ($method === 'GET' && $segments === ['cases']) {
        requireDb($dbAvailable);
        respond(listCalculationCases());
    }

    if ($method === 'GET' && count($segments) === 2 && $segments[0] === 'cases') {
        requireDb($dbAvailable);
        $id = (int)$segments[1];
        $found = getCalculationCase($id);
        if ($found === null) respond(['error' => "No case with id $id"], 404);
        respond($found);
    }

    // =========================================================
    // AUTH ROUTES — OAuth 2.0 / OIDC sign-in (Microsoft + Google)
    // =========================================================

    // GET /auth/me — return current signed-in user, or 401
    if ($method === 'GET' && $segments === ['auth', 'me']) {
        // Auth routes always return JSON — no redirect, no HTML.
        $user = sessionGetUser();
        if ($user === null) {
            respond(['error' => 'Not authenticated'], 401);
        }
        respond($user);
    }

    // POST /auth/logout — destroy session
    if ($method === 'POST' && $segments === ['auth', 'logout']) {
        sessionDestroy();
        respond(['ok' => true]);
    }

    // GET /auth/microsoft — start Microsoft OIDC flow
    if ($method === 'GET' && $segments === ['auth', 'microsoft']) {
        $clientId = $config['microsoft_client_id'] ?? '';
        if ($clientId === '') {
            respond(['error' => 'Microsoft SSO is not configured on this server.'], 501);
        }
        $state       = bin2hex(random_bytes(16));
        $redirectUri = ($config['app_url'] ?? '') . '/api/auth/callback/microsoft';
        sessionSetOAuthState($state, 'microsoft');
        // Redirect — not JSON. Auth routes are browser redirects, not AJAX.
        header('Content-Type: text/html; charset=utf-8', true);
        header('Location: ' . microsoftBuildAuthUrl($clientId, $redirectUri, $state));
        http_response_code(302);
        exit;
    }

    // GET /auth/google — start Google OAuth flow
    if ($method === 'GET' && $segments === ['auth', 'google']) {
        $clientId = $config['google_client_id'] ?? '';
        if ($clientId === '') {
            respond(['error' => 'Google SSO is not configured on this server.'], 501);
        }
        $state       = bin2hex(random_bytes(16));
        $redirectUri = ($config['app_url'] ?? '') . '/api/auth/callback/google';
        sessionSetOAuthState($state, 'google');
        header('Content-Type: text/html; charset=utf-8', true);
        header('Location: ' . googleBuildAuthUrl($clientId, $redirectUri, $state));
        http_response_code(302);
        exit;
    }

    // GET /auth/callback/microsoft — Microsoft redirects here after login
    if ($method === 'GET' && $segments === ['auth', 'callback', 'microsoft']) {
        header('Content-Type: text/html; charset=utf-8', true);
        $appUrl = rtrim($config['app_url'] ?? '', '/');

        $incomingState     = $_GET['state'] ?? '';
        $expectedState     = sessionGetOAuthState();
        $code              = $_GET['code'] ?? '';
        $error             = $_GET['error'] ?? '';
        $errorDescription  = $_GET['error_description'] ?? '';

        if ($error) {
            // Microsoft itself rejected the request (this fires from Microsoft's
            // own redirect, before our code ever runs) — always log the full
            // error_description server-side (it carries the AADSTS code that
            // actually explains why), per this project's "log detail
            // server-side, keep the client message generic-but-useful" standard.
            error_log('[duration_calculator] Microsoft OAuth error from provider: ' . $error
                . ($errorDescription !== '' ? ' — ' . $errorDescription : ''));
            sessionClearOAuthState();
            $redirect = $appUrl . '/?auth_error=' . urlencode($error);
            if ($errorDescription !== '') {
                $redirect .= '&auth_error_description=' . urlencode($errorDescription);
            }
            header('Location: ' . $redirect);
            http_response_code(302); exit;
        }

        if (!$incomingState || $incomingState !== $expectedState) {
            sessionClearOAuthState();
            header('Location: ' . $appUrl . '/?auth_error=state_mismatch');
            http_response_code(302); exit;
        }

        sessionClearOAuthState();

        try {
            $user = microsoftHandleCallback(
                $config['microsoft_client_id'],
                $config['microsoft_client_secret'],
                $appUrl . '/api/auth/callback/microsoft',
                $code
            );
            sessionSetUser($user);
            header('Location: ' . $appUrl . '/?auth=ok');
        } catch (\Throwable $e) {
            error_log('[duration_calculator] Microsoft OAuth error: ' . $e->getMessage());
            header('Location: ' . $appUrl . '/?auth_error=callback_failed');
        }
        http_response_code(302);
        exit;
    }

    // GET /auth/callback/google — Google redirects here after login
    if ($method === 'GET' && $segments === ['auth', 'callback', 'google']) {
        header('Content-Type: text/html; charset=utf-8', true);
        $appUrl = rtrim($config['app_url'] ?? '', '/');

        $incomingState     = $_GET['state'] ?? '';
        $expectedState     = sessionGetOAuthState();
        $code              = $_GET['code'] ?? '';
        $error             = $_GET['error'] ?? '';
        $errorDescription  = $_GET['error_description'] ?? '';

        if ($error) {
            error_log('[duration_calculator] Google OAuth error from provider: ' . $error
                . ($errorDescription !== '' ? ' — ' . $errorDescription : ''));
            sessionClearOAuthState();
            $redirect = $appUrl . '/?auth_error=' . urlencode($error);
            if ($errorDescription !== '') {
                $redirect .= '&auth_error_description=' . urlencode($errorDescription);
            }
            header('Location: ' . $redirect);
            http_response_code(302); exit;
        }

        if (!$incomingState || $incomingState !== $expectedState) {
            sessionClearOAuthState();
            header('Location: ' . $appUrl . '/?auth_error=state_mismatch');
            http_response_code(302); exit;
        }

        sessionClearOAuthState();

        try {
            $user = googleHandleCallback(
                $config['google_client_id'],
                $config['google_client_secret'],
                $appUrl . '/api/auth/callback/google',
                $code
            );
            sessionSetUser($user);
            header('Location: ' . $appUrl . '/?auth=ok');
        } catch (\Throwable $e) {
            error_log('[duration_calculator] Google OAuth error: ' . $e->getMessage());
            header('Location: ' . $appUrl . '/?auth_error=callback_failed');
        }
        http_response_code(302);
        exit;
    }

    respond(['error' => "Not found: $method $path"], 404);
} catch (\Throwable $e) {
    error_log(sprintf('[duration_calculator] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    $debug = ($config['debug'] ?? false) === true;
    respond(['error' => $debug ? $e->getMessage() : 'Une erreur interne est survenue.'], 500);
}
