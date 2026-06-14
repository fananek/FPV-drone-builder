import { NextResponse } from "next/server";
import { db } from "@/db";
import { thrustTestData } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { ok, err } from "@/lib/api-response";

// DELETE /api/v1/thrust-tests/[id] - Delete a thrust test dataset
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "upload:thrust-data")) {
      return err("FORBIDDEN", "You do not have permission to delete thrust test data.", 403);
    }

    const [deleted] = await db
      .update(thrustTestData)
      .set({ isArchived: true })
      .where(eq(thrustTestData.id, id))
      .returning();

    if (!deleted) {
      return err("NOT_FOUND", "Thrust test dataset not found.", 404);
    }

    return ok({ message: "Thrust test data deleted successfully.", data: deleted });
  } catch (errVal: any) {
    console.error("DELETE thrust test error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// PATCH /api/v1/thrust-tests/[id] - Update a thrust test dataset (Admin or API Client)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "upload:thrust-data")) {
      return err("FORBIDDEN", "You do not have permission to update thrust test data.", 403);
    }

    const body = await req.json();
    const { batteryCellCount, batteryChemistry, testPoints, sourceLabel, isEmpirical, isArchived } = body;

    const updateValues: Record<string, any> = {};
    if (batteryCellCount !== undefined) updateValues.batteryCellCount = parseInt(batteryCellCount, 10);
    if (batteryChemistry !== undefined) updateValues.batteryChemistry = batteryChemistry;
    if (testPoints !== undefined) updateValues.testPoints = testPoints;
    if (sourceLabel !== undefined) updateValues.sourceLabel = sourceLabel;
    if (isEmpirical !== undefined) updateValues.isEmpirical = !!isEmpirical;
    if (isArchived !== undefined) updateValues.isArchived = !!isArchived;

    const [updated] = await db
      .update(thrustTestData)
      .set(updateValues)
      .where(eq(thrustTestData.id, id))
      .returning();

    if (!updated) {
      return err("NOT_FOUND", "Thrust test dataset not found.", 404);
    }

    return ok({ message: "Thrust test data updated successfully.", data: updated });
  } catch (errVal: any) {
    console.error("PATCH thrust test error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
