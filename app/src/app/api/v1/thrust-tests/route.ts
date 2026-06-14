import { NextResponse } from "next/server";
import { db } from "@/db";
import { thrustTestData, type BatteryChemistry } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { ok, err } from "@/lib/api-response";

// GET /api/v1/thrust-tests - Query thrust test data points
export async function GET(req: Request) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isAdmin = userRoles.includes("system_admin") || userRoles.includes("metadata_admin");

    const { searchParams } = new URL(req.url);
    const motorId = searchParams.get("motorId");
    const propellerId = searchParams.get("propellerId");
    const cellCountStr = searchParams.get("cellCount");
    const includeArchived = searchParams.get("includeArchived") === "true";

    const conditions = [];
    if (!includeArchived) {
      conditions.push(eq(thrustTestData.isArchived, false));
    }

    if (motorId) conditions.push(eq(thrustTestData.motorId, motorId));
    if (propellerId) conditions.push(eq(thrustTestData.propellerId, propellerId));
    if (cellCountStr) {
      const cellCount = parseInt(cellCountStr, 10);
      if (!isNaN(cellCount)) {
        conditions.push(eq(thrustTestData.batteryCellCount, cellCount));
      }
    }

    // Regular users must provide filtering parameters to prevent massive scans
    if (!isAdmin && conditions.filter(c => c !== eq(thrustTestData.isArchived, false)).length === 0) {
      return err("BAD_REQUEST", "Please filter by motorId, propellerId, or cellCount.", 400);
    }

    const data = await db
      .select()
      .from(thrustTestData)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return ok(data);
  } catch (errVal: any) {
    console.error("GET thrust tests error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// POST /api/v1/thrust-tests - Upload a new thrust test dataset (Admin or API Client)
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "upload:thrust-data")) {
      return err("FORBIDDEN", "You do not have permission to upload thrust test data.", 403);
    }

    const body = await req.json();
    const { motorId, propellerId, batteryCellCount, batteryChemistry, testPoints, sourceLabel, isEmpirical } = body;

    if (!motorId || !propellerId || !batteryCellCount || !batteryChemistry || !testPoints) {
      return err("BAD_REQUEST", "Missing required fields.", 400);
    }

    // Upsert or insert: we check if there's a unique match
    // SQLite can do an ON CONFLICT write, but we can do a delete-then-insert or find-then-update
    // for simplicity and cleanliness across different DB dialects
    const existing = await db
      .select()
      .from(thrustTestData)
      .where(
        and(
          eq(thrustTestData.motorId, motorId),
          eq(thrustTestData.propellerId, propellerId),
          eq(thrustTestData.batteryCellCount, parseInt(batteryCellCount, 10)),
          eq(thrustTestData.batteryChemistry, batteryChemistry as BatteryChemistry)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update
      const [updated] = await db
        .update(thrustTestData)
        .set({
          testPoints,
          sourceLabel: sourceLabel || null,
          isEmpirical: isEmpirical !== undefined ? !!isEmpirical : true,
        })
        .where(eq(thrustTestData.id, existing[0].id))
        .returning();
      return ok({ message: "Thrust test data updated.", data: updated });
    }

    // Insert
    const [inserted] = await db
      .insert(thrustTestData)
      .values({
        motorId,
        propellerId,
        batteryCellCount: parseInt(batteryCellCount, 10),
        batteryChemistry: batteryChemistry as BatteryChemistry,
        testPoints,
        sourceLabel: sourceLabel || null,
        isEmpirical: isEmpirical !== undefined ? !!isEmpirical : true,
      })
      .returning();

    return ok({ message: "Thrust test data uploaded.", data: inserted }, 201);
  } catch (errVal: any) {
    console.error("POST thrust tests error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
