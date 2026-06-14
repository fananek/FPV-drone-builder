import { getBatteryVoltage } from "./battery";
import { type BatteryChemistry } from "@/db/schema";

/**
 * Calculates the theoretical tip speed of a propeller in Mach.
 * Uses fully charged battery voltage (V_max) as the worst case.
 */
export function calcTipSpeedMach(
  propDiameterInch: number,
  motorKv: number,
  cellCount: number,
  chemistry: BatteryChemistry
): number {
  const vMax = getBatteryVoltage(cellCount, chemistry, "max");
  const rpmTheoretical = vMax * motorKv;
  const dM = propDiameterInch * 0.0254; // Convert inches to meters
  const tipSpeedMs = (Math.PI * dM * rpmTheoretical) / 60;
  const mach = tipSpeedMs / 343; // Speed of sound is 343 m/s at 20°C
  return mach;
}

/**
 * Returns a warning code if tip speed exceeds limits.
 */
export function getTipSpeedWarning(mach: number): "W-10" | "W-11" | null {
  if (mach >= 0.9) {
    return "W-11"; // Critical error
  }
  if (mach >= 0.85) {
    return "W-10"; // Caution warning
  }
  return null;
}
