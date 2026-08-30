import { NaceRiskEntry, ParameterSet, RiskLevel } from "../types";

const RAW_TO_RISK: Record<string, RiskLevel> = {
  F: "Faible",
  M: "Moyen",
  E: "Elevé",
  L: "Limité",
};

/** Expands a stored short risk code (E/M/F/L) to its full label. Combo values
 * (e.g. "M ou E") are returned as-is for the caller to resolve via the row's Tooltip. */
export function expandRiskCode(raw: string): RiskLevel | null {
  const trimmed = raw.trim();
  if (RAW_TO_RISK[trimmed]) return RAW_TO_RISK[trimmed];
  return null; // combo value or blank — caller must consult tooltip / ask user
}

export function findNaceEntry(codeNace: string, params: ParameterSet): NaceRiskEntry | undefined {
  return params.naceTable.find((e) => e.codeNace === codeNace);
}

export function searchNaceByDescription(query: string, params: ParameterSet): NaceRiskEntry[] {
  const q = query.toLowerCase();
  return params.naceTable.filter((e) => e.description.toLowerCase().includes(q));
}
