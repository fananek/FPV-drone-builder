import { type BatteryChemistry } from "@/db/schema";

export function getVoltagePerCell(chemistry: BatteryChemistry): {
  max: number;
  min: number;
  nominal: number;
} {
  switch (chemistry) {
    case "LiHv":
      return { max: 4.35, min: 3.5, nominal: 3.7 };
    case "LiIon":
      return { max: 4.2, min: 3.2, nominal: 3.6 };
    case "LiPo":
    default:
      return { max: 4.2, min: 3.5, nominal: 3.7 };
  }
}

export function getBatteryVoltage(
  cellCount: number,
  chemistry: BatteryChemistry,
  state: "max" | "min" | "nominal"
): number {
  const cell = getVoltagePerCell(chemistry);
  return cellCount * cell[state];
}
