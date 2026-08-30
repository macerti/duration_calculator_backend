/** MROUND(value, nearest) — round to the nearest multiple of `nearest`. */
export function mround(value: number, nearest: number): number {
  if (nearest === 0) return value;
  return Math.round(value / nearest) * nearest;
}
