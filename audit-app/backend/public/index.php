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
use function AuditEngine\deleteCalculationCase;
use function AuditEngine\createClient;
use function AuditEngine\listClients;
use function AuditEngine\getClient;
use function AuditEngine\updateClientName;
use function AuditEngine\deleteClient;

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

// --- Params: DB-backed if available, else in-memory bootstrap (mirrors the Node behavior this project ported from) ---
$dbAvailable = false;
$params = loadDefaultParameterSet();
if (pingDb()) {
    $active = getActiveParameterSet();
    if ($active !== null) {
        $params = $active;
        $dbAvailable = true;
    }
}

function requireDb(bool $dbAvailable): void
{
    if (!$dbAvailable) {
        respond(['error' => 'Database not configured/available. This endpoint requires a DB.'], 503);
    }
}

// --- Routing ---
// This project's own convention (kept distinct from duration_calculator/):
// this script IS the doc root file (no physical "api/" folder), so "/api/"
// is a plain URL-path prefix here, not a folder — routes below include it
// explicitly. See ORIENTATIONS.md for why the two projects differ.
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$path = $requestPath;
if ($scriptDir !== '' && str_starts_with($path, $scriptDir)) {
    $path = substr($path, strlen($scriptDir));
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

    if ($method === 'GET' && $segments === ['api', 'parameters']) {
        respond($params);
    }

    if ($method === 'GET' && $segments === ['api', 'nace', 'search']) {
        $q = $_GET['q'] ?? '';
        if ($q === '') respond(['error' => "query param 'q' is required"], 400);
        respond(searchNaceByDescription($q, $params));
    }

    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'nace') {
        $code = $segments[2];
        $entry = findNaceEntry($code, $params);
        if ($entry === null) respond(['error' => "No NACE entry for code $code"], 404);
        respond($entry);
    }

    if ($method === 'POST' && $segments === ['api', 'nae']) {
        respond(calculateNae(jsonBody()));
    }

    if ($method === 'POST' && $segments === ['api', 'calculate']) {
        respond(calculateCase(jsonBody(), $params));
    }

    // --- Calculation cases ---
    if ($method === 'POST' && $segments === ['api', 'cases']) {
        requireDb($dbAvailable);
        $input = jsonBody();
        $clientId = isset($input['clientId']) ? (int)$input['clientId'] : null;
        $status = $input['status'] ?? 'draft';
        $result = calculateCase($input, $params);
        $id = saveCalculationCase($input, $result, $clientId, $status);
        respond(['id' => $id, 'result' => $result], 201);
    }

    if ($method === 'PUT' && count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'cases') {
        requireDb($dbAvailable);
        $id = (int)$segments[2];
        $body = jsonBody();
        $input = $body['input'] ?? [];
        $status = $body['status'] ?? null;
        $roundingOverrides = $body['roundingOverrides'] ?? null;
        $result = calculateCase($input, $params);
        updateCalculationCase($id, $input, $result, $status, $roundingOverrides);
        respond(['id' => $id, 'result' => $result]);
    }

    if ($method === 'DELETE' && count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'cases') {
        requireDb($dbAvailable);
        deleteCalculationCase((int)$segments[2]);
        respond(['deleted' => (int)$segments[2]]);
    }

    if ($method === 'GET' && $segments === ['api', 'cases']) {
        requireDb($dbAvailable);
        respond(listCalculationCases());
    }

    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'cases') {
        requireDb($dbAvailable);
        $id = (int)$segments[2];
        $found = getCalculationCase($id);
        if ($found === null) respond(['error' => "No case with id $id"], 404);
        respond($found);
    }

    // --- Clients ---
    if ($method === 'POST' && $segments === ['api', 'clients']) {
        requireDb($dbAvailable);
        $body = jsonBody();
        $name = requireNonEmptyString($body['name'] ?? '', 'name', 255);
        $id = createClient($name);
        respond(['id' => $id, 'name' => $name], 201);
    }

    if ($method === 'GET' && $segments === ['api', 'clients']) {
        requireDb($dbAvailable);
        respond(listClients());
    }

    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'clients') {
        requireDb($dbAvailable);
        $id = (int)$segments[2];
        $client = getClient($id);
        if ($client === null) respond(['error' => "No client with id $id"], 404);
        respond($client);
    }

    if ($method === 'PUT' && count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'clients') {
        requireDb($dbAvailable);
        $id = (int)$segments[2];
        $body = jsonBody();
        $name = requireNonEmptyString($body['name'] ?? '', 'name', 255);
        updateClientName($id, $name);
        respond(['id' => $id, 'name' => $name]);
    }

    if ($method === 'DELETE' && count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'clients') {
        requireDb($dbAvailable);
        deleteClient((int)$segments[2]);
        respond(['deleted' => (int)$segments[2]]);
    }

    if ($method === 'GET' && count($segments) === 4 && $segments[0] === 'api' && $segments[1] === 'clients' && $segments[3] === 'cases') {
        requireDb($dbAvailable);
        $clientId = (int)$segments[2];
        respond(listCalculationCases(50, $clientId));
    }

    respond(['error' => "Not found: $method $path"], 404);
} catch (\Throwable $e) {
    error_log(sprintf('[audit-engine] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    $debug = ($config['debug'] ?? false) === true;
    respond(['error' => $debug ? $e->getMessage() : 'Une erreur interne est survenue.'], 500);
}
