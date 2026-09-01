import { CalculationCaseInput, ParameterSet, SiteInput, RiskLevel } from "../types";
import { calculateNae, NaeResult } from "./nae";
import { calculateStandardDuration, StandardDurationResult } from "./standardDuration";
import { averageOrgRisk } from "./orgRisk";
import { calculateSampleSize } from "./cycle";

export interface SiteCalculationResult {
  siteId: string;
  name: string;
  isHq: boolean;
  nae: NaeResult;
  standards: StandardDurationResult[];
}

export interface CaseCalculationResult {
  dossierRef: string;
  parameterSetId: string;
  orgRiskByStandard: Record<string, RiskLevel>;
  sites: SiteCalculationResult[];
  sampling: { standard: string; year: number; sampleSize: number; eligibleSiteCount: number }[];
  totalDaysAllSites: number;
  warnings: string[];
}

export function calculateCase(input: CalculationCaseInput, params: ParameterSet): CaseCalculationResult {
  const warnings: string[] = [];

  if (input.multiSite && input.sites.length < params.validationBounds.multiSiteMinimumSites) {
    warnings.push(
      `Multi-site case declared with only ${input.sites.length} site(s); expected at least ${params.validationBounds.multiSiteMinimumSites}.`
    );
  }

  const siteResults: SiteCalculationResult[] = input.sites.map((site: SiteInput) => {
    const nae = calculateNae(site.personnel);
    if (!nae.crossCheckOk) {
      warnings.push(`Site "${site.name}": ${nae.crossCheckMessage}`);
    }

    const standards = site.standards
      .filter((s) => s.active)
      .map((s) => calculateStandardDuration(nae.totalNae, s, params));

    return { siteId: site.siteId, name: site.name, isHq: site.isHq, nae, standards };
  });

  // Org-wide risk per standard (§10.3), from each site's declared risk for that standard
  const orgRiskByStandard: Record<string, RiskLevel> = {};
  const standardCodes = Array.from(
    new Set(input.sites.flatMap((s) => s.standards.filter((st) => st.active).map((st) => st.standard)))
  );
  for (const std of standardCodes) {
    const risks = input.sites
      .flatMap((s) => s.standards.filter((st) => st.active && st.standard === std))
      .map((st) => st.riskLevel);
    if (risks.length > 0) orgRiskByStandard[std] = averageOrgRisk(risks);
  }

  // Sampling (§10.4) per standard, using year-1 stage as the cycle anchor from the first active site
  const sampling: CaseCalculationResult["sampling"] = [];
  for (const std of standardCodes) {
    const eligibleSites = input.sites.filter(
      (s) => !s.isHq && s.standards.some((st) => st.active && st.standard === std)
    );
    const anchorStandard = eligibleSites[0]?.standards.find((st) => st.standard === std);
    if (!anchorStandard) continue;
    for (const year of [1, 2, 3]) {
      const extensionOnly = eligibleSites.filter((s) =>
        s.standards.some((st) => st.standard === std && st.isExtensionSite)
      ).length;
      const regularEligible = eligibleSites.length - extensionOnly;
      const sampleSize = calculateSampleSize(
        {
          startStage: anchorStandard.stage,
          year,
          eligibleSiteCount: year === 1 ? eligibleSites.length : regularEligible,
          extensionOnlySiteCount: year === 1 ? undefined : extensionOnly,
        },
        params
      );
      sampling.push({ standard: std, year, sampleSize, eligibleSiteCount: eligibleSites.length });
    }
  }

  const totalDaysAllSites = siteResults.reduce(
    (sum, site) => sum + site.standards.reduce((s, std) => s + std.totalDaysFinal, 0),
    0
  );

  return {
    dossierRef: input.dossierRef,
    parameterSetId: params.id,
    orgRiskByStandard,
    sites: siteResults,
    sampling,
    totalDaysAllSites,
    warnings,
  };
}
