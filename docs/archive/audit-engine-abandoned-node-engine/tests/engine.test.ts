import { describe, it, expect } from "vitest";
import { calculateNae } from "../src/engine/nae";
import { loadDefaultParameterSet } from "../src/data/parameters";
import { lookupBaseDuration } from "../src/engine/duration";
import { arrondiSupUnDixieme, calculerEtape } from "../src/engine/cycle";
import { mround } from "../src/engine/rounding";

describe("NAE calculation — worked example from GS0106 spec §4.4", () => {
  it("EURL EXEMPLE: declared 1000, shifts 200/100/100/0/0 @100% rep, non-shift 100@0%, indirect 500 => NAE=283", () => {
    const result = calculateNae({
      siteId: "site-1",
      declaredTotalHeadcount: 1000,
      shiftTeams: [
        { headcount: 200, pctRepetitiveOrSimilar: 1 },
        { headcount: 100, pctRepetitiveOrSimilar: 1 },
        { headcount: 100, pctRepetitiveOrSimilar: 1 },
        { headcount: 0, pctRepetitiveOrSimilar: 1 },
        { headcount: 0, pctRepetitiveOrSimilar: 1 },
      ],
      nonShift: { headcount: 100, pctRepetitiveOrSimilar: 0 },
      indirect: { headcount: 500 },
    });

    expect(result.crossCheckOk).toBe(true);
    expect(result.directShiftAdjusted).toBe(58);
    expect(result.directNonShift).toBe(100);
    expect(result.indirectAdjusted).toBe(125);
    expect(result.totalNae).toBe(283);
  });

  it("flags cross-check failure when subtotals don't match declared total", () => {
    const result = calculateNae({
      siteId: "site-2",
      declaredTotalHeadcount: 999, // wrong on purpose
      shiftTeams: [{ headcount: 200, pctRepetitiveOrSimilar: 1 }],
      nonShift: { headcount: 100, pctRepetitiveOrSimilar: 0 },
      indirect: { headcount: 500 },
    });
    expect(result.crossCheckOk).toBe(false);
    expect(result.totalNae).toBe(0);
  });
});

describe("IAF base duration lookup", () => {
  const params = loadDefaultParameterSet();

  it("NAE=0 returns 0 days", () => {
    const r = lookupBaseDuration(0, "Elevé", params.iafDurationTables.ISO9001, params);
    expect(r.days).toBe(0);
  });

  it("matches a known bracket for ISO9001 (NAE=5, High => 1.5 days)", () => {
    const r = lookupBaseDuration(5, "Elevé", params.iafDurationTables.ISO9001, params);
    expect(r.days).toBe(1.5);
    expect(r.extrapolated).toBe(false);
  });

  it("extrapolates beyond the last defined bracket instead of returning 0", () => {
    const r = lookupBaseDuration(20000, "Elevé", params.iafDurationTables.ISO9001, params);
    expect(r.extrapolated).toBe(true);
    expect(r.days).toBeGreaterThan(24); // last table value at NAE 8501-10700/High is 24
  });
});

describe("cycle helpers", () => {
  it("arrondiSupUnDixieme: 3.12 rounds to 4 (aggressive threshold)", () => {
    expect(arrondiSupUnDixieme(3.12)).toBe(4);
  });
  it("arrondiSupUnDixieme: 3.05 rounds down to 3", () => {
    expect(arrondiSupUnDixieme(3.05)).toBe(3);
  });

  it("calculerEtape: Initial year1=i, year2=s, year3=s", () => {
    expect(calculerEtape("Initial", 1, false)).toBe("i");
    expect(calculerEtape("Initial", 2, false)).toBe("s");
    expect(calculerEtape("Initial", 3, false)).toBe("s");
  });

  it("calculerEtape: Suivi 2 year1=s, year2=r, year3=s", () => {
    expect(calculerEtape("Suivi 2", 1, false)).toBe("s");
    expect(calculerEtape("Suivi 2", 2, false)).toBe("r");
    expect(calculerEtape("Suivi 2", 3, false)).toBe("s");
  });
});

describe("mround", () => {
  it("rounds to nearest quarter-day", () => {
    expect(mround(3.1, 0.25)).toBe(3);
    expect(mround(3.2, 0.25)).toBe(3.25);
  });
});
