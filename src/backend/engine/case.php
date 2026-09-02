<?php
declare(strict_types=1);

namespace AuditEngine;

function calculateCase(array $input, array $params): array
{
    $warnings = [];

    $sites = $input['sites'];
    if (!empty($input['multiSite']) && count($sites) < $params['validationBounds']['multiSiteMinimumSites']) {
        $n = count($sites);
        $min = $params['validationBounds']['multiSiteMinimumSites'];
        $warnings[] = "Multi-site case declared with only $n site(s); expected at least $min.";
    }

    $siteResults = [];
    foreach ($sites as $site) {
        $nae = calculateNae($site['personnel']);
        if (!$nae['crossCheckOk']) {
            $warnings[] = "Site \"{$site['name']}\": {$nae['crossCheckMessage']}";
        }

        $activeStandards = array_values(array_filter($site['standards'], fn($s) => !empty($s['active'])));
        $standardResults = array_map(
            fn($s) => calculateStandardDuration((float)$nae['totalNae'], $s, $params),
            $activeStandards
        );

        $siteResults[] = [
            'siteId' => $site['siteId'],
            'name' => $site['name'],
            'isHq' => $site['isHq'],
            'nae' => $nae,
            'standards' => $standardResults,
        ];
    }

    $standardCodes = [];
    foreach ($sites as $site) {
        foreach ($site['standards'] as $st) {
            if (!empty($st['active'])) $standardCodes[$st['standard']] = true;
        }
    }
    $standardCodes = array_keys($standardCodes);

    $orgRiskByStandard = [];
    foreach ($standardCodes as $std) {
        $risks = [];
        foreach ($sites as $site) {
            foreach ($site['standards'] as $st) {
                if (!empty($st['active']) && $st['standard'] === $std) $risks[] = $st['riskLevel'];
            }
        }
        if (count($risks) > 0) $orgRiskByStandard[$std] = averageOrgRisk($risks);
    }

    $sampling = [];
    foreach ($standardCodes as $std) {
        $eligibleSites = array_values(array_filter($sites, function ($s) use ($std) {
            if (!empty($s['isHq'])) return false;
            foreach ($s['standards'] as $st) {
                if (!empty($st['active']) && $st['standard'] === $std) return true;
            }
            return false;
        }));

        $anchorStandard = null;
        if (count($eligibleSites) > 0) {
            foreach ($eligibleSites[0]['standards'] as $st) {
                if ($st['standard'] === $std) { $anchorStandard = $st; break; }
            }
        }
        if ($anchorStandard === null) continue;

        foreach ([1, 2, 3] as $year) {
            $extensionOnly = 0;
            foreach ($eligibleSites as $s) {
                foreach ($s['standards'] as $st) {
                    if ($st['standard'] === $std && !empty($st['isExtensionSite'])) { $extensionOnly++; break; }
                }
            }
            $regularEligible = count($eligibleSites) - $extensionOnly;
            $sampleSize = calculateSampleSize([
                'startStage' => $anchorStandard['stage'],
                'year' => $year,
                'eligibleSiteCount' => $year === 1 ? count($eligibleSites) : $regularEligible,
                'extensionOnlySiteCount' => $year === 1 ? null : $extensionOnly,
            ], $params);
            $sampling[] = ['standard' => $std, 'year' => $year, 'sampleSize' => $sampleSize, 'eligibleSiteCount' => count($eligibleSites)];
        }
    }

    $totalDaysAllSites = 0;
    foreach ($siteResults as $site) {
        foreach ($site['standards'] as $std) {
            $totalDaysAllSites += $std['totalDaysFinal'];
        }
    }

    return [
        'dossierRef' => $input['dossierRef'],
        'parameterSetId' => $params['id'],
        'orgRiskByStandard' => $orgRiskByStandard,
        'sites' => $siteResults,
        'sampling' => $sampling,
        'totalDaysAllSites' => $totalDaysAllSites,
        'warnings' => $warnings,
    ];
}
