import { SitePersonnelInput } from "../types";

export interface NaeLineResult {
  label: string;
  headcount: number;
  pctRepetitiveOrSimilar: number;
  nae: number;
  explanation: string;
}

export interface NaeResult {
  siteId: string;
  crossCheckOk: boolean;
  crossCheckMessage?: string; // "Prb. De saisie" equivalent when subtotals != declared total
  shiftLines: NaeLineResult[];
  nonShiftLine: NaeLineResult;
  indirectLine: NaeLineResult;
  directShiftAdjusted: number; // F29
  directNonShift: number; // L29
  indirectAdjusted: number; // P29
  totalNae: number; // E31
}

/** Rule c/d row formula: ROUNDUP(Effectif * (1 - 0.75*%rep), 0) */
function rowNae(headcount: number, pctRep: number): number {
  return Math.ceil(headcount * (1 - 0.75 * pctRep));
}

/**
 * Full NAE calculation for one site, replicating sheet `1. NAE`.
 * See GS0106_Audit_Duration_Rules.md §4.4 for the exact cell formulas this mirrors.
 */
export function calculateNae(input: SitePersonnelInput): NaeResult {
  const shiftLines: NaeLineResult[] = input.shiftTeams.map((team, i) => {
    const pct = team.pctRepetitiveOrSimilar ?? 0;
    const nae = rowNae(team.headcount, pct);
    return {
      label: team.label ?? `Equipe ${i + 1}`,
      headcount: team.headcount,
      pctRepetitiveOrSimilar: pct,
      nae,
      explanation: `${team.headcount} × (1 − 0.75×${pct}) = ${nae} NAE`,
    };
  });

  const nonShiftPct = input.nonShift.pctRepetitiveOrSimilar ?? 0;
  const nonShiftNae = rowNae(input.nonShift.headcount, nonShiftPct);
  const nonShiftLine: NaeLineResult = {
    label: "Non en équipe",
    headcount: input.nonShift.headcount,
    pctRepetitiveOrSimilar: nonShiftPct,
    nae: nonShiftNae,
    explanation: `${input.nonShift.headcount} × (1 − 0.75×${nonShiftPct}) = ${nonShiftNae} NAE`,
  };

  const indirectNae = Math.ceil(input.indirect.headcount / 4);
  const indirectLine: NaeLineResult = {
    label: "Indirect (admin/RH/finance)",
    headcount: input.indirect.headcount,
    pctRepetitiveOrSimilar: 1,
    nae: indirectNae,
    explanation: `${input.indirect.headcount} ÷ 4 = ${indirectNae} NAE`,
  };

  // Rule e: shift aggregation — key/largest shift (first entry) full value + sqrt of the rest
  const keyShift = shiftLines[0]?.nae ?? 0;
  const remainingShiftsSum = shiftLines.slice(1).reduce((s, l) => s + l.nae, 0);
  const directShiftAdjusted = shiftLines.length > 0 ? Math.ceil(keyShift + Math.sqrt(remainingShiftsSum)) : 0;

  const directNonShift = nonShiftNae; // passthrough, no sqrt needed for single row
  const indirectAdjusted = indirectNae;

  // Cross-check: sum of all declared sub-group headcounts must equal declared total
  const subtotal =
    input.shiftTeams.reduce((s, t) => s + t.headcount, 0) +
    input.nonShift.headcount +
    input.indirect.headcount;
  const crossCheckOk = subtotal === input.declaredTotalHeadcount;

  const totalNae = crossCheckOk ? directShiftAdjusted + directNonShift + indirectAdjusted : 0;

  return {
    siteId: input.siteId,
    crossCheckOk,
    crossCheckMessage: crossCheckOk
      ? undefined
      : `Prb. De saisie — subtotal (${subtotal}) does not match declared total (${input.declaredTotalHeadcount})`,
    shiftLines,
    nonShiftLine,
    indirectLine,
    directShiftAdjusted,
    directNonShift,
    indirectAdjusted,
    totalNae,
  };
}

/** Rule f: unskilled temp, SMQ/SME only, mutually exclusive with other reductions on that group. NAE = sqrt(x) */
export function calculateUnskilledTempNae(headcount: number): number {
  return Math.ceil(Math.sqrt(headcount));
}
