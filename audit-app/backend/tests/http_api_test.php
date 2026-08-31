<?php
declare(strict_types=1);

$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');
$failures = 0;
$passed = 0;

function check(bool $ok, string $name, string $detail = ''): void
{
    global $failures, $passed;
    if ($ok) {
        $passed++;
        echo "  PASS $name\n";
    } else {
        $failures++;
        echo "  FAIL $name" . ($detail !== '' ? " — $detail" : '') . "\n";
    }
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
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = $raw !== false && $raw !== '' ? json_decode($raw, true) : null;
    return [$status, $json, $raw, $errno, $error];
}

echo "HTTP API integration tests against $base\n\n";

[$status, $health] = request('GET', "$base/health");
check($status === 200, 'health returns 200', "status=$status");
check(($health['dbConnected'] ?? false) === true, 'health reports DB connected');

$input = [
    'dossierRef' => 'HTTP-REGRESSION-' . bin2hex(random_bytes(4)),
    'date' => gmdate('c'),
    'commercial' => '',
    'scopeText' => '',
    'cycleYears' => 3,
    'auditBlanc' => 'Non',
    'extension' => ['active' => false],
    'multiSite' => false,
    'parameterSetId' => 'default-v1',
    'sites' => [[
        'siteId' => 'site-http-1',
        'name' => 'Site principal',
        'isHq' => true,
        'naceCode' => '',
        'personnel' => [
            'siteId' => 'site-http-1',
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

[$status, $created] = request('POST', "$base/api/cases", $input + [
    'clientId' => null,
    'status' => 'draft',
]);
check($status === 201, 'POST /api/cases creates draft', "status=$status");
$id = (int)($created['id'] ?? 0);
check($id > 0, 'POST returns a numeric case id');

$input['dossierRef'] = $input['dossierRef'] . '-UPDATED';
[$status, $updated] = request('PUT', "$base/api/cases/$id", [
    'input' => $input,
    'status' => 'calculated',
    'roundingOverrides' => ['site-http-1:ISO9001:stage1' => 1.25],
    'wizardState' => [['siteId' => 'site-http-1', 'marker' => 'http-test']],
]);
check($status === 200, 'PUT /api/cases/:id updates case', "status=$status");
check((int)($updated['id'] ?? 0) === $id, 'PUT returns same case id');
check(isset($updated['result']) && is_array($updated['result']), 'PUT returns recalculated result');

[$status, $fetched] = request('GET', "$base/api/cases/$id");
check($status === 200, 'GET /api/cases/:id returns saved case', "status=$status");
check(($fetched['input']['dossierRef'] ?? '') === $input['dossierRef'], 'GET returns updated input');
check(($fetched['status'] ?? '') === 'calculated', 'GET returns updated status');
check(($fetched['roundingOverrides']['site-http-1:ISO9001:stage1'] ?? null) === 1.25, 'GET returns rounding overrides');

[$status, $nace] = request('GET', "$base/api/nace/search?q=Cultures");
check($status === 200, 'NACE search route returns 200', "status=$status");
check(is_array($nace) && count($nace) > 0, 'NACE search returns results');

[$status, $nace01] = request('GET', "$base/api/nace/01");
check($status === 200, 'NACE code route returns 200', "status=$status");
check(is_array($nace01) && ($nace01['codeNace'] ?? '') === '01', 'NACE code route returns code 01');

[$status] = request('DELETE', "$base/api/cases/$id");
check($status === 200, 'DELETE /api/cases/:id cleans up regression case', "status=$status");

echo "\n---\n$passed passed, $failures failed\n";
exit($failures > 0 ? 1 : 0);
