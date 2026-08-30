import { ParameterSet, SynergyInput } from "../types";

export interface SynergyResult {
  capacityPercent: number; // Capacité, 0-100
  bandedReductionPercent: number; // from grid, negative or 0
  finalPercent: number; // override-if-present
}

/**
 * §8.1-8.3: Capacité = (ΣKi) / (Z × (Y-1)), then banded lookup against the
 * integration-level grid. Only meaningful when ≥2 standards are actually
 * deployed at the site (caller is responsible for that precondition, §8.4).
 */
export function calculateSynergy(input: SynergyInput, params: ParameterSet): SynergyResult {
  const Z = input.auditorCapabilities.length;
  const Y = input.standardsCoveredCount;

  let capacityPercent = 0;
  if (Z > 0 && Y > 1) {
    const sumK = input.auditorCapabilities.reduce((s, a) => {
      const Ki = a.qualifiedStandardCount === 0 ? 0 : a.qualifiedStandardCount - 1;
      return s + Ki;
    }, 0);
    capacityPercent = (sumK / (Z * (Y - 1))) * 100;
  }

  const band = params.synergyGrid.find(
    (g) =>
      g.integrationLevel === input.integrationLevel &&
      capacityPercent >= g.capacityBandMin &&
      (capacityPercent < g.capacityBandMax || g.capacityBandMax === 100)
  );

  const bandedReductionPercent = band?.reductionPercent ?? 0;
  const finalPercent = input.overridePercent ?? bandedReductionPercent;

  return { capacityPercent, bandedReductionPercent, finalPercent };
}
