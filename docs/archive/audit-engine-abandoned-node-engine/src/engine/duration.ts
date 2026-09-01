import { IafDurationTable, ParameterSet, RiskLevel } from "../types";

export interface DurationLookupResult {
  days: number;
  extrapolated: boolean;
  bracketUsed?: string;
}

function riskColumn(risk: RiskLevel): "daysHigh" | "daysMed" | "daysLow" | "daysLimite" {
  switch (risk) {
    case "Elevé":
      return "daysHigh";
    case "Moyen":
      return "daysMed";
    case "Faible":
      return "daysLow";
    case "Limité":
      return "daysLimite";
  }
}

/**
 * VLOOKUP(NAE, table, col, approximate_match) against the appropriate IAF table.
 * NAE=0 returns 0 directly (source-tool behaviour, §9.2).
 * NAE>10,700 (last defined bracket's ceiling): linear-extrapolate past the table
 * instead of the source tool's silent 0-day bug (spec §7.3 resolution #3).
 */
export function lookupBaseDuration(
  nae: number,
  risk: RiskLevel,
  table: IafDurationTable,
  params: ParameterSet
): DurationLookupResult {
  if (nae <= 0) return { days: 0, extrapolated: false };

  const col = riskColumn(risk);
  const definedBrackets = table.brackets.filter((b) => b[col] != null && b.naeTo != null);

  const hit = definedBrackets.find((b) => nae >= b.naeFrom && nae <= (b.naeTo as number));
  if (hit) {
    return { days: hit[col] as number, extrapolated: false, bracketUsed: `${hit.naeFrom}-${hit.naeTo}` };
  }

  const lastBracket = definedBrackets[definedBrackets.length - 1];
  if (!lastBracket || nae <= (lastBracket.naeTo as number)) {
    // below the first bracket, or table empty — no valid data
    throw new Error(`No IAF duration bracket found for NAE=${nae}, risk=${risk}, standard=${table.standard}`);
  }

  if (!params.extrapolation.enabled) {
    return { days: 0, extrapolated: false, bracketUsed: "out-of-range (extrapolation disabled)" };
  }

  // linear-slope-last-two-brackets: use last two defined brackets' midpoints/values to derive a per-NAE slope
  const secondLast = definedBrackets[definedBrackets.length - 2];
  if (!secondLast) {
    // only one bracket exists — flat extrapolation
    return { days: lastBracket[col] as number, extrapolated: true, bracketUsed: `>${lastBracket.naeTo} (flat)` };
  }

  const x1 = (secondLast.naeFrom + (secondLast.naeTo as number)) / 2;
  const y1 = secondLast[col] as number;
  const x2 = (lastBracket.naeFrom + (lastBracket.naeTo as number)) / 2;
  const y2 = lastBracket[col] as number;
  const slope = (y2 - y1) / (x2 - x1);

  const days = y2 + slope * (nae - x2);
  return {
    days: Math.max(days, y2), // never go below the last table value
    extrapolated: true,
    bracketUsed: `>${lastBracket.naeTo} (extrapolated, slope=${slope.toFixed(6)})`,
  };
}
