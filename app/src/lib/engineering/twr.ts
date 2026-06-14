/**
 * Calculates the Thrust-to-Weight Ratio (TWR).
 * Dimensionless, returns 0 if AUW is 0 to avoid division by zero.
 */
export function calcTWR(totalThrustGrams: number, auwGrams: number): number {
  if (auwGrams <= 0) return 0;
  return totalThrustGrams / auwGrams;
}
