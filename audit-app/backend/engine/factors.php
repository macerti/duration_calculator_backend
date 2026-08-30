<?php
declare(strict_types=1);

namespace AuditEngine;

function calculateAggregateFactor(array $selection, array $caps): array
{
    $warnings = [];

    $ticked = $selection['ticked'] ?? [];
    $augTotal = array_sum(array_map(fn($t) => $t['valuePercent'], array_filter($ticked, fn($t) => $t['valuePercent'] > 0)));
    $redTotal = array_sum(array_map(fn($t) => $t['valuePercent'], array_filter($ticked, fn($t) => $t['valuePercent'] < 0)));

    if (!empty($selection['autreAugmentation'])) $augTotal += $selection['autreAugmentation']['valuePercent'];
    if (!empty($selection['autreReduction'])) $redTotal += $selection['autreReduction']['valuePercent'];

    $augCapped = $augTotal;
    $redCapped = $redTotal;
    $capsBreached = false;

    if ($caps['enforceAggregateCaps']) {
        if ($augTotal > $caps['maxAugmentationPercent']) {
            $augCapped = $caps['maxAugmentationPercent'];
            $capsBreached = true;
            $warnings[] = "Augmentation total {$augTotal}% exceeds the {$caps['maxAugmentationPercent']}% aggregate cap — clipped.";
        }
        if ($redTotal < $caps['maxReductionPercent']) {
            $redCapped = $caps['maxReductionPercent'];
            $capsBreached = true;
            $warnings[] = "Reduction total {$redTotal}% exceeds the {$caps['maxReductionPercent']}% aggregate cap — clipped.";
        }
    }

    $aggregatePercent = round($augCapped + $redCapped, 2);
    $finalPercent = $selection['overridePercent'] ?? $aggregatePercent;

    if (empty(trim($selection['justificationText'] ?? ''))) {
        $warnings[] = 'Justification text is mandatory for factor selections (accreditation-defensibility trail).';
    }

    return [
        'augmentationTotalRaw' => $augTotal,
        'reductionTotalRaw' => $redTotal,
        'augmentationTotalCapped' => $augCapped,
        'reductionTotalCapped' => $redCapped,
        'aggregatePercent' => $aggregatePercent,
        'finalPercent' => $finalPercent,
        'capsBreached' => $capsBreached,
        'warnings' => $warnings,
    ];
}
