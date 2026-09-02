<?php
declare(strict_types=1);

namespace AuditEngine;

function calculateSynergy(array $input, array $params): array
{
    $Z = count($input['auditorCapabilities']);
    $Y = $input['standardsCoveredCount'];

    $capacityPercent = 0.0;
    if ($Z > 0 && $Y > 1) {
        $sumK = 0;
        foreach ($input['auditorCapabilities'] as $a) {
            $q = $a['qualifiedStandardCount'];
            $sumK += ($q === 0) ? 0 : ($q - 1);
        }
        $capacityPercent = ($sumK / ($Z * ($Y - 1))) * 100;
    }

    $band = null;
    foreach ($params['synergyGrid'] as $g) {
        if ($g['integrationLevel'] === $input['integrationLevel']
            && $capacityPercent >= $g['capacityBandMin']
            && ($capacityPercent < $g['capacityBandMax'] || $g['capacityBandMax'] === 100)) {
            $band = $g;
            break;
        }
    }

    $bandedReductionPercent = $band['reductionPercent'] ?? 0;
    $finalPercent = $input['overridePercent'] ?? $bandedReductionPercent;

    return [
        'capacityPercent' => $capacityPercent,
        'bandedReductionPercent' => $bandedReductionPercent,
        'finalPercent' => $finalPercent,
    ];
}
