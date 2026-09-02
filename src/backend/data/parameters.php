<?php
declare(strict_types=1);

namespace AuditEngine;

/**
 * Parses a CSV file (header row + data rows) into an array of associative arrays.
 * Handles CRLF; PHP's built-in fgetcsv handles quoted fields natively.
 */
function readCsvFile(string $path): array
{
    $rows = [];
    $handle = fopen($path, 'r');
    if ($handle === false) {
        throw new \RuntimeException("Could not open CSV file: $path");
    }
    $header = fgetcsv($handle);
    if ($header === false) {
        fclose($handle);
        return [];
    }
    $header = array_map('trim', $header);
    while (($row = fgetcsv($handle)) !== false) {
        if (count(array_filter($row, fn($v) => trim((string)$v) !== '')) === 0) continue;
        $assoc = [];
        foreach ($header as $i => $col) {
            $assoc[$col] = isset($row[$i]) ? trim((string)$row[$i]) : '';
        }
        $rows[] = $assoc;
    }
    fclose($handle);
    return $rows;
}

function loadIafTable(string $standard, string $file, bool $hasLimite): array
{
    $rows = readCsvFile(__DIR__ . '/raw/' . $file);
    $brackets = [];
    foreach ($rows as $r) {
        $naeTo = trim($r['NAE_to']) === '' ? null : (float)$r['NAE_to'];
        $num = fn($v) => trim($v) === '' ? null : (float)$v;
        $brackets[] = [
            'naeFrom' => (float)$r['NAE_from'],
            'naeTo' => $naeTo,
            'daysHigh' => $num($r['days_High']),
            'daysMed' => $num($r['days_Med']),
            'daysLow' => $num($r['days_Low']),
            'daysLimite' => $hasLimite ? $num($r['days_Limite'] ?? '') : null,
        ];
    }
    return ['standard' => $standard, 'brackets' => $brackets];
}

function loadNaceTable(): array
{
    $rows = readCsvFile(__DIR__ . '/raw/nace_risque_table.csv');
    $out = [];
    foreach ($rows as $r) {
        $out[] = [
            'codeNace' => $r['code_NACE'],
            'codeEac' => $r['code_EAC'],
            'description' => $r['Description'],
            'codeQmQualite' => $r['Code_QM_Qualite'],
            'smqRisque' => $r['SMQ_Risque'],
            'codeOhSecurite' => $r['Code_OH_Securite'],
            'smsRisque' => $r['SMS_Risque'],
            'codeEmEnvironnement' => $r['Code_EM_Environnement'],
            'smeComplexite' => $r['SME_Complexite'],
            'broadCat' => $r['broad_cat'],
            'tooltip' => $r['Tooltip'],
            'accredCofracIso9001' => ($r['Accred_COFRAC_ISO9001'] ?? '') === '1',
            'accredCofracIso45001' => ($r['Accred_COFRAC_ISO45001'] ?? '') === '1',
            'accredCofracIso14001' => ($r['Accred_COFRAC_ISO14001'] ?? '') === '1',
        ];
    }
    return $out;
}

/**
 * Factor catalogue transcribed verbatim from GS0106_Audit_Duration_Rules.md §7.3.
 * Mirrors audit-engine/src/data/parameters.ts buildFactorCatalogue() exactly.
 */
function buildFactorCatalogue(): array
{
    $items = [];
    $common5Aug = [
        ["Logistique compliquée impliquant plus d'un bâtiment ou d'un emplacement où les activités à auditer sont effectuées", 5],
        ["Personnel parlant plus d'une langue non parlée par l'équipe d'audit, nécessitant un ou plusieurs interprètes", 5],
        ["Très grand site pour le nombre de personnel (par ex une forêt)", 5],
        ["Le système couvre des processus très complexes ou un nombre relativement élevé d'activités uniques", 10],
        ["Activités qui rendent nécessaire la visite de sites temporaires pour confirmer les activités du ou des sites permanents", 10],
    ];

    $aug9001 = array_merge($common5Aug, [
        ["Des processus ou des fonctions externalisés", 5],
    ]);
    foreach ($aug9001 as $i => [$label, $cap]) {
        $items[] = ['standard' => 'ISO9001', 'direction' => 'augmentation', 'index' => $i + 1, 'label' => $label, 'capPercent' => $cap];
    }
    $red9001 = [
        ["Le client n'est pas responsable de la conception ou d'une autre exigence de la norme", 15],
        ["Un site de très petite taille par rapport au nombre d'employés, ex. site de bureau uniquement", 5],
        ["La maturité du système de management", 15],
        ["Une connaissance préalable du système de management, ex. déjà certifié pour autre système par SGS", 15],
        ["L'état de préparation du client en vue de la certification, ex. déjà certifié/reconnu par schéma tierce partie", 15],
        ["Le niveau d'automatisation élevé", 5],
        ["Il est possible d'auditer correctement la conformité des activités de personnel qui travaille hors site en examinant des dossiers", 5],
        ["Multi-sites — Siège : uniquement des fonctions de management et support", 15],
        ["Multi-sites — Niveau de risque différent de celui du code QM", 15],
        ["Multi-sites — Site : Réalisation de processus communs", 30],
        ["Multi-sites — Site : absence de fonctions supports", 20],
    ];
    foreach ($red9001 as $i => [$label, $cap]) {
        $items[] = ['standard' => 'ISO9001', 'direction' => 'reduction', 'index' => $i + 1, 'label' => $label, 'capPercent' => $cap];
    }

    $aug45001 = array_merge($common5Aug, [
        ["Les points de vue des parties intéressées", 5],
        ["Taux d'accident et de maladies professionnelles supérieur à la moyenne du secteur", 5],
        ["Si des membres du public sont présents sur le site de l'organisme, ex. hôpitaux, écoles, aéroports, ports, gares, transports publics", 5],
        ["L'organisme fait face à des procédures judiciaires liées à la SST, en fonction de la gravité et de l'impact du risque encouru", 5],
        ["La présence temporaire importante de nombreuses entreprises de sous-traitants et de leurs employés entraînant une augmentation de la complexité ou des risques de SST", 5],
        ["La présence de substances dangereuses en quantité exposant l'installation au risque d'accidents industriels majeurs", 5],
        ["Organisme avec des sites inclus dans le périmètre dans d'autres pays que le pays d'origine du site, si la législation et la langue ne sont pas bien connues", 5],
    ]);
    foreach ($aug45001 as $i => [$label, $cap]) {
        $items[] = ['standard' => 'ISO45001', 'direction' => 'augmentation', 'index' => $i + 1, 'label' => $label, 'capPercent' => $cap];
    }
    $red45001 = [
        ["Un site de très petite taille par rapport au nombre d'employés", 5],
        ["La maturité du système de management", 15],
        ["Une connaissance préalable du système de management", 15],
        ["L'état de préparation du client en vue de la certification", 15],
        ["Multi-sites — Siège : uniquement des fonctions de management et support", 15],
        ["Multi-sites — Niveau de risque différent de celui du code OH", 15],
        ["Multi-sites — Site : Réalisation de processus communs", 30],
        ["Multi-sites — Site : absence de fonctions supports", 20],
    ];
    foreach ($red45001 as $i => [$label, $cap]) {
        $items[] = ['standard' => 'ISO45001', 'direction' => 'reduction', 'index' => $i + 1, 'label' => $label, 'capPercent' => $cap];
    }

    $aug14001 = array_merge($common5Aug, [
        ["Des processus ou des fonctions externalisés", 5],
        ["Une plus forte sensibilité de l'environnement comparée à un site classique du secteur", 5],
        ["Les points de vue des parties intéressées", 5],
        ["Des aspects indirects qui rendent nécessaire une augmentation du temps d'audit", 5],
        ["Des aspects environnementaux supplémentaires ou inhabituels, ou des conditions réglementaires pour le secteur", 5],
        ["Risques d'accidents environnementaux et impacts résultant ou susceptibles de survenir à la suite d'incidents, d'accidents, de situations d'urgence ou de problèmes environnementaux préexistants auxquels l'organisme a contribué", 5],
    ]);
    foreach ($aug14001 as $i => [$label, $cap]) {
        $items[] = ['standard' => 'ISO14001', 'direction' => 'augmentation', 'index' => $i + 1, 'label' => $label, 'capPercent' => $cap];
    }
    $red14001 = [
        ["Un site de très petite taille par rapport au nombre d'employés", 5],
        ["La maturité du système de management", 15],
        ["Une connaissance préalable du système de management", 15],
        ["L'état de préparation du client en vue de la certification", 15],
        ["Le niveau d'automatisation élevé", 5],
        ["Il est possible d'auditer correctement la conformité des activités hors site en examinant des dossiers", 5],
        ["Multi-sites — Siège : uniquement des fonctions de management et support", 15],
        ["Multi-sites — Niveau de risque différent de celui du code EM", 15],
        ["Multi-sites — Site : Réalisation de processus communs", 30],
        ["Multi-sites — Site : absence de fonctions supports", 20],
    ];
    foreach ($red14001 as $i => [$label, $cap]) {
        $items[] = ['standard' => 'ISO14001', 'direction' => 'reduction', 'index' => $i + 1, 'label' => $label, 'capPercent' => $cap];
    }

    foreach (['ISO9001', 'ISO45001', 'ISO14001'] as $standard) {
        $items[] = ['standard' => $standard, 'direction' => 'augmentation', 'index' => 0, 'label' => 'Autre (augmentation)', 'capPercent' => 0];
        $items[] = ['standard' => $standard, 'direction' => 'reduction', 'index' => 0, 'label' => 'Autre (réduction)', 'capPercent' => 0];
    }

    return $items;
}

function buildSynergyGrid(): array
{
    $bands = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 100]];
    $eleve = [0, -5, -10, -15, -20];
    $basique = [0, -5, -10, -10, -10];
    $grid = [];
    foreach ($bands as $i => [$min, $max]) {
        $grid[] = ['integrationLevel' => 'Elevé', 'capacityBandMin' => $min, 'capacityBandMax' => $max, 'reductionPercent' => $eleve[$i]];
        $grid[] = ['integrationLevel' => 'Basique', 'capacityBandMin' => $min, 'capacityBandMax' => $max, 'reductionPercent' => $basique[$i]];
        $grid[] = ['integrationLevel' => 'Non applicable', 'capacityBandMin' => $min, 'capacityBandMax' => $max, 'reductionPercent' => 0];
    }
    return $grid;
}

function loadDefaultParameterSet(): array
{
    static $cached = null;
    if ($cached !== null) return $cached;

    $cached = [
        'id' => 'default-v1',
        'version' => 1,
        'createdAt' => date('c'),
        'changeNote' => 'Initial import from LSP0301_Outil_de_calcul.xlsm extraction (GS0106_Audit_Duration_Rules.md) — PHP port',
        'iafDurationTables' => [
            'ISO9001' => loadIafTable('ISO9001', 'iaf_duration_iso9001.csv', false),
            'ISO45001' => loadIafTable('ISO45001', 'iaf_duration_iso45001.csv', false),
            'ISO14001' => loadIafTable('ISO14001', 'iaf_duration_iso14001.csv', true),
        ],
        'naceTable' => loadNaceTable(),
        'factorCatalogue' => buildFactorCatalogue(),
        'synergyGrid' => buildSynergyGrid(),
        'validationBounds' => [
            'factorCellPercentMin' => -400,
            'factorCellPercentMax' => 400,
            'headcountMin' => 1,
            'headcountMax' => 10000,
            'durationOverrideMin' => 0,
            'durationOverrideMax' => 10000,
            'prepReportMin' => 0,
            'prepReportMax' => 3,
            'cycleYearsMin' => 1,
            'cycleYearsMax' => 4,
            'multiSiteMinimumSites' => 2,
        ],
        'extrapolation' => ['enabled' => true, 'method' => 'linear-slope-last-two-brackets'],
        'aggregateFactorCaps' => [
            'enforceAggregateCaps' => true,
            'maxAugmentationPercent' => 20,
            'maxReductionPercent' => -30,
        ],
        'rounding' => ['nearest' => 0.25],
        'reportWritingPercent' => 20,
        'stage1Stage2Split' => ['stage1' => 1 / 3, 'stage2' => 2 / 3, 'stage2FloorDays' => 1],
        'stageDayCoefficients' => [
            'Initial' => 1,
            'Renouvellement' => 2 / 3,
            'Suivi 1' => 1 / 3,
            'Suivi 2' => 1 / 3,
        ],
        'surveillanceCoefficients' => [
            'Initial' => 1 / 3,
            'Renouvellement' => 1 / 2,
            'Suivi 1' => 1,
            'Suivi 2' => 1,
        ],
        'samplingCoefficients' => [
            'Initial' => 1,
            'Renouvellement' => 0.8,
            'Suivi 1' => 0.6,
            'Suivi 2' => 0.6,
        ],
    ];

    return $cached;
}
