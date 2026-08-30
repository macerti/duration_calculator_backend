// ---- Core domain types shared across the calculation engine ----

export type StandardCode = "ISO9001" | "ISO45001" | "ISO14001" | string;

export type RiskLevel = "Faible" | "Moyen" | "Elevé" | "Limité";

export type Stage = "Initial" | "Renouvellement" | "Suivi 1" | "Suivi 2";

export type StageCode = "i" | "s" | "r" | "e" | "";

export type IntegrationLevel = "Elevé" | "Basique" | "Non applicable";

// ---- Parameters (admin-owned, versioned) ----

export interface IafDurationBracket {
  naeFrom: number;
  naeTo: number | null; // null = open-ended (last defined bracket, e.g. 10701+)
  daysHigh: number | null;
  daysMed: number | null;
  daysLow: number | null;
  daysLimite?: number | null; // ISO14001 only
}

export interface IafDurationTable {
  standard: StandardCode;
  brackets: IafDurationBracket[];
}

export interface NaceRiskEntry {
  codeNace: string;
  codeEac: string;
  description: string;
  codeQmQualite: string;
  smqRisque: string; // raw code, may be combo e.g. "M ou E"
  codeOhSecurite: string;
  smsRisque: string;
  codeEmEnvironnement: string;
  smeComplexite: string;
  broadCat: string;
  tooltip: string;
  accredCofracIso9001: boolean;
  accredCofracIso45001: boolean;
  accredCofracIso14001: boolean;
}

export interface FactorCatalogueItem {
  standard: StandardCode;
  direction: "augmentation" | "reduction";
  index: number; // position in the fixed 27-field serialization slot order
  label: string;
  capPercent: number; // 0 = no per-line cap (the "Autre" slot)
  tooltip?: string;
}

export interface SynergyGridEntry {
  integrationLevel: IntegrationLevel;
  capacityBandMin: number; // inclusive, 0-100
  capacityBandMax: number; // exclusive except the final band
  reductionPercent: number; // negative or 0, e.g. -10 for 10% reduction
}

export interface ValidationBounds {
  factorCellPercentMin: number;
  factorCellPercentMax: number;
  headcountMin: number;
  headcountMax: number;
  durationOverrideMin: number;
  durationOverrideMax: number;
  prepReportMin: number;
  prepReportMax: number;
  cycleYearsMin: number;
  cycleYearsMax: number;
  multiSiteMinimumSites: number; // real constraint (fixes broken NbSitesMinimum ref)
}

export interface ExtrapolationConfig {
  enabled: boolean;
  method: "linear-slope-last-two-brackets";
}

export interface AggregateFactorCaps {
  enforceAggregateCaps: boolean; // resolved design decision: yes (§7 of spec)
  maxAugmentationPercent: number; // +20
  maxReductionPercent: number; // -30
}

export interface ParameterSet {
  id: string;
  version: number;
  createdAt: string;
  changeNote?: string;
  iafDurationTables: Record<StandardCode, IafDurationTable>;
  naceTable: NaceRiskEntry[];
  factorCatalogue: FactorCatalogueItem[];
  synergyGrid: SynergyGridEntry[];
  validationBounds: ValidationBounds;
  extrapolation: ExtrapolationConfig;
  aggregateFactorCaps: AggregateFactorCaps;
  rounding: { nearest: number }; // MROUND target, 0.25
  reportWritingPercent: number; // 20
  stage1Stage2Split: { stage1: number; stage2: number; stage2FloorDays: number }; // 1/3, 2/3, 1
  stageDayCoefficients: Record<Stage, number>; // Initial=1, Renouvellement=2/3, Suivi=1/3
  surveillanceCoefficients: Record<Stage, number>; // year2/3 coefficient on net duration
  samplingCoefficients: Record<Stage, number>; // 1 / 0.8 / 0.6
}

// ---- User input (per client / calculation) ----

export interface PersonnelGroupInput {
  headcount: number;
  pctRepetitiveOrSimilar?: number; // 0-1, rule c/d
}

export interface ShiftTeamInput extends PersonnelGroupInput {
  label?: string;
}

export interface UnskilledTempInput {
  headcount: number; // rule f, mutually exclusive with other reductions on same group
}

export interface SitePersonnelInput {
  siteId: string;
  declaredTotalHeadcount: number;
  shiftTeams: ShiftTeamInput[]; // up to 5, first = key/largest shift
  nonShift: PersonnelGroupInput;
  indirect: { headcount: number };
  unskilledTemp?: UnskilledTempInput; // SMQ/SME only
}

export interface SiteStandardFactorSelection {
  standard: StandardCode;
  ticked: { index: number; valuePercent: number }[]; // per-line values, sign per direction
  autresAugmentation?: { label: string; valuePercent: number }[];
  autresReduction?: { label: string; valuePercent: number }[];
  justificationText: string; // mandatory
  overridePercent?: number; // manual override of the aggregate %
}

export interface SynergyInput {
  auditorCapabilities: { auditorId: string; qualifiedStandardCount: number }[]; // Xi per auditor
  standardsCoveredCount: number; // Y
  integrationLevel: IntegrationLevel;
  overridePercent?: number; // per-site override of synergy %
}

export interface SiteStandardInput {
  standard: StandardCode;
  active: boolean;
  stage: Stage;
  riskLevel: RiskLevel; // resolved per-site risk for this standard
  stage1Selected: boolean;
  stage2Selected: boolean;
  factors: SiteStandardFactorSelection;
  synergy?: SynergyInput;
  sampledThisYear: { [year: number]: boolean };
  isExtensionSite: boolean;
  durationOverrides?: {
    stage1?: number;
    stage2?: number;
    year2?: number;
    year3?: number;
    prepReport?: number;
  };
}

export interface SiteInput {
  siteId: string;
  name: string;
  isHq: boolean;
  naceCode: string;
  personnel: SitePersonnelInput;
  standards: SiteStandardInput[];
}

export interface CalculationCaseInput {
  dossierRef: string;
  date: string;
  commercial: string;
  scopeText: string;
  cycleYears: number; // 1-4
  auditBlanc: "Oui" | "Oui (seul)" | "Non";
  extension: { active: boolean; startYear?: 1 | 2 | 3 };
  multiSite: boolean;
  sites: SiteInput[];
  parameterSetId: string;
}

// ---- App-level entities (not part of the calculation engine itself) ----

export interface Client {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  calculationCount?: number;
}

export interface CaseSummary {
  id: number;
  dossierRef: string;
  clientId: number | null;
  status: string;
  commercial: string | null;
  totalDays: number | null;
  createdAt: string;
  updatedAt: string;
}
