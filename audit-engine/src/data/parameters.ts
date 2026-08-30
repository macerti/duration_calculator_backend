import { readCsvFile } from "./csv";
import {
  IafDurationTable,
  IafDurationBracket,
  NaceRiskEntry,
  FactorCatalogueItem,
  ParameterSet,
  SynergyGridEntry,
} from "../types";

function loadIafTable(standard: string, file: string, hasLimite: boolean): IafDurationTable {
  const rows = readCsvFile(file);
  const brackets: IafDurationBracket[] = rows.map((r) => {
    const naeTo = r.NAE_to.trim() === "" ? null : Number(r.NAE_to);
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    return {
      naeFrom: Number(r.NAE_from),
      naeTo,
      daysHigh: num(r.days_High),
      daysMed: num(r.days_Med),
      daysLow: num(r.days_Low),
      daysLimite: hasLimite ? num(r.days_Limite) : undefined,
    };
  });
  return { standard, brackets };
}

function loadNaceTable(): NaceRiskEntry[] {
  const rows = readCsvFile("nace_risque_table.csv");
  return rows.map((r) => ({
    codeNace: r.code_NACE,
    codeEac: r.code_EAC,
    description: r.Description,
    codeQmQualite: r.Code_QM_Qualite,
    smqRisque: r.SMQ_Risque,
    codeOhSecurite: r.Code_OH_Securite,
    smsRisque: r.SMS_Risque,
    codeEmEnvironnement: r.Code_EM_Environnement,
    smeComplexite: r.SME_Complexite,
    broadCat: r.broad_cat,
    tooltip: r.Tooltip,
    accredCofracIso9001: r.Accred_COFRAC_ISO9001 === "1",
    accredCofracIso45001: r.Accred_COFRAC_ISO45001 === "1",
    accredCofracIso14001: r.Accred_COFRAC_ISO14001 === "1",
  }));
}

/**
 * Factor catalogue transcribed verbatim from GS0106_Audit_Duration_Rules.md §7.3
 * (usfFacteurs.Initialiser). Index = position in the 27-field serialization
 * order (Aug1..Aug12, AutreAug, Reduc1..Reduc11, AutreReduc).
 */
function buildFactorCatalogue(): FactorCatalogueItem[] {
  const items: FactorCatalogueItem[] = [];
  const common5Aug = [
    ["Logistique compliquée impliquant plus d'un bâtiment ou d'un emplacement où les activités à auditer sont effectuées", 5],
    ["Personnel parlant plus d'une langue non parlée par l'équipe d'audit, nécessitant un ou plusieurs interprètes", 5],
    ["Très grand site pour le nombre de personnel (par ex une forêt)", 5],
    ["Le système couvre des processus très complexes ou un nombre relativement élevé d'activités uniques", 10],
    ["Activités qui rendent nécessaire la visite de sites temporaires pour confirmer les activités du ou des sites permanents", 10],
  ] as const;

  // ISO 9001
  const aug9001 = [
    ...common5Aug,
    ["Des processus ou des fonctions externalisés", 5],
  ];
  aug9001.forEach(([label, cap], i) =>
    items.push({ standard: "ISO9001", direction: "augmentation", index: i + 1, label: label as string, capPercent: cap as number })
  );
  const red9001 = [
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
  red9001.forEach(([label, cap], i) =>
    items.push({ standard: "ISO9001", direction: "reduction", index: i + 1, label: label as string, capPercent: cap as number })
  );

  // ISO 45001
  const aug45001 = [
    ...common5Aug,
    ["Les points de vue des parties intéressées", 5],
    ["Taux d'accident et de maladies professionnelles supérieur à la moyenne du secteur", 5],
    ["Si des membres du public sont présents sur le site de l'organisme, ex. hôpitaux, écoles, aéroports, ports, gares, transports publics", 5],
    ["L'organisme fait face à des procédures judiciaires liées à la SST, en fonction de la gravité et de l'impact du risque encouru", 5],
    ["La présence temporaire importante de nombreuses entreprises de sous-traitants et de leurs employés entraînant une augmentation de la complexité ou des risques de SST", 5],
    ["La présence de substances dangereuses en quantité exposant l'installation au risque d'accidents industriels majeurs", 5],
    ["Organisme avec des sites inclus dans le périmètre dans d'autres pays que le pays d'origine du site, si la législation et la langue ne sont pas bien connues", 5],
  ];
  aug45001.forEach(([label, cap], i) =>
    items.push({ standard: "ISO45001", direction: "augmentation", index: i + 1, label: label as string, capPercent: cap as number })
  );
  const red45001 = [
    ["Un site de très petite taille par rapport au nombre d'employés", 5],
    ["La maturité du système de management", 15],
    ["Une connaissance préalable du système de management", 15],
    ["L'état de préparation du client en vue de la certification", 15],
    ["Multi-sites — Siège : uniquement des fonctions de management et support", 15],
    ["Multi-sites — Niveau de risque différent de celui du code OH", 15],
    ["Multi-sites — Site : Réalisation de processus communs", 30],
    ["Multi-sites — Site : absence de fonctions supports", 20],
  ];
  red45001.forEach(([label, cap], i) =>
    items.push({ standard: "ISO45001", direction: "reduction", index: i + 1, label: label as string, capPercent: cap as number })
  );

  // ISO 14001
  const aug14001 = [
    ...common5Aug,
    ["Des processus ou des fonctions externalisés", 5],
    ["Une plus forte sensibilité de l'environnement comparée à un site classique du secteur", 5],
    ["Les points de vue des parties intéressées", 5],
    ["Des aspects indirects qui rendent nécessaire une augmentation du temps d'audit", 5],
    ["Des aspects environnementaux supplémentaires ou inhabituels, ou des conditions réglementaires pour le secteur", 5],
    ["Risques d'accidents environnementaux et impacts résultant ou susceptibles de survenir à la suite d'incidents, d'accidents, de situations d'urgence ou de problèmes environnementaux préexistants auxquels l'organisme a contribué", 5],
  ];
  aug14001.forEach(([label, cap], i) =>
    items.push({ standard: "ISO14001", direction: "augmentation", index: i + 1, label: label as string, capPercent: cap as number })
  );
  const red14001 = [
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
  red14001.forEach(([label, cap], i) =>
    items.push({ standard: "ISO14001", direction: "reduction", index: i + 1, label: label as string, capPercent: cap as number })
  );

  // "Autre" free slots, one per direction per standard, cap 0 = no per-line ceiling
  for (const standard of ["ISO9001", "ISO45001", "ISO14001"]) {
    items.push({ standard, direction: "augmentation", index: 0, label: "Autre (augmentation)", capPercent: 0 });
    items.push({ standard, direction: "reduction", index: 0, label: "Autre (réduction)", capPercent: 0 });
  }

  return items;
}

function buildSynergyGrid(): SynergyGridEntry[] {
  // §8.3 reduction grid, banded capacity 0-20/20-40/40-60/60-80/80-100
  const bands: [number, number][] = [
    [0, 20],
    [20, 40],
    [40, 60],
    [60, 80],
    [80, 100],
  ];
  const eleve = [0, -5, -10, -15, -20];
  const basique = [0, -5, -10, -10, -10];
  const grid: SynergyGridEntry[] = [];
  bands.forEach(([min, max], i) => {
    grid.push({ integrationLevel: "Elevé", capacityBandMin: min, capacityBandMax: max, reductionPercent: eleve[i] });
    grid.push({ integrationLevel: "Basique", capacityBandMin: min, capacityBandMax: max, reductionPercent: basique[i] });
    grid.push({ integrationLevel: "Non applicable", capacityBandMin: min, capacityBandMax: max, reductionPercent: 0 });
  });
  return grid;
}

let cached: ParameterSet | null = null;

export function loadDefaultParameterSet(): ParameterSet {
  if (cached) return cached;

  const iafDurationTables = {
    ISO9001: loadIafTable("ISO9001", "iaf_duration_iso9001.csv", false),
    ISO45001: loadIafTable("ISO45001", "iaf_duration_iso45001.csv", false),
    ISO14001: loadIafTable("ISO14001", "iaf_duration_iso14001.csv", true),
  };

  cached = {
    id: "default-v1",
    version: 1,
    createdAt: new Date().toISOString(),
    changeNote: "Initial import from LSP0301_Outil_de_calcul.xlsm extraction (GS0106_Audit_Duration_Rules.md)",
    iafDurationTables,
    naceTable: loadNaceTable(),
    factorCatalogue: buildFactorCatalogue(),
    synergyGrid: buildSynergyGrid(),
    validationBounds: {
      factorCellPercentMin: -400,
      factorCellPercentMax: 400,
      headcountMin: 1,
      headcountMax: 10000,
      durationOverrideMin: 0,
      durationOverrideMax: 10000,
      prepReportMin: 0,
      prepReportMax: 3,
      cycleYearsMin: 1,
      cycleYearsMax: 4,
      multiSiteMinimumSites: 2, // real constraint, fixes broken NbSitesMinimum named range (§15)
    },
    extrapolation: { enabled: true, method: "linear-slope-last-two-brackets" },
    aggregateFactorCaps: {
      // Resolved design decision (spec §7, item 2): enforce aggregate caps
      enforceAggregateCaps: true,
      maxAugmentationPercent: 20,
      maxReductionPercent: -30,
    },
    rounding: { nearest: 0.25 },
    reportWritingPercent: 20,
    stage1Stage2Split: { stage1: 1 / 3, stage2: 2 / 3, stage2FloorDays: 1 },
    stageDayCoefficients: {
      Initial: 1,
      Renouvellement: 2 / 3,
      "Suivi 1": 1 / 3,
      "Suivi 2": 1 / 3,
    },
    surveillanceCoefficients: {
      Initial: 1 / 3,
      Renouvellement: 1 / 2,
      "Suivi 1": 1,
      "Suivi 2": 1,
    },
    samplingCoefficients: {
      Initial: 1,
      Renouvellement: 0.8,
      "Suivi 1": 0.6,
      "Suivi 2": 0.6,
    },
  };

  return cached;
}
