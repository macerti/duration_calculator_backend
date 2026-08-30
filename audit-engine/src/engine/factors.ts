import { AggregateFactorCaps, SiteStandardFactorSelection } from "../types";

export interface FactorResult {
  augmentationTotalRaw: number;
  reductionTotalRaw: number; // negative
  augmentationTotalCapped: number;
  reductionTotalCapped: number; // negative
  aggregatePercent: number; // final % applied to base duration, before override
  finalPercent: number; // override-if-present
  capsBreached: boolean;
  warnings: string[];
}

/**
 * Sums ticked factor lines (already validated per-line against the catalogue caps
 * at selection time) and applies the aggregate ±20%/−30% caps — the "real intent"
 * fix over the source tool's uncapped aggregate (spec §7, resolved decision #2).
 */
export function calculateAggregateFactor(
  selection: SiteStandardFactorSelection,
  caps: AggregateFactorCaps
): FactorResult {
  const warnings: string[] = [];

  let augTotal = selection.ticked.filter((t) => t.valuePercent > 0).reduce((s, t) => s + t.valuePercent, 0);
  let redTotal = selection.ticked.filter((t) => t.valuePercent < 0).reduce((s, t) => s + t.valuePercent, 0);

  if (selection.autreAugmentation) augTotal += selection.autreAugmentation.valuePercent;
  if (selection.autreReduction) redTotal += selection.autreReduction.valuePercent;

  let augCapped = augTotal;
  let redCapped = redTotal;
  let capsBreached = false;

  if (caps.enforceAggregateCaps) {
    if (augTotal > caps.maxAugmentationPercent) {
      augCapped = caps.maxAugmentationPercent;
      capsBreached = true;
      warnings.push(
        `Augmentation total ${augTotal}% exceeds the ${caps.maxAugmentationPercent}% aggregate cap — clipped.`
      );
    }
    if (redTotal < caps.maxReductionPercent) {
      redCapped = caps.maxReductionPercent;
      capsBreached = true;
      warnings.push(
        `Reduction total ${redTotal}% exceeds the ${caps.maxReductionPercent}% aggregate cap — clipped.`
      );
    }
  }

  const aggregatePercent = Math.round((augCapped + redCapped) * 100) / 100;
  const finalPercent = selection.overridePercent ?? aggregatePercent;

  if (!selection.justificationText || selection.justificationText.trim() === "") {
    warnings.push("Justification text is mandatory for factor selections (accreditation-defensibility trail).");
  }

  return {
    augmentationTotalRaw: augTotal,
    reductionTotalRaw: redTotal,
    augmentationTotalCapped: augCapped,
    reductionTotalCapped: redCapped,
    aggregatePercent,
    finalPercent,
    capsBreached,
    warnings,
  };
}
