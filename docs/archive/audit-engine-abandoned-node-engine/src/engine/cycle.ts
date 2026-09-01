import { Stage, StageCode, ParameterSet } from "../types";

const CYCLE_TABLE: Record<Stage, StageCode[]> = {
  Initial: ["i", "s", "s"],
  Renouvellement: ["r", "s", "s"],
  "Suivi 1": ["s", "s", "r"],
  "Suivi 2": ["s", "r", "s"],
};

/**
 * CalculerEtape (§9.4): what stage-code applies in a given cycle year, given
 * the stage the client started from. year is 1-based, wraps via (year-1) mod 3.
 */
export function calculerEtape(
  startStage: Stage,
  year: number,
  isExtensionSite: boolean,
  extensionStartYear?: 1 | 2 | 3
): StageCode {
  if (isExtensionSite) {
    if (extensionStartYear == null) return "";
    if (year === extensionStartYear) return "e";
    if (year >= extensionStartYear) return "s";
    return "";
  }
  const cycle = CYCLE_TABLE[startStage];
  return cycle[(year - 1) % 3];
}

/** ArrondiSupUnDixieme: round up if fractional part >= 0.1, else round down. */
export function arrondiSupUnDixieme(value: number): number {
  const frac = value - Math.floor(value);
  return frac >= 0.1 ? Math.ceil(value) : Math.floor(value);
}

export interface SamplingInput {
  startStage: Stage;
  year: number; // 1, 2, or 3
  eligibleSiteCount: number; // excludes HQ, excludes extension-only sites
  extensionOnlySiteCount?: number; // only relevant years 2-3
}

/**
 * §10.4 IAF MD1 √n sampling. Year 1 uses the plain formula; years 2-3 add a
 * separate √(extension-only sites) term on top.
 */
export function calculateSampleSize(input: SamplingInput, params: ParameterSet): number {
  const coeff = params.samplingCoefficients[input.startStage];
  const base = Math.sqrt(input.eligibleSiteCount) * coeff;

  if (input.year === 1 || !input.extensionOnlySiteCount) {
    return arrondiSupUnDixieme(base);
  }

  const extensionTerm = Math.sqrt(input.extensionOnlySiteCount);
  return arrondiSupUnDixieme(base + extensionTerm);
}

export type { Stage };
