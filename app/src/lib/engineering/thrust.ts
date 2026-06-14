import { type BatteryChemistry, type ThrustTestPoint } from "@/db/schema";
import { getBatteryVoltage } from "./battery";

/**
 * Linearly interpolates a field (e.g. thrustGrams, currentAmps) at a given throttle percentage
 * from an array of empirical thrust test points.
 */
export function interpolateTestPoints(
  testPoints: ThrustTestPoint[],
  targetThrottle: number,
  field: "thrustGrams" | "currentAmps" | "voltageVolts"
): number {
  if (!testPoints || testPoints.length === 0) return 0;

  // Sort test points by throttle percent
  const sortedPoints = [...testPoints].sort((a, b) => a.throttlePercent - b.throttlePercent);

  // Bounds checking
  if (targetThrottle <= sortedPoints[0].throttlePercent) {
    return sortedPoints[0][field] ?? 0;
  }
  if (targetThrottle >= sortedPoints[sortedPoints.length - 1].throttlePercent) {
    return sortedPoints[sortedPoints.length - 1][field] ?? 0;
  }

  // Find bounding points
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const p1 = sortedPoints[i];
    const p2 = sortedPoints[i + 1];

    if (targetThrottle >= p1.throttlePercent && targetThrottle <= p2.throttlePercent) {
      const range = p2.throttlePercent - p1.throttlePercent;
      if (range === 0) return p1[field] ?? 0;

      const factor = (targetThrottle - p1.throttlePercent) / range;
      const val1 = p1[field] ?? 0;
      const val2 = p2[field] ?? 0;

      return val1 + factor * (val2 - val1);
    }
  }

  return 0;
}

/**
 * Case A: Calculates max total thrust in grams from empirical test data.
 * Applies a 0.85 static-to-dynamic efficiency factor.
 */
export function calcThrustEmpiricalGrams(
  testPoints: ThrustTestPoint[],
  motorCount: number
): number {
  const maxStaticThrust = interpolateTestPoints(testPoints, 100, "thrustGrams");
  const effectiveThrust = maxStaticThrust * 0.85;
  return effectiveThrust * motorCount;
}

/**
 * Case B: Approximation formula when empirical data is absent.
 * Models loaded propeller conditions (0.83 factor) and returns total thrust in grams.
 */
export function calcThrustApproxGrams(
  diameterInch: number,
  pitchInch: number,
  kv: number,
  cellCount: number,
  chemistry: BatteryChemistry,
  motorCount: number,
  throttlePercent: number,
  blades = 3
): number {
  const vMax = getBatteryVoltage(cellCount, chemistry, "max");
  const rpmTheoretical = vMax * kv;
  const rpmReal = rpmTheoretical * 0.83 * (throttlePercent / 100);
  
  // Power model formula: 0.015 * D^3.5 * P * (RPM / 1000)^2
  let singleThrust = 0.015 * Math.pow(diameterInch, 3.5) * pitchInch * Math.pow(rpmReal / 1000, 2);
  
  // Scale thrust based on number of blades (relative to standard 3-blade prop)
  const bladeMultiplier = Math.sqrt(blades / 3);
  singleThrust *= bladeMultiplier;
  
  return singleThrust * motorCount;
}

/**
 * Calculates the min and max RPM under load, using empirical test data if available,
 * or approximating theoretical loaded RPMs based on battery chemistry and cell count.
 */
export function calcMinMaxRpm(
  testPoints: ThrustTestPoint[] | null,
  motorKv: number,
  cellCount: number,
  chemistry: BatteryChemistry
): { min: number; max: number } {
  // If we have empirical test points and they contain non-zero RPM values
  if (testPoints && testPoints.length > 0) {
    const validRpms = testPoints
      .filter((p) => p.rpm !== undefined && p.rpm !== null && p.rpm > 0)
      .map((p) => p.rpm as number);
      
    if (validRpms.length > 0) {
      const min = Math.min(...validRpms);
      const max = Math.max(...validRpms);
      return { min, max };
    }
  }

  if (motorKv <= 0 || cellCount <= 0) {
    return { min: 0, max: 0 };
  }

  // Calculate theoretical values
  const vMax = getBatteryVoltage(cellCount, chemistry, "max");
  const vNominal = getBatteryVoltage(cellCount, chemistry, "nominal");
  
  // Max loaded RPM is estimated at ~83% of theoretical unloaded RPM (matching calcThrustApproxGrams)
  const max = Math.round(motorKv * vMax * 0.83);
  
  // Min RPM is the armed idle RPM (usually around 5.5% of max throttle voltage under nominal condition)
  const min = Math.round(motorKv * vNominal * 0.055);
  
  return { min, max };
}
