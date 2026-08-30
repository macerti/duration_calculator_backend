<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * §9.7 / spec line 889: "Prépa/rapport = 20% × (sum of on-site durations for
 * sites marked 'Oui' that year)" — report-writing is computed PER YEAR (per
 * visit), not once on a combined multi-year sum. Each visit (initial audit,
 * each surveillance year) carries its own report-writing time. Mathematically
 * 20%×(a+b+c) = 20%a+20%b+20%c, so the grand total is unaffected by this
 * restructuring — but the per-visit breakdown is what the spec actually
 * describes, and it's what makes each visit's total independently meaningful
 * (a real trace-ability requirement, not just an implementation detail).
 */
function calculateStandardDuration(float $nae, array $siteStandard, array $params): array
{
    $standard = $siteStandard['standard'];
    $table = $params['iafDurationTables'][$standard] ?? null;
    if ($table === null) {
        throw new \RuntimeException("No IAF duration table configured for standard \"$standard\"");
    }

    $risk = $siteStandard['riskLevel'];
    $baseDuration = lookupBaseDuration($nae, $risk, $table, $params);

    $stageDayCoefficient = $params['stageDayCoefficients'][$siteStandard['stage']];
    $iafCalculated = $baseDuration['days'] * $stageDayCoefficient;

    $factorResult = calculateAggregateFactor($siteStandard['factors'], $params['aggregateFactorCaps']);
    $iafWithFactors = $iafCalculated * (1 + $factorResult['finalPercent'] / 100);

    $synergyResult = null;
    $synergyFinalPercent = 0;
    if (!empty($siteStandard['synergy'])) {
        $synergyResult = calculateSynergy($siteStandard['synergy'], $params);
        $synergyFinalPercent = $synergyResult['finalPercent'];
    }

    $netDuration = $iafWithFactors * (1 + $synergyFinalPercent / 100);

    $stage1Days = 0;
    $stage2Days = 0;
    $s1 = !empty($siteStandard['stage1Selected']);
    $s2 = !empty($siteStandard['stage2Selected']);
    if ($s1 && $s2) {
        $stage1Days = $netDuration * $params['stage1Stage2Split']['stage1'];
        $stage2Days = $netDuration * $params['stage1Stage2Split']['stage2'];
    } elseif ($s1) {
        $stage1Days = $netDuration;
    } elseif ($s2) {
        $stage2Days = $netDuration;
    }
    if ($s2 && $stage2Days > 0 && $stage2Days < $params['stage1Stage2Split']['stage2FloorDays']) {
        $stage2Days = $params['stage1Stage2Split']['stage2FloorDays'];
    }
    $overrides = $siteStandard['durationOverrides'] ?? [];
    if (isset($overrides['stage1'])) $stage1Days = $overrides['stage1'];
    if (isset($overrides['stage2'])) $stage2Days = $overrides['stage2'];

    $surveillanceCoeff = $params['surveillanceCoefficients'][$siteStandard['stage']];
    $reportPct = $params['reportWritingPercent'] / 100;
    $years = [];
    foreach ([1, 2, 3] as $yearNum) {
        $stageCode = calculerEtape($siteStandard['stage'], $yearNum, !empty($siteStandard['isExtensionSite']), null);
        $sampled = !empty($siteStandard['sampledThisYear'][$yearNum]);

        if ($yearNum === 1) {
            $onSiteCalculated = $stage1Days + $stage2Days;
        } else {
            $onSiteCalculated = $sampled ? $netDuration * $surveillanceCoeff : 0;
        }

        $onSiteFinal = $onSiteCalculated;
        if ($yearNum === 2 && isset($overrides['year2'])) $onSiteFinal = $overrides['year2'];
        if ($yearNum === 3 && isset($overrides['year3'])) $onSiteFinal = $overrides['year3'];

        // Report-writing for THIS visit, off THIS visit's own on-site time —
        // not summed across years first. Respects a per-year manual override
        // if one is supplied (durationOverrides.report2 / report3 / report1).
        $reportCalculated = $onSiteCalculated * $reportPct;
        $reportFinal = $onSiteFinal * $reportPct;
        $reportOverrideKey = "report{$yearNum}";
        if (isset($overrides[$reportOverrideKey])) {
            $reportFinal = min($overrides[$reportOverrideKey], $params['validationBounds']['prepReportMax']);
        }

        $years[] = [
            'year' => $yearNum,
            'stageCode' => $stageCode,
            'sampledThisYear' => $sampled,
            'onSiteDurationCalculated' => $onSiteCalculated,
            'onSiteDurationFinal' => $onSiteFinal,
            'reportWritingCalculated' => $reportCalculated,
            'reportWritingFinal' => $reportFinal,
        ];
    }

    // Kept for display/back-compat: the sum of each visit's own report-writing
    // time. Not used to derive totals anymore — totals are built directly
    // from the per-year figures below, so this can never silently drift out
    // of sync with what's actually being added up.
    $prepReportCalculated = array_sum(array_map(fn($y) => $y['reportWritingCalculated'], $years));
    $prepReportFinal = array_sum(array_map(fn($y) => $y['reportWritingFinal'], $years));

    $totalDaysCalculated = array_sum(array_map(
        fn($y) => $y['onSiteDurationCalculated'] + $y['reportWritingCalculated'],
        $years
    ));
    $totalDaysFinalRaw = array_sum(array_map(
        fn($y) => $y['onSiteDurationFinal'] + $y['reportWritingFinal'],
        $years
    ));
    $totalDaysFinal = mround($totalDaysFinalRaw, $params['rounding']['nearest']);

    return [
        'standard' => $standard,
        'baseDuration' => $baseDuration,
        'stageDayCoefficient' => $stageDayCoefficient,
        'iafCalculated' => $iafCalculated,
        'factorResult' => $factorResult,
        'iafWithFactors' => $iafWithFactors,
        'synergyResult' => $synergyResult,
        'synergyFinalPercent' => $synergyFinalPercent,
        'netDuration' => $netDuration,
        'stage1Days' => $stage1Days,
        'stage2Days' => $stage2Days,
        'years' => $years,
        'prepReportCalculated' => $prepReportCalculated,
        'prepReportFinal' => $prepReportFinal,
        'totalDaysCalculated' => $totalDaysCalculated,
        'totalDaysFinal' => $totalDaysFinal,
    ];
}
