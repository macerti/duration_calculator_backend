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
require_once __DIR__ . '/../db/userRepo.php';
require_once __DIR__ . '/../db/roleRepo.php';
require_once __DIR__ . '/../db/permissionRepo.php';
require_once __DIR__ . '/../db/rateLimiter.php';
require_once __DIR__ . '/../auth/OAuthSession.php';
require_once __DIR__ . '/../auth/MicrosoftOAuth.php';
require_once __DIR__ . '/../auth/GoogleOAuth.php';
require_once __DIR__ . '/../auth/Guard.php';
require_once __DIR__ . '/../auth/Mailer.php';

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
use function AuditEngine\Auth\sessionSetUserId;
use function AuditEngine\Auth\sessionDestroy;
use function AuditEngine\Auth\sessionSetOAuthState;
use function AuditEngine\Auth\sessionGetOAuthState;
use function AuditEngine\Auth\sessionClearOAuthState;
use function AuditEngine\Auth\oauthClientSafeErrorDetail;
use function AuditEngine\Auth\microsoftBuildAuthUrl;
use function AuditEngine\Auth\microsoftHandleCallback;
use function AuditEngine\Auth\googleBuildAuthUrl;
use function AuditEngine\Auth\googleHandleCallback;
use function AuditEngine\Auth\currentUser;
use function AuditEngine\Auth\requireAuth;
use function AuditEngine\Auth\requirePermission;
use function AuditEngine\Auth\requireCsrf;
use function AuditEngine\Auth\ensureCsrfToken;
use function AuditEngine\Auth\sendVerificationEmail;
use function AuditEngine\Auth\sendPasswordResetEmail;
use function AuditEngine\createLocalUser;
use function AuditEngine\findUserByEmail;
use function AuditEngine\findUserById;
use function AuditEngine\getUserProfile;
use function AuditEngine\setLastLogin;
use function AuditEngine\createEmailVerificationToken;
use function AuditEngine\consumeEmailVerificationToken;
use function AuditEngine\createPasswordResetToken;
use function AuditEngine\resetPasswordWithToken;
use function AuditEngine\validatePassword;
use function AuditEngine\hashPassword;
use function AuditEngine\updateUserPasswordHash;
use function AuditEngine\setPendingEmail;
use function AuditEngine\updateUserName;
use function AuditEngine\resolveSsoUser;
use function AuditEngine\listUsers;
use function AuditEngine\setUserRole;
use function AuditEngine\setUserStatus;
use function AuditEngine\listRoles;
use function AuditEngine\createRole;
use function AuditEngine\updateRole;
use function AuditEngine\deleteRole;
use function AuditEngine\getRoleById;
use function AuditEngine\listPermissions;
use function AuditEngine\createPermission;
use function AuditEngine\updatePermission;
use function AuditEngine\deletePermission;
use function AuditEngine\rateLimitCheck;

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
        requireAuth();
        $body = jsonBody();
        $name = requireNonEmptyString($body['name'] ?? '', 'name', 255);
        $id = createClient($name);
        respond(['id' => $id, 'name' => $name], 201);
    }

    if ($method === 'GET' && $segments === ['clients']) {
        requireDb($dbAvailable);
        requireAuth();
        respond(listClients());
    }

    if ($method === 'GET' && count($segments) === 2 && $segments[0] === 'clients') {
        requireDb($dbAvailable);
        requireAuth();
        $id = (int)$segments[1];
        $client = getClient($id);
        if ($client === null) respond(['error' => "No client with id $id"], 404);
        respond($client);
    }

    if ($method === 'PUT' && count($segments) === 2 && $segments[0] === 'clients') {
        requireDb($dbAvailable);
        requireAuth();
        $id = (int)$segments[1];
        $body = jsonBody();
        $name = requireNonEmptyString($body['name'] ?? '', 'name', 255);
        updateClientName($id, $name);
        respond(['id' => $id, 'name' => $name]);
    }

    if ($method === 'DELETE' && count($segments) === 2 && $segments[0] === 'clients') {
        requireDb($dbAvailable);
        requireAuth();
        $id = (int)$segments[1];
        deleteClient($id);
        respond(['deleted' => $id]);
    }

    if ($method === 'GET' && count($segments) === 3 && $segments[0] === 'clients' && $segments[2] === 'cases') {
        requireDb($dbAvailable);
        requireAuth();
        $clientId = (int)$segments[1];
        respond(listCalculationCases(50, $clientId));
    }

    // --- Calculation cases ---
    if ($method === 'POST' && $segments === ['cases']) {
        requireDb($dbAvailable);
        requireAuth();
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
        requireAuth();
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
        requireAuth();
        $id = (int)$segments[1];
        deleteCalculationCase($id);
        respond(['deleted' => $id]);
    }

    if ($method === 'GET' && $segments === ['cases']) {
        requireDb($dbAvailable);
        requireAuth();
        respond(listCalculationCases());
    }

    if ($method === 'GET' && count($segments) === 2 && $segments[0] === 'cases') {
        requireDb($dbAvailable);
        requireAuth();
        $id = (int)$segments[1];
        $found = getCalculationCase($id);
        if ($found === null) respond(['error' => "No case with id $id"], 404);
        respond($found);
    }

    // =========================================================
    // AUTH ROUTES — local accounts, RBAC, and OAuth 2.0/OIDC SSO
    // =========================================================

    // GET /auth/me — return current signed-in user (with role,
    // permissions, and a fresh CSRF token), or 401.
    if ($method === 'GET' && $segments === ['auth', 'me']) {
        $user = requireAuth();
        $user['csrfToken'] = ensureCsrfToken();
        respond($user);
    }

    // POST /auth/register — create a local account. Always requires
    // email confirmation via a link before the account can log in (see
    // GET /auth/verify-email below) — never a token to copy/paste.
    if ($method === 'POST' && $segments === ['auth', 'register']) {
        requireDb($dbAvailable);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (!rateLimitCheck('register:' . $ip, 5, 3600)) {
            respond(['error' => 'Trop de tentatives. Réessayez plus tard.'], 429);
        }
        $body = jsonBody();
        $name = requireNonEmptyString((string)($body['name'] ?? ''), 'name', 255);
        $email = strtolower(trim((string)($body['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(['error' => 'Adresse e-mail invalide.'], 400);
        }
        $password = (string)($body['password'] ?? '');
        // Refused outright if this email exists at all, whether it
        // already has a local password or is SSO-only — "forgot
        // password" doubles as "set my first local password" for an
        // SSO-only account, since it already proves mailbox ownership
        // via the emailed link. See docs/DEV_STATUS.md for why this is
        // simpler and safer than a separate account-linking code path.
        if (findUserByEmail($email) !== null) {
            respond(['error' => "Un compte existe déjà avec cette adresse e-mail. Connectez-vous, ou utilisez « mot de passe oublié » pour y accéder."], 409);
        }
        try {
            $user = createLocalUser($name, $email, $password);
        } catch (\RuntimeException $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        $rawToken = createEmailVerificationToken((int)$user['id']);
        try {
            sendVerificationEmail($config, $email, $name, $rawToken);
        } catch (\Throwable $e) {
            // The account exists even if the email failed to send —
            // resend-verification lets them retry. Never fail
            // registration just because outbound mail hiccupped.
            error_log('[duration_calculator] verification email send failed: ' . $e->getMessage());
        }
        respond(['ok' => true, 'message' => 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.'], 201);
    }

    // GET /auth/verify-email?token=... — the link the user clicks. Not
    // JSON: this is a browser navigation, so it redirects back into the
    // app with a query flag, exactly like the SSO callbacks below.
    if ($method === 'GET' && $segments === ['auth', 'verify-email']) {
        requireDb($dbAvailable);
        header('Content-Type: text/html; charset=utf-8', true);
        $appUrl = rtrim($config['app_url'] ?? '', '/');
        $token = (string)($_GET['token'] ?? '');
        $result = $token !== '' ? consumeEmailVerificationToken($token) : null;
        header('Location: ' . $appUrl . '/?' . ($result !== null ? 'verified=1' : 'verify_error=invalid'));
        http_response_code(302);
        exit;
    }

    // POST /auth/resend-verification — always a generic response, win
    // or lose, so this can't be used to probe which emails have accounts.
    if ($method === 'POST' && $segments === ['auth', 'resend-verification']) {
        requireDb($dbAvailable);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $email = strtolower(trim((string)(jsonBody()['email'] ?? '')));
        $generic = ['ok' => true, 'message' => 'Si un compte existe avec cette adresse et n\'est pas encore confirmé, un e-mail a été envoyé.'];
        $ipOk = rateLimitCheck('resend:' . $ip, 8, 3600);
        $emailOk = $email === '' || rateLimitCheck('resend:' . $email, 3, 3600);
        if ($ipOk && $emailOk) {
            $user = $email !== '' ? findUserByEmail($email) : null;
            if ($user !== null && $user['email_verified_at'] === null) {
                $rawToken = createEmailVerificationToken((int)$user['id']);
                try {
                    sendVerificationEmail($config, $user['email'], $user['name'], $rawToken);
                } catch (\Throwable $e) {
                    error_log('[duration_calculator] resend-verification send failed: ' . $e->getMessage());
                }
            }
        }
        respond($generic);
    }

    // POST /auth/login — local email/password sign-in.
    if ($method === 'POST' && $segments === ['auth', 'login']) {
        requireDb($dbAvailable);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $body = jsonBody();
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        if (!rateLimitCheck('login:' . $ip, 15, 600) || ($email !== '' && !rateLimitCheck('login:' . $email, 8, 600))) {
            respond(['error' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
        }
        $user = $email !== '' ? findUserByEmail($email) : null;
        // Deliberately generic: whether the email doesn't exist, the
        // password is wrong, or the account is SSO-only with no local
        // password set all produce the exact same response, so a wrong-
        // password guess can't be used to learn which is true.
        if ($user === null || $user['password_hash'] === null || !password_verify($password, $user['password_hash'])) {
            respond(['error' => 'Adresse e-mail ou mot de passe incorrect.'], 401);
        }
        // Only after a correct password do we reveal a more specific
        // reason — at this point the caller has already proven they
        // know the password, so this isn't an enumeration leak.
        if ($user['email_verified_at'] === null) {
            respond(['error' => 'Confirmez votre adresse e-mail avant de vous connecter.', 'code' => 'email_not_verified'], 403);
        }
        if ($user['status'] !== 'active') {
            respond(['error' => 'Ce compte est désactivé. Contactez un administrateur.'], 403);
        }
        setLastLogin((int)$user['id']);
        sessionSetUserId((int)$user['id']);
        $profile = getUserProfile((int)$user['id']);
        $profile['csrfToken'] = ensureCsrfToken();
        respond($profile);
    }

    // POST /auth/forgot-password — always a generic response, win or
    // lose, so this can't be used to probe which emails have accounts.
    // Doubles as "set my first local password" for an SSO-only account.
    if ($method === 'POST' && $segments === ['auth', 'forgot-password']) {
        requireDb($dbAvailable);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $email = strtolower(trim((string)(jsonBody()['email'] ?? '')));
        $generic = ['ok' => true, 'message' => 'Si un compte existe avec cette adresse, un e-mail a été envoyé.'];
        $ipOk = rateLimitCheck('forgot:' . $ip, 10, 3600);
        $emailOk = $email === '' || rateLimitCheck('forgot:' . $email, 4, 3600);
        if ($ipOk && $emailOk) {
            $user = $email !== '' ? findUserByEmail($email) : null;
            if ($user !== null) {
                $rawToken = createPasswordResetToken((int)$user['id']);
                try {
                    sendPasswordResetEmail($config, $user['email'], $user['name'], $rawToken);
                } catch (\Throwable $e) {
                    error_log('[duration_calculator] password reset email send failed: ' . $e->getMessage());
                }
            }
        }
        respond($generic);
    }

    // POST /auth/reset-password — the form the reset-link lands on
    // submits here. Also auto-signs the user in on success (modern UX —
    // no separate "now log in again" step).
    if ($method === 'POST' && $segments === ['auth', 'reset-password']) {
        requireDb($dbAvailable);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (!rateLimitCheck('reset:' . $ip, 15, 3600)) {
            respond(['error' => 'Trop de tentatives. Réessayez plus tard.'], 429);
        }
        $body = jsonBody();
        $token = (string)($body['token'] ?? '');
        $newPassword = (string)($body['newPassword'] ?? '');
        if ($token === '') respond(['error' => 'Jeton manquant.'], 400);
        try {
            $userId = resetPasswordWithToken($token, $newPassword);
        } catch (\RuntimeException $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        if ($userId === null) {
            respond(['error' => 'Ce lien est invalide ou a expiré. Demandez un nouveau lien.'], 400);
        }
        setLastLogin($userId);
        sessionSetUserId($userId);
        $profile = getUserProfile($userId);
        $profile['csrfToken'] = ensureCsrfToken();
        respond($profile);
    }

    // POST /auth/change-password — authenticated, requires the current
    // password (distinct from the link-based reset flow above).
    if ($method === 'POST' && $segments === ['auth', 'change-password']) {
        requireDb($dbAvailable);
        $authUser = requireAuth();
        requireCsrf();
        $body = jsonBody();
        $current = (string)($body['currentPassword'] ?? '');
        $new = (string)($body['newPassword'] ?? '');
        $row = findUserById($authUser['id']);
        if ($row['password_hash'] === null || !password_verify($current, $row['password_hash'])) {
            respond(['error' => 'Mot de passe actuel incorrect.'], 400);
        }
        try {
            validatePassword($new);
        } catch (\RuntimeException $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        updateUserPasswordHash($authUser['id'], hashPassword($new));
        respond(['ok' => true]);
    }

    // PUT /auth/profile — authenticated. Name changes apply immediately;
    // an email change is staged (pending_email) and only takes effect
    // once the new address is confirmed via its own verification link,
    // so the account is never left with an unverified live email.
    if ($method === 'PUT' && $segments === ['auth', 'profile']) {
        requireDb($dbAvailable);
        $authUser = requireAuth();
        requireCsrf();
        $body = jsonBody();
        if (isset($body['name'])) {
            updateUserName($authUser['id'], requireNonEmptyString((string)$body['name'], 'name', 255));
        }
        if (isset($body['email'])) {
            $newEmail = strtolower(trim((string)$body['email']));
            if ($newEmail === '' || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
                respond(['error' => 'Adresse e-mail invalide.'], 400);
            }
            if ($newEmail !== $authUser['email']) {
                $existing = findUserByEmail($newEmail);
                if ($existing !== null && (int)$existing['id'] !== $authUser['id']) {
                    respond(['error' => 'Cette adresse e-mail est déjà utilisée par un autre compte.'], 409);
                }
                setPendingEmail($authUser['id'], $newEmail);
                $rawToken = createEmailVerificationToken($authUser['id'], 'verify_email_change');
                try {
                    sendVerificationEmail($config, $newEmail, $authUser['name'], $rawToken);
                } catch (\Throwable $e) {
                    error_log('[duration_calculator] email-change verification send failed: ' . $e->getMessage());
                }
            }
        }
        $profile = getUserProfile($authUser['id']);
        $profile['csrfToken'] = ensureCsrfToken();
        respond($profile);
    }

    // =========================================================
    // ADMIN ROUTES — roles, permissions, user management
    // =========================================================

    if ($method === 'GET' && $segments === ['admin', 'roles']) {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        respond(listRoles());
    }

    if ($method === 'POST' && $segments === ['admin', 'roles']) {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        requireCsrf();
        $body = jsonBody();
        $name = requireNonEmptyString((string)($body['name'] ?? ''), 'name', 100);
        $description = isset($body['description']) ? (string)$body['description'] : null;
        $permissions = is_array($body['permissions'] ?? null) ? array_map('strval', $body['permissions']) : [];
        try {
            $role = createRole($name, $description, $permissions);
        } catch (\Throwable $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        respond($role, 201);
    }

    if ($method === 'PUT' && count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'roles') {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        requireCsrf();
        $id = (int)$segments[2];
        $existing = getRoleById($id);
        if ($existing === null) respond(['error' => 'Rôle introuvable.'], 404);
        $body = jsonBody();
        $name = requireNonEmptyString((string)($body['name'] ?? $existing['name']), 'name', 100);
        $description = array_key_exists('description', $body) ? (string)$body['description'] : $existing['description'];
        $permissions = is_array($body['permissions'] ?? null) ? array_map('strval', $body['permissions']) : null;
        try {
            updateRole($id, $name, $description, $permissions);
        } catch (\Throwable $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        $updated = array_values(array_filter(listRoles(), fn($r) => $r['id'] === $id))[0] ?? null;
        respond($updated ?? ['error' => 'Rôle introuvable.'], $updated ? 200 : 404);
    }

    if ($method === 'DELETE' && count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'roles') {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        requireCsrf();
        $id = (int)$segments[2];
        try {
            deleteRole($id);
        } catch (\RuntimeException $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        respond(['deleted' => $id]);
    }

    if ($method === 'GET' && $segments === ['admin', 'permissions']) {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        respond(listPermissions());
    }

    if ($method === 'POST' && $segments === ['admin', 'permissions']) {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        requireCsrf();
        $body = jsonBody();
        $label = requireNonEmptyString((string)($body['label'] ?? ''), 'label', 150);
        $description = isset($body['description']) ? (string)$body['description'] : null;
        try {
            $perm = createPermission((string)($body['key'] ?? ''), $label, $description);
        } catch (\RuntimeException $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        respond($perm, 201);
    }

    if ($method === 'PUT' && count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'permissions') {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        requireCsrf();
        $id = (int)$segments[2];
        $body = jsonBody();
        $label = requireNonEmptyString((string)($body['label'] ?? ''), 'label', 150);
        $description = isset($body['description']) ? (string)$body['description'] : null;
        updatePermission($id, $label, $description);
        respond(['id' => $id, 'label' => $label, 'description' => $description]);
    }

    if ($method === 'DELETE' && count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'permissions') {
        requireDb($dbAvailable);
        requirePermission('manage_roles');
        requireCsrf();
        $id = (int)$segments[2];
        try {
            deletePermission($id);
        } catch (\RuntimeException $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        respond(['deleted' => $id]);
    }

    if ($method === 'GET' && $segments === ['admin', 'users']) {
        requireDb($dbAvailable);
        requirePermission('manage_users');
        respond(listUsers());
    }

    if ($method === 'PUT' && count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'users') {
        requireDb($dbAvailable);
        requirePermission('manage_users');
        requireCsrf();
        $id = (int)$segments[2];
        $body = jsonBody();
        try {
            if (isset($body['roleId'])) {
                setUserRole($id, (int)$body['roleId']);
            }
            if (isset($body['status'])) {
                setUserStatus($id, (string)$body['status']);
            }
        } catch (\RuntimeException $e) {
            respond(['error' => $e->getMessage()], 400);
        }
        $updated = array_values(array_filter(listUsers(), fn($u) => $u['id'] === $id))[0] ?? null;
        respond($updated ?? ['error' => 'Utilisateur introuvable.'], $updated ? 200 : 404);
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
            $claims = microsoftHandleCallback(
                $config['microsoft_client_id'],
                $config['microsoft_client_secret'],
                $appUrl . '/api/auth/callback/microsoft',
                $code
            );
            // Resolve to a real, persisted user row (linking to an
            // existing account by verified email if one exists) rather
            // than trusting raw provider claims directly into the
            // session — see docs/DEV_STATUS.md's 2026-09-04 entry.
            $user = resolveSsoUser('microsoft', $claims['id'], $claims['email'], $claims['name']);
            setLastLogin((int)$user['id']);
            sessionSetUserId((int)$user['id']);
            header('Location: ' . $appUrl . '/?auth=ok');
        } catch (\Throwable $e) {
            error_log('[duration_calculator] Microsoft OAuth error: ' . $e->getMessage());
            $redirect = $appUrl . '/?auth_error=callback_failed'
                . '&auth_error_description=' . urlencode(oauthClientSafeErrorDetail($e->getMessage()));
            header('Location: ' . $redirect);
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
            $claims = googleHandleCallback(
                $config['google_client_id'],
                $config['google_client_secret'],
                $appUrl . '/api/auth/callback/google',
                $code
            );
            $user = resolveSsoUser('google', $claims['id'], $claims['email'], $claims['name']);
            setLastLogin((int)$user['id']);
            sessionSetUserId((int)$user['id']);
            header('Location: ' . $appUrl . '/?auth=ok');
        } catch (\Throwable $e) {
            error_log('[duration_calculator] Google OAuth error: ' . $e->getMessage());
            $redirect = $appUrl . '/?auth_error=callback_failed'
                . '&auth_error_description=' . urlencode(oauthClientSafeErrorDetail($e->getMessage()));
            header('Location: ' . $redirect);
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
