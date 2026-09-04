<?php
declare(strict_types=1);

$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');
// Matches Mailer.php's default when config.php sets no explicit
// mail.log_path — both this project's local config.php and CI's
// generated config.php rely on that same default, so this needs no
// special-casing between environments.
$mailLogPath = $argv[2] ?? sys_get_temp_dir() . '/audit_app_mail_log.txt';
$cookieJar = tempnam(sys_get_temp_dir(), 'audit_http_test_cookies_');
$failures = 0;
$passed = 0;

function check(bool $ok, string $name, string $detail = ''): void
{
    global $failures, $passed;
    if ($ok) { $passed++; echo "PASS $name\n"; }
    else { $failures++; echo "FAIL $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}

/**
 * All calls share one cookie jar by default, so a login earlier in this
 * script keeps the session for every later call — including the
 * pre-existing /clients and /cases tests below, which now require
 * authentication (see api/index.php's requireAuth() gating).
 */
function request(string $method, string $url, ?array $body = null, ?string $csrfToken = null, bool $withSession = true): array
{
    global $cookieJar;
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($csrfToken !== null) $headers[] = 'X-CSRF-Token: ' . $csrfToken;
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HEADER => true,
    ];
    if ($withSession) {
        $opts[CURLOPT_COOKIEJAR] = $cookieJar;
        $opts[CURLOPT_COOKIEFILE] = $cookieJar;
    }
    curl_setopt_array($ch, $opts);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($raw === false) return [$status, null, '', $error, ''];
    $rawHeaders = substr($raw, 0, $headerSize);
    $rawBody = substr($raw, $headerSize);
    return [$status, $rawBody !== '' ? json_decode($rawBody, true) : null, $rawBody, $error, $rawHeaders];
}

function locationHeader(string $rawHeaders): ?string
{
    if (preg_match('/^Location:\s*(.+)$/mi', $rawHeaders, $m)) {
        return trim($m[1]);
    }
    return null;
}

/** Finds the most recently emailed link's raw token (64 hex chars). */
function latestMailToken(string $mailLogPath): ?string
{
    if (!is_file($mailLogPath)) return null;
    $content = file_get_contents($mailLogPath);
    if ($content === false) return null;
    preg_match_all('/token=([0-9a-f]{64})/', $content, $m);
    return $m[1] ? end($m[1]) : null;
}

echo "Deployment-topology HTTP regression tests against $base\n";

[$status, $health] = request('GET', "$base/health", null, null, false);
check($status === 200, 'GET /health returns 200', "status=$status");
check(($health['dbConnected'] ?? false) === true, 'health reports MariaDB connected');

// =========================================================================
// Auth + RBAC — this test user is the first ever registered in this fresh
// CI/local database, so it auto-bootstraps as administrateur (see
// userRepo.php's createLocalUser). That lets this same script exercise
// the admin routes without needing a second account.
// =========================================================================

$testEmail = 'ci-' . bin2hex(random_bytes(4)) . '@macerti-ci.test';
$testPassword = 'ci regression test passphrase 1';

[$status] = request('GET', "$base/clients", null, null, false);
check($status === 401, 'GET /clients with no session is rejected', "status=$status (expected 401)");

[$status, $reg] = request('POST', "$base/auth/register", ['name' => 'CI Test User', 'email' => $testEmail, 'password' => $testPassword], null, false);
check($status === 201, 'POST /auth/register creates account', "status=$status " . json_encode($reg));

[$status, $dup] = request('POST', "$base/auth/register", ['name' => 'CI Test User', 'email' => $testEmail, 'password' => $testPassword], null, false);
check($status === 409, 'POST /auth/register rejects duplicate email', "status=$status");

[$status, $tooEarly] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => $testPassword], null, false);
check($status === 403 && ($tooEarly['code'] ?? '') === 'email_not_verified', 'login blocked before email verification', "status=$status " . json_encode($tooEarly));

$verifyToken = latestMailToken($mailLogPath);
check($verifyToken !== null, 'verification token found in dev mail log');

[$status, , , , $verifyHeaders] = request('GET', "$base/auth/verify-email?token=" . urlencode((string)$verifyToken), null, null, false);
$loc = locationHeader($verifyHeaders);
check($status === 302 && $loc !== null && str_contains($loc, 'verified=1'), 'GET /auth/verify-email redirects with verified=1', "status=$status location=$loc");

[$status, $wrongPass] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => 'definitely the wrong one'], null, false);
check($status === 401, 'login rejects wrong password generically', "status=$status");

[$status, $login] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => $testPassword]);
check($status === 200, 'POST /auth/login succeeds after verification', "status=$status " . json_encode($login));
check(($login['role']['name'] ?? '') === 'administrateur', 'first-ever registrant is bootstrapped as administrateur', json_encode($login['role'] ?? null));
check(in_array('manage_users', $login['permissions'] ?? [], true), 'bootstrap admin has manage_users permission');
$csrf = $login['csrfToken'] ?? null;
check(is_string($csrf) && strlen($csrf) > 10, 'login response includes a CSRF token');

[$status, $me] = request('GET', "$base/auth/me");
check($status === 200 && ($me['email'] ?? '') === $testEmail, 'GET /auth/me reflects the logged-in user', "status=$status");

// --- Admin routes (this user has manage_users + manage_roles) ---
[$status, $roles] = request('GET', "$base/admin/roles");
check($status === 200 && count($roles ?? []) === 3, 'GET /admin/roles lists the 3 seeded roles', "status=$status count=" . count($roles ?? []));

[$status, $newRole] = request('POST', "$base/admin/roles", ['name' => 'ci-role', 'description' => 'Test role', 'permissions' => ['manage_clients']], $csrf);
check($status === 201 && ($newRole['name'] ?? '') === 'ci-role', 'POST /admin/roles creates a role', "status=$status " . json_encode($newRole));
$newRoleId = (int)($newRole['id'] ?? 0);

[$status, $renamed] = request('PUT', "$base/admin/roles/$newRoleId", ['name' => 'ci-role-renamed', 'permissions' => ['manage_clients', 'manage_calculations']], $csrf);
check($status === 200 && ($renamed['name'] ?? '') === 'ci-role-renamed' && count($renamed['permissions'] ?? []) === 2, 'PUT /admin/roles/:id renames + updates permissions', "status=$status " . json_encode($renamed));

[$status, $noCsrf] = request('DELETE', "$base/admin/roles/$newRoleId");
check($status === 403, 'DELETE /admin/roles/:id without CSRF token is rejected', "status=$status");

[$status] = request('DELETE', "$base/admin/roles/$newRoleId", null, $csrf);
check($status === 200, 'DELETE /admin/roles/:id succeeds with CSRF token', "status=$status");

[$status, $perms] = request('GET', "$base/admin/permissions");
check($status === 200 && count($perms ?? []) === 6, 'GET /admin/permissions lists the 6 seeded permissions', "status=$status count=" . count($perms ?? []));

[$status, $users] = request('GET', "$base/admin/users");
check($status === 200 && count($users ?? []) === 1, 'GET /admin/users lists the single CI user', "status=$status count=" . count($users ?? []));

[$status] = request('DELETE', "$base/admin/roles/1", null, $csrf); // administrateur is is_system-protected
check($status === 400, 'DELETE /admin/roles/:id refuses to delete the protected system role', "status=$status");

// --- Forgot / reset password ---
[$status] = request('POST', "$base/auth/forgot-password", ['email' => $testEmail], null, false);
check($status === 200, 'POST /auth/forgot-password returns 200', "status=$status");

$resetToken = latestMailToken($mailLogPath);
$newPassword = 'a brand new ci passphrase 2';
[$status, $afterReset] = request('POST', "$base/auth/reset-password", ['token' => $resetToken, 'newPassword' => $newPassword]);
check($status === 200 && ($afterReset['email'] ?? '') === $testEmail, 'POST /auth/reset-password succeeds and auto-signs in', "status=$status " . json_encode($afterReset));
$csrf = $afterReset['csrfToken'] ?? $csrf;

[$status] = request('POST', "$base/auth/login", ['email' => $testEmail, 'password' => $newPassword], null, false);
check($status === 200, 'login with the newly reset password succeeds', "status=$status");

// --- Profile self-service ---
[$status, $renamedProfile] = request('PUT', "$base/auth/profile", ['name' => 'CI Test User Renamed'], $csrf);
check($status === 200 && ($renamedProfile['name'] ?? '') === 'CI Test User Renamed', 'PUT /auth/profile updates name', "status=$status");

// =========================================================================
// Existing business-data regression (now runs inside the authenticated
// session established above — these routes require login as of this
// session's RBAC work; see docs/DEV_STATUS.md)
// =========================================================================

[$status, $nace] = request('GET', "$base/nace/search?q=Cultures");
check($status === 200, 'GET /nace/search returns 200', "status=$status");
check(is_array($nace) && count($nace) > 0, 'NACE search returns results');

[$status, $nace01] = request('GET', "$base/nace/01");
check($status === 200, 'GET /nace/01 returns 200', "status=$status");
check(is_array($nace01) && ($nace01['codeNace'] ?? '') === '01', 'NACE code 01 is returned');

$input = [
    'dossierRef' => 'CI-' . bin2hex(random_bytes(4)),
    'multiSite' => false,
    'sites' => [[
        'siteId' => 'site-ci-1',
        'name' => 'Site principal',
        'isHq' => true,
        'naceCode' => '',
        'personnel' => [
            'siteId' => 'site-ci-1',
            'declaredTotalHeadcount' => 0,
            'shiftTeams' => [['label' => 'Equipe 1', 'headcount' => 0, 'pctRepetitiveOrSimilar' => 0]],
            'nonShift' => ['headcount' => 0, 'pctRepetitiveOrSimilar' => 0],
            'indirect' => ['headcount' => 0],
        ],
        'standards' => [[
            'standard' => 'ISO9001',
            'active' => true,
            'stage' => 'Initial',
            'riskLevel' => 'Moyen',
            'stage1Selected' => true,
            'stage2Selected' => true,
            'factors' => ['standard' => 'ISO9001', 'ticked' => [], 'justificationText' => ''],
            'sampledThisYear' => [1 => true, 2 => true, 3 => true],
            'isExtensionSite' => false,
        ]],
    ]],
];

[$status, $created] = request('POST', "$base/cases", $input + ['status' => 'draft']);
check($status === 201, 'POST /cases creates draft', "status=$status");
$id = (int)($created['id'] ?? 0);
check($id > 0, 'POST /cases returns case id');

$input['dossierRef'] .= '-UPDATED';
[$status, $updated] = request('PUT', "$base/cases/$id", [
    'input' => $input,
    'status' => 'calculated',
    'roundingOverrides' => ['site-ci-1:ISO9001:stage1' => 1.25],
]);
check($status === 200, 'PUT /cases/:id updates case', "status=$status");
check((int)($updated['id'] ?? 0) === $id, 'PUT returns same id');
check(isset($updated['result']) && is_array($updated['result']), 'PUT returns recalculated result');

[$status, $fetched] = request('GET', "$base/cases/$id");
check($status === 200, 'GET /cases/:id returns saved case', "status=$status");
check(($fetched['input']['dossierRef'] ?? '') === $input['dossierRef'], 'GET preserves updated input');
check(($fetched['status'] ?? '') === 'calculated', 'GET preserves status');
check(($fetched['roundingOverrides']['site-ci-1:ISO9001:stage1'] ?? null) === 1.25, 'GET preserves rounding overrides');

[$status] = request('DELETE', "$base/cases/$id");
check($status === 200, 'DELETE /cases/:id cleans regression case', "status=$status");

// --- Logout, then confirm the session is really gone ---
[$status] = request('POST', "$base/auth/logout");
check($status === 200, 'POST /auth/logout succeeds');

[$status] = request('GET', "$base/clients");
check($status === 401, 'GET /clients after logout is rejected again', "status=$status");

@unlink($cookieJar);
echo "---\n$passed passed, $failures failed\n";
exit($failures > 0 ? 1 : 0);
