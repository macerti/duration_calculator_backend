<?php
declare(strict_types=1);

$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');
$failures = 0;
$passed = 0;

function check(bool $ok, string $name, string $detail = ''): void
{
    global $failures, $passed;
    if ($ok) { $passed++; echo "PASS $name\n"; }
    else { $failures++; echo "FAIL $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}

function request(string $method, string $url, ?array $body = null): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 15,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    return [$status, $raw !== false && $raw !== '' ? json_decode($raw, true) : null, $raw, $error];
}

echo "Deployment-topology HTTP regression tests against $base\n";

[$status, $health] = request('GET', "$base/health");
check($status === 200, 'GET /health returns 200', "status=$status");
check(($health['dbConnected'] ?? false) === true, 'health reports MariaDB connected');

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

echo "---\n$passed passed, $failures failed\n";
exit($failures > 0 ? 1 : 0);
