<?php
declare(strict_types=1);

namespace AuditEngine;

const RISK_NUMERIC = ['Limité' => 0, 'Faible' => 1, 'Moyen' => 2, 'Elevé' => 3];
const NUMERIC_RISK = ['Limité', 'Faible', 'Moyen', 'Elevé'];

function averageOrgRisk(array $siteRisks): string
{
    if (count($siteRisks) === 0) throw new \InvalidArgumentException('averageOrgRisk requires at least one site risk level');
    $sum = array_sum(array_map(fn($r) => RISK_NUMERIC[$r], $siteRisks));
    $avg = $sum / count($siteRisks);
    $rounded = (int)round($avg);
    $rounded = max(0, min(3, $rounded));
    return NUMERIC_RISK[$rounded];
}

/** MROUND(value, nearest) — round to the nearest multiple of `nearest`. */
function mround(float $value, float $nearest): float
{
    if ($nearest === 0.0) return $value;
    return round($value / $nearest) * $nearest;
}
