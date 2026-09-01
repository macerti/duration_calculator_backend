<?php
declare(strict_types=1);

namespace AuditEngine;

function riskColumn(string $risk): string
{
    return match ($risk) {
        'Elevé' => 'daysHigh',
        'Moyen' => 'daysMed',
        'Faible' => 'daysLow',
        'Limité' => 'daysLimite',
        default => throw new \InvalidArgumentException("Unknown risk level: $risk"),
    };
}

/**
 * VLOOKUP(NAE, table, col, approximate_match) against the appropriate IAF table.
 * NAE=0 returns 0 directly. NAE beyond the last bracket: linear-extrapolate
 * instead of the source tool's silent 0-day bug (spec §7.3 resolution #3).
 */
function lookupBaseDuration(float $nae, string $risk, array $table, array $params): array
{
    if ($nae <= 0) return ['days' => 0, 'extrapolated' => false];

    $col = riskColumn($risk);
    $defined = array_values(array_filter(
        $table['brackets'],
        fn($b) => $b[$col] !== null && $b['naeTo'] !== null
    ));

    foreach ($defined as $b) {
        if ($nae >= $b['naeFrom'] && $nae <= $b['naeTo']) {
            return ['days' => $b[$col], 'extrapolated' => false, 'bracketUsed' => "{$b['naeFrom']}-{$b['naeTo']}"];
        }
    }

    $lastBracket = end($defined);
    if ($lastBracket === false || $nae <= $lastBracket['naeTo']) {
        throw new \RuntimeException("No IAF duration bracket found for NAE=$nae, risk=$risk, standard={$table['standard']}");
    }

    if (!$params['extrapolation']['enabled']) {
        return ['days' => 0, 'extrapolated' => false, 'bracketUsed' => 'out-of-range (extrapolation disabled)'];
    }

    $secondLast = count($defined) >= 2 ? $defined[count($defined) - 2] : null;
    if ($secondLast === null) {
        return ['days' => $lastBracket[$col], 'extrapolated' => true, 'bracketUsed' => ">{$lastBracket['naeTo']} (flat)"];
    }

    $x1 = ($secondLast['naeFrom'] + $secondLast['naeTo']) / 2;
    $y1 = $secondLast[$col];
    $x2 = ($lastBracket['naeFrom'] + $lastBracket['naeTo']) / 2;
    $y2 = $lastBracket[$col];
    $slope = ($y2 - $y1) / ($x2 - $x1);

    $days = $y2 + $slope * ($nae - $x2);
    return [
        'days' => max($days, $y2),
        'extrapolated' => true,
        'bracketUsed' => ">{$lastBracket['naeTo']} (extrapolated, slope=" . round($slope, 6) . ")",
    ];
}
