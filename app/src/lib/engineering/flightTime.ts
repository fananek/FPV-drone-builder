import { type BatteryChemistry, type ThrustTestPoint } from "@/db/schema";
import { getBatteryVoltage } from "./battery";
import { calcThrustApproxGrams, interpolateTestPoints } from "./thrust";

/**
 * Calculates the throttle percentage required to hover (when thrust equals AUW).
 */
export function calcHoverThrottle(
  auwGrams: number,
  motorCount: number,
  testPoints: ThrustTestPoint[] | null,
  diameterInch?: number,
  pitchInch?: number,
  kv?: number,
  cellCount?: number,
  chemistry?: BatteryChemistry,
  blades?: number
): number {
  if (motorCount <= 0 || auwGrams <= 0) return 0;
  const targetThrustPerMotor = auwGrams / motorCount;

  // Case A: Empirical Data Available
  if (testPoints && testPoints.length > 0) {
    const sortedPoints = [...testPoints].sort((a, b) => a.thrustGrams - b.thrustGrams);
    
    if (targetThrustPerMotor <= sortedPoints[0].thrustGrams) {
      return sortedPoints[0].throttlePercent;
    }
    const maxThrust = sortedPoints[sortedPoints.length - 1].thrustGrams;
    if (targetThrustPerMotor >= maxThrust) {
      return sortedPoints[sortedPoints.length - 1].throttlePercent;
    }

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];
      if (targetThrustPerMotor >= p1.thrustGrams && targetThrustPerMotor <= p2.thrustGrams) {
        const range = p2.thrustGrams - p1.thrustGrams;
        if (range === 0) return p1.throttlePercent;
        const factor = (targetThrustPerMotor - p1.thrustGrams) / range;
        return p1.throttlePercent + factor * (p2.throttlePercent - p1.throttlePercent);
      }
    }
    return 50; // Fallback
  }

  // Case B: Approximation Fallback
  if (
    diameterInch !== undefined &&
    pitchInch !== undefined &&
    kv !== undefined &&
    cellCount !== undefined &&
    chemistry !== undefined
  ) {
    // Generate 21 points from 0 to 100 (5% steps)
    const points: { throttlePercent: number; thrustGrams: number }[] = [];
    for (let t = 0; t <= 100; t += 5) {
      const thrust = calcThrustApproxGrams(
        diameterInch,
        pitchInch,
        kv,
        cellCount,
        chemistry,
        1, // single motor
        t,
        blades || 3
      );
      points.push({ throttlePercent: t, thrustGrams: thrust });
    }

    if (targetThrustPerMotor <= points[0].thrustGrams) {
      return points[0].throttlePercent;
    }
    if (targetThrustPerMotor >= points[points.length - 1].thrustGrams) {
      return points[points.length - 1].throttlePercent;
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (targetThrustPerMotor >= p1.thrustGrams && targetThrustPerMotor <= p2.thrustGrams) {
        const range = p2.thrustGrams - p1.thrustGrams;
        if (range === 0) return p1.throttlePercent;
        const factor = (targetThrustPerMotor - p1.thrustGrams) / range;
        return p1.throttlePercent + factor * (p2.throttlePercent - p1.throttlePercent);
      }
    }
  }

  return 50; // absolute fallback
}

/**
 * Calculates the current draw of a single motor in amps at a specific throttle percent.
 */
export function calcCurrentApproxAmps(
  diameterInch: number,
  pitchInch: number,
  kv: number,
  cellCount: number,
  chemistry: BatteryChemistry,
  throttlePercent: number,
  blades = 3
): number {
  if (throttlePercent <= 0) return 0.05; // tiny idle current

  const vNominal = getBatteryVoltage(cellCount, chemistry, "nominal");
  const rpmTheoretical = vNominal * kv;
  const rpmReal = rpmTheoretical * 0.83 * (throttlePercent / 100);

  // Compute thrust at this loaded RPM and nominal voltage
  let singleThrust = 0.015 * Math.pow(diameterInch, 3.5) * pitchInch * Math.pow(rpmReal / 1000, 2);
  const bladeMultiplier = Math.sqrt(blades / 3);
  singleThrust *= bladeMultiplier;

  // Mechanical power (Watts) = Thrust (N) * Pitch (m) * (RPM / 60)
  const thrustN = singleThrust * 0.00980665;
  const pitchM = pitchInch * 0.0254;
  const rpmRps = rpmReal / 60;
  const pMech = thrustN * pitchM * rpmRps;

  // Current = P_mech / (efficiency * V_nominal)
  const efficiency = 0.80;
  const current = pMech / (efficiency * vNominal);

  // Add a small constant idle draw
  return current + 0.1;
}

/**
 * Calculates the total current draw for the drone at a specific throttle percentage.
 */
export function calcTotalCurrentAmps(
  throttlePercent: number,
  motorCount: number,
  testPoints: ThrustTestPoint[] | null,
  diameterInch?: number,
  pitchInch?: number,
  kv?: number,
  cellCount?: number,
  chemistry?: BatteryChemistry,
  blades?: number
): number {
  if (motorCount <= 0) return 0;

  // Case A: Empirical Data Available
  if (testPoints && testPoints.length > 0) {
    const singleCurrent = interpolateTestPoints(testPoints, throttlePercent, "currentAmps");
    return singleCurrent * motorCount;
  }

  // Case B: Approximation Fallback
  if (
    diameterInch !== undefined &&
    pitchInch !== undefined &&
    kv !== undefined &&
    cellCount !== undefined &&
    chemistry !== undefined
  ) {
    const singleCurrent = calcCurrentApproxAmps(
      diameterInch,
      pitchInch,
      kv,
      cellCount,
      chemistry,
      throttlePercent,
      blades || 3
    );
    return singleCurrent * motorCount;
  }

  return 0;
}

/**
 * Calculates estimated flight time in minutes.
 * Assumes an 80% usable discharge limit.
 */
export function calcFlightTime(capacityMah: number, totalCurrentAmps: number): number {
  if (totalCurrentAmps <= 0) return 0;
  // FlightTime (min) = (Capacity (mAh) * 0.001 * 0.80) / TotalCurrent (A) * 60
  return ((capacityMah * 0.001 * 0.80) / totalCurrentAmps) * 60;
}
