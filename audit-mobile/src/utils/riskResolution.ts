import { NaceRiskEntry, RiskLevel, StandardCode } from "../types/engine";

const CODE_TO_SEVERITY: Record<string, number> = { L: 0, F: 1, M: 2, E: 3 };
const SEVERITY_TO_LABEL: RiskLevel[] = ["Limité", "Faible", "Moyen", "Elevé"];

/** Parses a raw risk code cell, which may be a single letter (E/M/F/L) or a
 * combo like "M ou E" / "F ou M ou E", and returns the highest severity found. */
function maxSeverityInCode(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const tokens = raw.split(/\s*ou\s*/i).map((t) => t.trim().toUpperCase());
  const severities = tokens
    .map((t) => CODE_TO_SEVERITY[t])
    .filter((s): s is number => s !== undefined);
  if (severities.length === 0) return null;
  return Math.max(...severities);
}

function riskFieldForStandard(standard: StandardCode): keyof NaceRiskEntry | null {
  switch (standard) {
    case "ISO9001":
      return "smqRisque";
    case "ISO45001":
      return "smsRisque";
    case "ISO14001":
      return "smeComplexite";
    default:
      return null;
  }
}

/**
 * Resolves the "most critical" risk level for a given standard, across up to
 * two selected NACE sectors for a site (business rule: a site can declare 2
 * sectors, but the audit calculation uses whichever is more severe).
 * Returns null if the standard has no risk mapping, or neither sector has a
 * parseable code for it.
 */
export function resolveMostCriticalRisk(
  entries: NaceRiskEntry[],
  standard: StandardCode
): RiskLevel | null {
  const field = riskFieldForStandard(standard);
  if (!field) return null;

  let maxSeverity: number | null = null;
  for (const entry of entries) {
    const raw = String(entry[field] ?? "");
    const severity = maxSeverityInCode(raw);
    if (severity !== null && (maxSeverity === null || severity > maxSeverity)) {
      maxSeverity = severity;
    }
  }
  if (maxSeverity === null) return null;
  return SEVERITY_TO_LABEL[maxSeverity];
}
