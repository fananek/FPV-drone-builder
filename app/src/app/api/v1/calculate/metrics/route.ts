import { NextResponse } from "next/server";
import { db } from "@/db";
import { parts, customParts, thrustTestData, type BatteryChemistry } from "@/db/schema";
import { inArray, and, eq } from "drizzle-orm";
import { ok, err } from "@/lib/api-response";
import {
  calcAUW,
  calcTWR,
  calcTipSpeedMach,
  calcEscCurrentHeadroom,
  calcHoverThrottle,
  calcTotalCurrentAmps,
  calcFlightTime,
  runAllValidations,
  calcThrustEmpiricalGrams,
  calcThrustApproxGrams,
  calcTopSpeed,
  calcControlFeel,
  calcMinMaxRpm
} from "@/lib/engineering";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { components, customPayloadWeightGrams } = body;

    if (!components || !Array.isArray(components)) {
      return err("BAD_REQUEST", "Payload must contain an array of components.", 400);
    }

    const customPayloadWeight = parseFloat(customPayloadWeightGrams || "0");

    // Extract database IDs
    const partIds = components.map((c: any) => c.partId).filter(Boolean) as string[];
    const customPartIds = components.map((c: any) => c.customPartId).filter(Boolean) as string[];

    // Fetch details
    const resolvedParts = partIds.length > 0
      ? await db.select().from(parts).where(inArray(parts.id, partIds))
      : [];

    const resolvedCustomParts = customPartIds.length > 0
      ? await db.select().from(customParts).where(inArray(customParts.id, customPartIds))
      : [];

    const partsMap = new Map(resolvedParts.map((p) => [p.id, p]));
    const customPartsMap = new Map(resolvedCustomParts.map((cp) => [cp.id, cp]));

    // Reconstruct list of components with details
    const expandedComponents = components.map((c: any) => ({
      slot: c.slot,
      quantity: c.quantity || 1,
      part: c.partId ? partsMap.get(c.partId) || null : null,
      customPart: c.customPartId ? customPartsMap.get(c.customPartId) || null : null,
    }));

    // Helper to extract attributes by category
    const getCompAttributes = (subCat: string) => {
      const comp = expandedComponents.find(
        (c) => c.part?.subCategory === subCat || c.customPart?.subCategory === subCat
      );
      if (!comp) return null;

      if (comp.part) {
        const attrs = comp.part.attributes;
        return typeof attrs === "string" ? JSON.parse(attrs) : attrs;
      }
      if (comp.customPart) {
        const specs = comp.customPart.keySpecs || {};
        const parseArray = (val: any) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          return String(val).split(",").map(s => s.trim()).filter(Boolean);
        };
        return {
          wheelbaseMm: parseFloat(specs.wheelbaseMm || "0"),
          armThicknessMm: parseFloat(specs.armThicknessMm || "0"),
          maxPropSizeInch: parseFloat(specs.maxPropSizeInch || "0"),
          fcMountingPattern: parseArray(specs.fcMountingPattern),
          motorMountingPattern: parseArray(specs.motorMountingPattern),
          vtxMountingPattern: parseArray(specs.vtxMountingPattern),
          mountingPattern: specs.mountingPattern || "",
          inputVoltagesMax: parseInt(specs.inputVoltagesMax || "0", 10),
          firmware: specs.firmware || "",
          gyro: specs.gyro || "",
          mcu: specs.mcu || "",
          hasBec: specs.hasBec === "true" || specs.hasBec === "yes",
          continuousCurrentAmps: parseFloat(specs.continuousCurrentAmps || "0"),
          burstCurrentAmps: parseFloat(specs.burstCurrentAmps || "0"),
          motorOutputCount: parseInt(specs.motorOutputCount || "4", 10),
          kv: parseInt(specs.kv || "0", 10),
          statorDiameterMm: parseFloat(specs.statorDiameterMm || "0"),
          statorHeightMm: parseFloat(specs.statorHeightMm || "0"),
          propMountingPattern: parseArray(specs.propMountingPattern),
          maxCurrentDraw: parseFloat(specs.maxCurrentDraw || "0"),
          cellCount: parseInt(specs.cellCount || specs.batteryCellCount || "0", 10),
          capacityMah: parseFloat(specs.capacityMah || "0"),
          cRating: parseInt(specs.cRating || "0", 10),
          chemistry: specs.chemistry || "LiPo",
          diameterInch: parseFloat(specs.diameterInch || "0"),
          pitchInch: parseFloat(specs.pitchInch || "0"),
          blades: parseInt(specs.blades || "3", 10),
          inputVoltageMin: parseFloat(specs.inputVoltageMin || "0"),
          inputVoltageMax: parseFloat(specs.inputVoltageMax || "0"),
          maxPowerMw: parseInt(specs.maxPowerMw || "0"),
          protocol: specs.protocol || "",
        };
      }
      return null;
    };

    // Calculate AUW
    const simpleComps = expandedComponents.map((c) => ({
      weightGrams: c.part?.weightGrams ?? c.customPart?.weightGrams ?? 0,
      quantity: c.quantity,
    }));
    const auw = calcAUW(simpleComps, customPayloadWeight);

    // Resolve parts for calculations
    const motorComp = expandedComponents.find(c => c.part?.subCategory === "MOTOR" || c.customPart?.subCategory === "MOTOR");
    const propComp = expandedComponents.find(c => c.part?.subCategory === "PROPELLER" || c.customPart?.subCategory === "PROPELLER");
    const batteryComp = expandedComponents.find(c => c.part?.subCategory === "BATTERY" || c.customPart?.subCategory === "BATTERY");
    const escComp = expandedComponents.find(c => c.part?.subCategory === "ESC" || c.part?.subCategory === "AIO" || c.customPart?.subCategory === "ESC" || c.customPart?.subCategory === "AIO");

    const motor = getCompAttributes("MOTOR");
    const prop = getCompAttributes("PROPELLER");
    const battery = getCompAttributes("BATTERY");
    const esc = getCompAttributes("ESC") || getCompAttributes("AIO");

    // Gather motor count (sum quantities of motor components)
    const motorCount = expandedComponents
      .filter((c) => c.part?.subCategory === "MOTOR" || c.customPart?.subCategory === "MOTOR")
      .reduce((sum, c) => sum + c.quantity, 0) || 4;

    let twr = 0;
    let tipSpeedMach = 0;
    let escCurrentHeadroom = 0;
    let isEstimated = true;
    let hoverThrottle = 0;
    let flightTimes = { hover: 0, freestyle: 0, racing: 0 };
    let thrustCurvePoints: any[] = [];

    // Tip Speed
    if (prop && motor && battery) {
      tipSpeedMach = calcTipSpeedMach(
        prop.diameterInch as number,
        motor.kv as number,
        battery.cellCount as number,
        (battery.chemistry as BatteryChemistry) || "LiPo"
      );
    }

    // ESC Margin (rebranded to ESC Current Headroom)
    if (motor && esc) {
      escCurrentHeadroom = calcEscCurrentHeadroom(
        esc.continuousCurrentAmps as number,
        motor.maxCurrentDraw as number,
        motorCount
      );
    }

    // Thrust / TWR / Flight Times
    if (motor && prop && battery) {
      // Check if empirical thrust test exists
      let empiricalTest: any = null;
      if (motorComp?.part?.id && propComp?.part?.id) {
        const results = await db
          .select()
          .from(thrustTestData)
          .where(
            and(
              eq(thrustTestData.motorId, motorComp.part.id),
              eq(thrustTestData.propellerId, propComp.part.id),
              eq(thrustTestData.batteryCellCount, battery.cellCount as number),
              eq(thrustTestData.batteryChemistry, (battery.chemistry as BatteryChemistry) || "LiPo")
            )
          )
          .limit(1);
        if (results.length > 0) {
          empiricalTest = results[0];
          isEstimated = false;
          thrustCurvePoints = empiricalTest.testPoints;
        }
      }

      // Max Thrust for TWR
      let maxThrust = 0;
      if (empiricalTest) {
        maxThrust = calcThrustEmpiricalGrams(empiricalTest.testPoints, motorCount);
      } else {
        maxThrust = calcThrustApproxGrams(
          prop.diameterInch as number,
          prop.pitchInch as number,
          motor.kv as number,
          battery.cellCount as number,
          (battery.chemistry as BatteryChemistry) || "LiPo",
          motorCount,
          100,
          prop.blades as number || 3
        );
      }
      twr = calcTWR(maxThrust, auw);

      // Hover Throttle
      hoverThrottle = calcHoverThrottle(
        auw,
        motorCount,
        empiricalTest?.testPoints || null,
        prop.diameterInch as number,
        prop.pitchInch as number,
        motor.kv as number,
        battery.cellCount as number,
        (battery.chemistry as BatteryChemistry) || "LiPo",
        prop.blades as number || 3
      );

      // Flight time current draws
      const hoverCurrent = calcTotalCurrentAmps(
        hoverThrottle,
        motorCount,
        empiricalTest?.testPoints || null,
        prop.diameterInch as number,
        prop.pitchInch as number,
        motor.kv as number,
        battery.cellCount as number,
        (battery.chemistry as BatteryChemistry) || "LiPo",
        prop.blades as number || 3
      );

      const freestyleCurrent = calcTotalCurrentAmps(
        35, // 35% average
        motorCount,
        empiricalTest?.testPoints || null,
        prop.diameterInch as number,
        prop.pitchInch as number,
        motor.kv as number,
        battery.cellCount as number,
        (battery.chemistry as BatteryChemistry) || "LiPo",
        prop.blades as number || 3
      );

      const racingCurrent = calcTotalCurrentAmps(
        65, // 65% average
        motorCount,
        empiricalTest?.testPoints || null,
        prop.diameterInch as number,
        prop.pitchInch as number,
        motor.kv as number,
        battery.cellCount as number,
        (battery.chemistry as BatteryChemistry) || "LiPo",
        prop.blades as number || 3
      );

      flightTimes = {
        hover: calcFlightTime(battery.capacityMah as number, hoverCurrent),
        freestyle: calcFlightTime(battery.capacityMah as number, freestyleCurrent),
        racing: calcFlightTime(battery.capacityMah as number, racingCurrent),
      };
    }

    // Top Speed, Control Feel, Min/Max RPM, Battery Recommendation
    const batteryWeight = batteryComp
      ? ((batteryComp.part?.weightGrams ?? batteryComp.customPart?.weightGrams ?? 0) * (batteryComp.quantity ?? 1))
      : 0;
    const dryWeight = Math.max(0, auw - batteryWeight);

    let topSpeedKmh = 0;
    if (prop && motor && battery) {
      topSpeedKmh = calcTopSpeed(
        prop.pitchInch as number,
        motor.kv as number,
        battery.cellCount as number,
        (battery.chemistry as BatteryChemistry) || "LiPo",
        twr
      );
    }

    const frame = getCompAttributes("FRAME");
    const wheelbaseMm = frame?.wheelbaseMm || 0;
    const propBlades = prop?.blades || 3;
    const control = calcControlFeel(twr, wheelbaseMm, propBlades);

    let minMaxRpm = { min: 0, max: 0 };
    if (motor && battery) {
      minMaxRpm = calcMinMaxRpm(
        thrustCurvePoints.length > 0 ? thrustCurvePoints : null,
        motor.kv as number,
        battery.cellCount as number,
        (battery.chemistry as BatteryChemistry) || "LiPo"
      );
    }

    // Run warnings validations
    const warnings = runAllValidations(expandedComponents, auw, twr);

    return ok({
      auw,
      dryWeight,
      batteryWeight,
      twr,
      tipSpeedMach,
      escCurrentHeadroom,
      topSpeedKmh,
      control,
      minMaxRpm,
      hoverThrottle,
      flightTimes,
      isEstimated,
      warnings,
      thrustCurve: thrustCurvePoints,
    });
  } catch (errVal: any) {
    console.error(" Stateless calculations error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred during metrics calculation.", 500);
  }
}
