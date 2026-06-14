import { getBatteryVoltage } from "./battery";
import { type BatteryChemistry } from "@/db/schema";

/**
 * Calculates the theoretical top forward speed of the drone in km/h.
 * Integrates propeller pitch speed and aerodynamic drag limitations modeled via the Thrust-to-Weight Ratio (TWR).
 */
export function calcTopSpeed(
  propPitchInch: number,
  motorKv: number,
  cellCount: number,
  chemistry: BatteryChemistry,
  twr: number
): number {
  if (twr <= 1.0 || propPitchInch <= 0 || motorKv <= 0 || cellCount <= 0) {
    return 0;
  }

  // Nominal battery pack voltage (typical flight operating point)
  const vNominal = getBatteryVoltage(cellCount, chemistry, "nominal");

  // Under flight load, the actual motor RPM is estimated at 85% of theoretical Kv * Voltage
  const rpmLoaded = motorKv * vNominal * 0.85;

  // Pitch speed is the theoretical speed of the propeller if there was zero slip/drag
  // Speed in km/h = (RPM * Pitch) * 0.001524
  const pitchSpeedKmh = rpmLoaded * propPitchInch * 0.001524;

  // Drag efficiency coefficient modeled as a function of TWR.
  // Higher TWR allows steeper flight pitch angles, translating more thrust into forward velocity.
  const dragFactor = 1 - Math.exp(-0.15 * twr);

  return Math.max(0, pitchSpeedKmh * dragFactor);
}
