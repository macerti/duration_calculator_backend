import { ParameterSet, SiteStandardInput, RiskLevel } from "../types";
import { lookupBaseDuration } from "./duration";
import { calculateAggregateFactor } from "./factors";
import { calculateSynergy } from "./synergy";
import { calculerEtape } from "./cycle";
import { mround } from "./rounding";

export interface YearResult {
  year: number;
  stageCode: string; // i/s/r/e/""
  sampledThisYear: boolean;
  onSiteDurationCalculated: number;
  onSiteDurationFinal: number; // override-if-present
}

export interface StandardDurationResult {
  standard: string;
  baseDuration: { days: number; extrapolated: boolean; bracketUsed?: string }; // F, at coeff=1
  stageDayCoefficient: number;
  iafCalculated: number; // F × coeff
  factorResult: ReturnType<typeof calculateAggregateFactor>;
  iafWithFactors: number; // I
  synergyResult?: ReturnType<typeof calculateSynergy>;
  synergyFinalPercent: number; // L
  netDuration: number; // M = I × (1+L)
  stage1Days: number;
  stage2Days: number; // floored at 1 if >0 and stage2 selected
  years: YearResult[];
  prepReportCalculated: number;
  prepReportFinal: number;
  totalDaysCalculated: number; // AC, unrounded
  totalDaysFinal: number; // AD, MROUND to nearest 0.25
}

export function calculateStandardDuration(
  nae: number,
  siteStandard: SiteStandardInput,
  params: ParameterSet
): StandardDurationResult {
  const table = params.iafDurationTables[siteStandard.standard];
  if (!table) throw new Error(`No IAF duration table configured for standard "${siteStandard.standard}"`);

  const risk: RiskLevel = siteStandard.riskLevel;
  const baseDuration = lookupBaseDuration(nae, risk, table, params);

  const stageDayCoefficient = params.stageDayCoefficients[siteStandard.stage];
  const iafCalculated = baseDuration.days * stageDayCoefficient;

  const factorResult = calculateAggregateFactor(siteStandard.factors, params.aggregateFactorCaps);
  const iafWithFactors = iafCalculated * (1 + factorResult.finalPercent / 100);

  let synergyResult: ReturnType<typeof calculateSynergy> | undefined;
  let synergyFinalPercent = 0;
  if (siteStandard.synergy) {
    synergyResult = calculateSynergy(siteStandard.synergy, params);
    synergyFinalPercent = synergyResult.finalPercent;
  }

  const netDuration = iafWithFactors * (1 + synergyFinalPercent / 100);

  // Stage 1 / Stage 2 split (§9.5) — only meaningful in the Initial year, but the
  // split fields exist per-standard regardless; caller decides which year uses them.
  const onSiteNetOfPrep = netDuration; // prep/report computed separately below, off on-site sum
  let stage1Days = 0;
  let stage2Days = 0;
  if (siteStandard.stage1Selected && siteStandard.stage2Selected) {
    stage1Days = onSiteNetOfPrep * params.stage1Stage2Split.stage1;
    stage2Days = onSiteNetOfPrep * params.stage1Stage2Split.stage2;
  } else if (siteStandard.stage1Selected) {
    stage1Days = onSiteNetOfPrep;
  } else if (siteStandard.stage2Selected) {
    stage2Days = onSiteNetOfPrep;
  }
  if (siteStandard.stage2Selected && stage2Days > 0 && stage2Days < params.stage1Stage2Split.stage2FloorDays) {
    stage2Days = params.stage1Stage2Split.stage2FloorDays;
  }
  if (siteStandard.durationOverrides?.stage1 != null) stage1Days = siteStandard.durationOverrides.stage1;
  if (siteStandard.durationOverrides?.stage2 != null) stage2Days = siteStandard.durationOverrides.stage2;

  // Years 2 & 3 surveillance (§9.6)
  const surveillanceCoeff = params.surveillanceCoefficients[siteStandard.stage];
  const years: YearResult[] = [];
  for (const yearNum of [1, 2, 3]) {
    const stageCode = calculerEtape(
      siteStandard.stage,
      yearNum,
      siteStandard.isExtensionSite,
      undefined
    );
    const sampled = siteStandard.sampledThisYear[yearNum] ?? false;

    let onSiteCalculated: number;
    if (yearNum === 1) {
      onSiteCalculated = stage1Days + stage2Days;
    } else {
      onSiteCalculated = sampled ? netDuration * surveillanceCoeff : 0;
    }

    let onSiteFinal = onSiteCalculated;
    if (yearNum === 2 && siteStandard.durationOverrides?.year2 != null) onSiteFinal = siteStandard.durationOverrides.year2;
    if (yearNum === 3 && siteStandard.durationOverrides?.year3 != null) onSiteFinal = siteStandard.durationOverrides.year3;

    years.push({
      year: yearNum,
      stageCode,
      sampledThisYear: sampled,
      onSiteDurationCalculated: onSiteCalculated,
      onSiteDurationFinal: onSiteFinal,
    });
  }

  // Prep/report time (§9.7): 20% of on-site durations for sites marked "Oui" that year.
  // Simplification note: computed here per-standard on the sum of its own years;
  // if aggregating across standards at the site level, sum first then take 20%.
  const onSiteSumForPrep = years.reduce((s, y) => s + y.onSiteDurationFinal, 0);
  const prepReportCalculated = onSiteSumForPrep * (params.reportWritingPercent / 100);
  let prepReportFinal = prepReportCalculated;
  if (siteStandard.durationOverrides?.prepReport != null) {
    prepReportFinal = Math.min(siteStandard.durationOverrides.prepReport, params.validationBounds.prepReportMax);
  }

  const totalDaysCalculated = years.reduce((s, y) => s + y.onSiteDurationCalculated, 0);
  const totalDaysFinalRaw = years.reduce((s, y) => s + y.onSiteDurationFinal, 0);
  const totalDaysFinal = mround(totalDaysFinalRaw, params.rounding.nearest);

  return {
    standard: siteStandard.standard,
    baseDuration,
    stageDayCoefficient,
    iafCalculated,
    factorResult,
    iafWithFactors,
    synergyResult,
    synergyFinalPercent,
    netDuration,
    stage1Days,
    stage2Days,
    years,
    prepReportCalculated,
    prepReportFinal,
    totalDaysCalculated,
    totalDaysFinal,
  };
}
