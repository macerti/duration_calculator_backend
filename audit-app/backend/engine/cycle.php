<?php
declare(strict_types=1);

namespace AuditEngine;

const CYCLE_TABLE = [
    'Initial' => ['i', 's', 's'],
    'Renouvellement' => ['r', 's', 's'],
    'Suivi 1' => ['s', 's', 'r'],
    'Suivi 2' => ['s', 'r', 's'],
];

function calculerEtape(string $startStage, int $year, bool $isExtensionSite, ?int $extensionStartYear = null): string
{
    if ($isExtensionSite) {
        if ($extensionStartYear === null) return '';
        if ($year === $extensionStartYear) return 'e';
        if ($year >= $extensionStartYear) return 's';
        return '';
    }
    $cycle = CYCLE_TABLE[$startStage];
    return $cycle[($year - 1) % 3];
}

/** ArrondiSupUnDixieme: round up if fractional part >= 0.1, else round down. */
function arrondiSupUnDixieme(float $value): int
{
    $frac = $value - floor($value);
    return $frac >= 0.1 ? (int)ceil($value) : (int)floor($value);
}

function calculateSampleSize(array $input, array $params): int
{
    $coeff = $params['samplingCoefficients'][$input['startStage']];
    $base = sqrt($input['eligibleSiteCount']) * $coeff;

    if ($input['year'] === 1 || empty($input['extensionOnlySiteCount'])) {
        return arrondiSupUnDixieme($base);
    }

    $extensionTerm = sqrt($input['extensionOnlySiteCount']);
    return arrondiSupUnDixieme($base + $extensionTerm);
}
