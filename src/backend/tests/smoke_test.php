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

use function AuditEngine\loadDefaultParameterSet;
use function AuditEngine\calculateNae;
use function AuditEngine\lookupBaseDuration;
use function AuditEngine\arrondiSupUnDixieme;
use function AuditEngine\calculerEtape;
use function AuditEngine\mround;
use function AuditEngine\calculateCase;

$failures = 0;
$passed = 0;

function check(string $name, $actual, $expected): void
{
    global $failures, $passed;
    $ok = $actual === $expected || (is_float($expected) && abs($actual - $expected) < 0.0001);
    if ($ok) {
        $passed++;
        echo "  ✓ $name\n";
    } else {
        $failures++;
        echo "  ✗ $name — expected " . var_export($expected, true) . ", got " . var_export($actual, true) . "\n";
    }
}

echo "NAE calculation — worked example from GS0106 spec §4.4\n";
$naeResult = calculateNae([
    'siteId' => 'site-1',
    'declaredTotalHeadcount' => 1000,
    'shiftTeams' => [
        ['headcount' => 200, 'pctRepetitiveOrSimilar' => 1],
        ['headcount' => 100, 'pctRepetitiveOrSimilar' => 1],
        ['headcount' => 100, 'pctRepetitiveOrSimilar' => 1],
        ['headcount' => 0, 'pctRepetitiveOrSimilar' => 1],
        ['headcount' => 0, 'pctRepetitiveOrSimilar' => 1],
    ],
    'nonShift' => ['headcount' => 100, 'pctRepetitiveOrSimilar' => 0],
    'indirect' => ['headcount' => 500],
]);
check('crossCheckOk', $naeResult['crossCheckOk'], true);
check('directShiftAdjusted == 58', $naeResult['directShiftAdjusted'], 58);
check('directNonShift == 100', $naeResult['directNonShift'], 100);
check('indirectAdjusted == 125', $naeResult['indirectAdjusted'], 125);
check('totalNae == 283', $naeResult['totalNae'], 283);

echo "\nCross-check failure detection\n";
$badNae = calculateNae([
    'siteId' => 'site-2',
    'declaredTotalHeadcount' => 999,
    'shiftTeams' => [['headcount' => 200, 'pctRepetitiveOrSimilar' => 1]],
    'nonShift' => ['headcount' => 100, 'pctRepetitiveOrSimilar' => 0],
    'indirect' => ['headcount' => 500],
]);
check('crossCheckOk false', $badNae['crossCheckOk'], false);
check('totalNae 0 on mismatch', $badNae['totalNae'], 0);

echo "\nIAF base duration lookup\n";
$params = loadDefaultParameterSet();
$r0 = lookupBaseDuration(0, 'Elevé', $params['iafDurationTables']['ISO9001'], $params);
check('NAE=0 returns 0 days', $r0['days'], 0);

$r5 = lookupBaseDuration(5, 'Elevé', $params['iafDurationTables']['ISO9001'], $params);
check('NAE=5 High => 1.5 days', $r5['days'], 1.5);
check('NAE=5 not extrapolated', $r5['extrapolated'], false);

$rBig = lookupBaseDuration(20000, 'Elevé', $params['iafDurationTables']['ISO9001'], $params);
check('NAE=20000 extrapolated', $rBig['extrapolated'], true);
check('NAE=20000 days > 24', $rBig['days'] > 24, true);

echo "\ncycle helpers\n";
check('arrondiSupUnDixieme(3.12) == 4', arrondiSupUnDixieme(3.12), 4);
check('arrondiSupUnDixieme(3.05) == 3', arrondiSupUnDixieme(3.05), 3);
check('calculerEtape Initial y1', calculerEtape('Initial', 1, false), 'i');
check('calculerEtape Initial y2', calculerEtape('Initial', 2, false), 's');
check('calculerEtape Initial y3', calculerEtape('Initial', 3, false), 's');
check('calculerEtape Suivi2 y1', calculerEtape('Suivi 2', 1, false), 's');
check('calculerEtape Suivi2 y2', calculerEtape('Suivi 2', 2, false), 'r');
check('calculerEtape Suivi2 y3', calculerEtape('Suivi 2', 3, false), 's');

echo "\nmround\n";
check('mround(3.1, 0.25) == 3', mround(3.1, 0.25), 3.0);
check('mround(3.2, 0.25) == 3.25', mround(3.2, 0.25), 3.25);

echo "\nFull case — single site (matches src/frontend integration test)\n";
$caseInput = [
    'dossierRef' => 'PHP-PORT-TEST',
    'multiSite' => false,
    'sites' => [[
        'siteId' => 'site-1',
        'name' => 'Site principal',
        'isHq' => true,
        'naceCode' => '',
        'personnel' => [
            'siteId' => 'site-1',
            'declaredTotalHeadcount' => 800,
            'shiftTeams' => [['label' => 'Equipe 1', 'headcount' => 200, 'pctRepetitiveOrSimilar' => 1]],
            'nonShift' => ['headcount' => 100, 'pctRepetitiveOrSimilar' => 0],
            'indirect' => ['headcount' => 500],
        ],
        'standards' => [[
            'standard' => 'ISO9001',
            'active' => true,
            'stage' => 'Initial',
            'riskLevel' => 'Moyen',
            'stage1Selected' => true,
            'stage2Selected' => true,
            'factors' => ['standard' => 'ISO9001', 'ticked' => [['index' => 1, 'valuePercent' => -15]], 'justificationText' => 'Test'],
            'sampledThisYear' => [1 => true, 2 => true, 3 => true],
            'isExtensionSite' => false,
        ]],
    ]],
];
$caseResult = calculateCase($caseInput, $params);
// 15.25, not 12.75 — the total now correctly includes report-writing time
// (20% per visit), which a prior version of this engine computed but never
// actually added into totalDaysFinal. 15.25 / 12.75 ≈ 1.2, exactly what
// adding a 20%-of-on-site component should do to a total that previously
// omitted it — see CHANGELOG for the fix.
check('totalDaysAllSites == 15.25 (includes report-writing, see CHANGELOG)', $caseResult['totalDaysAllSites'], 15.25);
check('no warnings', count($caseResult['warnings']), 0);

echo "\n---\n";
echo "$passed passed, $failures failed\n";
exit($failures > 0 ? 1 : 0);
