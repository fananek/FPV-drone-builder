import { type BatteryChemistry, type WarningSeverity } from "@/db/schema";
import { getBatteryVoltage } from "./battery";
import { calcTipSpeedMach } from "./tipSpeed";

export type ValidationComponent = {
  slot: string;
  quantity: number;
  part?: {
    id: string;
    name: string;
    weightGrams: number;
    mainCategory: string;
    subCategory: string;
    attributes: any;
    isComposite: boolean;
  } | null;
  customPart?: {
    id: string;
    name: string;
    weightGrams: number;
    mainCategory: string;
    subCategory: string;
    keySpecs: any;
    isComposite: boolean;
  } | null;
};

export type ValidationWarning = {
  warningCode: string;
  severity: WarningSeverity;
  message: string;
  suggestedFix?: string;
};

/**
 * Extracts attributes for validation, unifying curated and custom parts formats.
 */
function getAttributes(comp: ValidationComponent | undefined): any {
  if (!comp) return null;
  if (comp.part) {
    const attrs = comp.part.attributes;
    return typeof attrs === "string" ? JSON.parse(attrs) : attrs;
  }
  if (comp.customPart) {
    const specs = comp.customPart.keySpecs || {};
    // Helper to safely parse strings into arrays
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
      inputVoltageMax: parseFloat(specs.inputVoltageMax || "0"),
      maxCurrentDraw: parseFloat(specs.maxCurrentDraw || "0"),
      cellCount: parseInt(specs.cellCount || specs.batteryCellCount || "0", 10),
      capacityMah: parseFloat(specs.capacityMah || "0"),
      cRating: parseInt(specs.cRating || "0", 10),
      chemistry: specs.chemistry || "LiPo",
      diameterInch: parseFloat(specs.diameterInch || "0"),
      pitchInch: parseFloat(specs.pitchInch || "0"),
      blades: parseInt(specs.blades || "3", 10),
      inputVoltageMin: parseFloat(specs.inputVoltageMin || "0"),
      maxPowerMw: parseInt(specs.maxPowerMw || "0"),
      protocol: specs.protocol || "",
    };
  }
  return null;
}

/**
 * Runs all validation checks W-01 through W-13 on a set of build components.
 */
export function runAllValidations(
  components: ValidationComponent[],
  auwGrams: number,
  twr: number
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 1. Resolve components
  const frameComp = components.find(c => c.part?.subCategory === "FRAME" || c.customPart?.subCategory === "FRAME");
  const fcComp = components.find(c => c.part?.subCategory === "FC" || c.part?.subCategory === "AIO" || c.customPart?.subCategory === "FC" || c.customPart?.subCategory === "AIO");
  const escComp = components.find(c => c.part?.subCategory === "ESC" || c.part?.subCategory === "AIO" || c.customPart?.subCategory === "ESC" || c.customPart?.subCategory === "AIO");
  const motorComp = components.find(c => c.part?.subCategory === "MOTOR" || c.customPart?.subCategory === "MOTOR");
  const propComp = components.find(c => c.part?.subCategory === "PROPELLER" || c.customPart?.subCategory === "PROPELLER");
  const batteryComp = components.find(c => c.part?.subCategory === "BATTERY" || c.customPart?.subCategory === "BATTERY");
  const vtxComp = components.find(c => c.part?.subCategory === "VTX" || c.customPart?.subCategory === "VTX");

  const frame = getAttributes(frameComp);
  const fc = getAttributes(fcComp);
  const esc = getAttributes(escComp);
  const motor = getAttributes(motorComp);
  const prop = getAttributes(propComp);
  const battery = getAttributes(batteryComp);
  const vtx = getAttributes(vtxComp);

  // Count motor quantity
  const motorCount = components
    .filter(c => c.part?.subCategory === "MOTOR" || c.customPart?.subCategory === "MOTOR")
    .reduce((sum, c) => sum + c.quantity, 0);

  // ─── W-01: Prop-Frame Fit ───────────────────────────────────────────────
  if (prop && frame && frame.maxPropSizeInch) {
    if (prop.diameterInch > frame.maxPropSizeInch) {
      warnings.push({
        warningCode: "W-01",
        severity: "error",
        message: `Propeller diameter (${prop.diameterInch}") exceeds the frame's maximum supported propeller size of ${frame.maxPropSizeInch}".`,
        suggestedFix: "Select smaller propellers or a larger frame.",
      });
    }
  }

  // ─── W-02: Prop-Motor Mount ─────────────────────────────────────────────
  if (prop && motor && motor.propMountingPattern && prop.mountingPattern) {
    const motorPatterns = motor.propMountingPattern;
    const propPatterns = prop.mountingPattern;
    const isCompatible = propPatterns.some((p: string) => motorPatterns.includes(p));
    
    if (!isCompatible) {
      warnings.push({
        warningCode: "W-02",
        severity: "error",
        message: `Propeller mounting patterns ([${propPatterns.join(", ")}]) do not match the motor's propeller mounting patterns ([${motorPatterns.join(", ")}]).`,
        suggestedFix: "Select a propeller that matches the motor's shaft size/mounting style.",
      });
    }
  }

  // ─── W-03: Motor-Frame Mount ────────────────────────────────────────────
  if (motor && frame && frame.motorMountingPattern && motor.mountingPattern) {
    const framePatterns = frame.motorMountingPattern;
    const motorPattern = motor.mountingPattern;
    
    if (!framePatterns.includes(motorPattern)) {
      warnings.push({
        warningCode: "W-03",
        severity: "error",
        message: `Motor mounting pattern (${motorPattern}) is not supported by the frame's motor mounting patterns ([${framePatterns.join(", ")}]).`,
        suggestedFix: "Select a motor or frame with compatible mounting patterns.",
      });
    }
  }

  // ─── W-04: FC-Frame Mount ───────────────────────────────────────────────
  if (fc && frame && frame.fcMountingPattern && fc.mountingPattern) {
    const framePatterns = frame.fcMountingPattern;
    const fcPattern = fc.mountingPattern;
    
    if (!framePatterns.includes(fcPattern)) {
      warnings.push({
        warningCode: "W-04",
        severity: "error",
        message: `Flight Controller mounting pattern (${fcPattern}) is not supported by the frame's FC mounting patterns ([${framePatterns.join(", ")}]).`,
        suggestedFix: "Select a flight controller or frame with compatible mounting patterns.",
      });
    }
  }

  // ─── W-05: ESC-Frame Mount ──────────────────────────────────────────────
  if (esc && frame && frame.fcMountingPattern && esc.mountingPattern) {
    const framePatterns = frame.fcMountingPattern;
    const escPattern = esc.mountingPattern;
    
    if (!framePatterns.includes(escPattern)) {
      warnings.push({
        warningCode: "W-05",
        severity: "error",
        message: `ESC mounting pattern (${escPattern}) is not supported by the frame's FC/ESC stack mounting patterns ([${framePatterns.join(", ")}]).`,
        suggestedFix: "Select an ESC or frame with compatible stack mounting patterns.",
      });
    }
  }

  // ─── W-06: ESC Overcurrent ──────────────────────────────────────────────
  if (motor && esc && esc.continuousCurrentAmps && motor.maxCurrentDraw) {
    if (motor.maxCurrentDraw > esc.continuousCurrentAmps) {
      warnings.push({
        warningCode: "W-06",
        severity: "warning",
        message: `Peak motor current draw (${motor.maxCurrentDraw}A) exceeds the ESC's per-channel continuous current rating (${esc.continuousCurrentAmps}A).`,
        suggestedFix: "Select an ESC with a higher current rating, or motors with a lower maximum current draw.",
      });
    }
  }

  // ─── W-07: Voltage Mismatch (ESC) ───────────────────────────────────────
  if (battery && esc && esc.inputVoltagesMax && battery.cellCount) {
    if (battery.cellCount > esc.inputVoltagesMax) {
      warnings.push({
        warningCode: "W-07",
        severity: "error",
        message: `Battery cell count (${battery.cellCount}S) exceeds the ESC's maximum input voltage of ${esc.inputVoltagesMax}S.`,
        suggestedFix: "Use a battery with a lower cell count, or select an ESC that supports higher voltage.",
      });
    }
  }

  // ─── W-08: Voltage Mismatch (FC) ────────────────────────────────────────
  if (battery && fc && fc.inputVoltagesMax && battery.cellCount) {
    if (battery.cellCount > fc.inputVoltagesMax) {
      warnings.push({
        warningCode: "W-08",
        severity: "error",
        message: `Battery cell count (${battery.cellCount}S) exceeds the Flight Controller's maximum input voltage of ${fc.inputVoltagesMax}S.`,
        suggestedFix: "Use a battery with a lower cell count, or select a flight controller that supports higher voltage.",
      });
    }
  }

  // ─── W-09: Voltage Mismatch (VTX) ───────────────────────────────────────
  const fcHasBec = fc && (fc.hasBec === true || fc.hasBec === "true" || fc.hasBec === 1);
  if (battery && vtx && battery.cellCount && !fcHasBec) {
    const batteryMin = getBatteryVoltage(battery.cellCount, battery.chemistry || "LiPo", "min");
    const batteryMax = getBatteryVoltage(battery.cellCount, battery.chemistry || "LiPo", "max");

    const vtxMin = vtx.inputVoltageMin;
    const vtxMax = vtx.inputVoltageMax;

    if (vtxMin !== undefined && vtxMax !== undefined) {
      if (batteryMin < vtxMin || batteryMax > vtxMax) {
        warnings.push({
          warningCode: "W-09",
          severity: "warning",
          message: `Battery voltage range (${batteryMin.toFixed(1)}V - ${batteryMax.toFixed(1)}V) is outside the VTX input voltage range (${vtxMin.toFixed(1)}V - ${vtxMax.toFixed(1)}V).`,
          suggestedFix: "Power the VTX from a regulated BEC output, or select a VTX/battery with compatible voltage ranges.",
        });
      }
    }
  }

  // ─── W-10 & W-11: Propeller Tip Speed ────────────────────────────────────
  if (prop && motor && battery && battery.cellCount) {
    const mach = calcTipSpeedMach(
      prop.diameterInch,
      motor.kv,
      battery.cellCount,
      battery.chemistry || "LiPo"
    );

    if (mach >= 0.9) {
      warnings.push({
        warningCode: "W-11",
        severity: "error",
        message: `Propeller tip speed (${mach.toFixed(2)} Mach / ${(mach * 343).toFixed(0)} m/s) exceeds the safe limit. This will cause critical acoustic efficiency collapse and blade flutter.`,
        suggestedFix: "Reduce motor KV, battery cell count, or propeller diameter immediately.",
      });
    } else if (mach >= 0.85) {
      warnings.push({
        warningCode: "W-10",
        severity: "warning",
        message: `Propeller tip speed (${mach.toFixed(2)} Mach / ${(mach * 343).toFixed(0)} m/s) is approaching the speed of sound. Propeller efficiency will decrease and noise level will increase.`,
        suggestedFix: "Consider using lower KV motors, a lower cell count battery, or a smaller diameter propeller.",
      });
    }
  }

  // ─── W-12: Low TWR ──────────────────────────────────────────────────────
  if (components.length > 0 && twr > 0 && twr < 1.5) {
    warnings.push({
      warningCode: "W-12",
      severity: "info",
      message: `Thrust-to-weight ratio (${twr.toFixed(2)}) is extremely low. The drone may not be able to achieve a stable hover or fly safely.`,
      suggestedFix: "Reduce the drone's weight, use larger/more efficient propellers, or higher thrust motors.",
    });
  }

  // ─── W-13: Regulatory Weight ────────────────────────────────────────────
  if (auwGrams >= 250) {
    warnings.push({
      warningCode: "W-13",
      severity: "info",
      message: `All-up weight (${auwGrams.toFixed(1)}g) is 250g or more. This requires FAA/civil aviation registration and compliance in many jurisdictions.`,
      suggestedFix: "Be sure to register your drone with your local aviation authority before flying.",
    });
  }

  return warnings;
}
