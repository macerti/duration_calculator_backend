import { RiskLevel } from "../types";

const RISK_NUMERIC: Record<RiskLevel, number> = { Limité: 0, Faible: 1, Moyen: 2, Elevé: 3 };
const NUMERIC_RISK: RiskLevel[] = ["Limité", "Faible", "Moyen", "Elevé"];

/**
 * Org-wide risk = rounded average of active sites' risk levels (§10.3),
 * not simply the HQ's risk. Used as the NAE lookup risk for multi-site orgs.
 */
export function averageOrgRisk(siteRisks: RiskLevel[]): RiskLevel {
  if (siteRisks.length === 0) throw new Error("averageOrgRisk requires at least one site risk level");
  const avg = siteRisks.reduce((s, r) => s + RISK_NUMERIC[r], 0) / siteRisks.length;
  const rounded = Math.round(avg);
  return NUMERIC_RISK[Math.min(Math.max(rounded, 0), 3)];
}
