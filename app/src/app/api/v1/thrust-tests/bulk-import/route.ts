import { NextResponse } from "next/server";
import { db } from "@/db";
import { thrustTestData, type BatteryChemistry, type ThrustTestPoint } from "@/db/schema";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { ok, err } from "@/lib/api-response";
import { eq, and } from "drizzle-orm";

// POST /api/v1/thrust-tests/bulk-import - Bulk import thrust datasets from CSV payload
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "upload:thrust-data")) {
      return err("FORBIDDEN", "You do not have permission to bulk import thrust data.", 403);
    }

    const body = await req.json();
    const { tests: testsToImport } = body;

    if (!testsToImport || !Array.isArray(testsToImport)) {
      return err("BAD_REQUEST", "Payload must contain an array of thrust datasets to import.", 400);
    }

    const importedCount = await db.transaction(async (tx) => {
      let count = 0;
      for (const item of testsToImport) {
        const { motorId, propellerId, batteryCellCount, batteryChemistry, sourceLabel, isEmpirical, testPoints } = item;

        if (!motorId || !propellerId || !batteryCellCount || !batteryChemistry || !testPoints) {
          throw new Error("Invalid dataset: missing required fields.");
        }

        const cellCount = parseInt(batteryCellCount, 10);

        // Check if unique constraint match exists to update instead of insert
        const existing = await tx
          .select()
          .from(thrustTestData)
          .where(
            and(
              eq(thrustTestData.motorId, motorId),
              eq(thrustTestData.propellerId, propellerId),
              eq(thrustTestData.batteryCellCount, cellCount),
              eq(thrustTestData.batteryChemistry, batteryChemistry as BatteryChemistry)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await tx
            .update(thrustTestData)
            .set({
              testPoints,
              sourceLabel: sourceLabel || null,
              isEmpirical: isEmpirical !== undefined ? !!isEmpirical : true,
              isArchived: false, // restore if archived upon re-import
            })
            .where(eq(thrustTestData.id, existing[0].id));
        } else {
          await tx
            .insert(thrustTestData)
            .values({
              motorId,
              propellerId,
              batteryCellCount: cellCount,
              batteryChemistry: batteryChemistry as BatteryChemistry,
              testPoints,
              sourceLabel: sourceLabel || null,
              isEmpirical: isEmpirical !== undefined ? !!isEmpirical : true,
              isArchived: false,
            });
        }
        count++;
      }
      return count;
    });

    return ok({ message: `Successfully imported ${importedCount} thrust test datasets.`, count: importedCount });
  } catch (errVal: any) {
    console.error("Bulk import thrust tests error: ", errVal);
    return err("SERVER_ERROR", errVal.message || "An unexpected error occurred during bulk import.", 500);
  }
}
