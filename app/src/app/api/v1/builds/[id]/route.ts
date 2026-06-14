import { NextResponse } from "next/server";
import { db } from "@/db";
import { builds, buildComponents, buildWarnings, parts, customParts, thrustTestData, type BatteryChemistry, users } from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { ok, err } from "@/lib/api-response";
import { runAllValidations, calcAUW, calcTWR, calcThrustEmpiricalGrams, calcThrustApproxGrams } from "@/lib/engineering";
import { hasPermission } from "@/lib/rbac";

// Helper to check ownership of a build
async function verifyBuildOwnership(build: typeof builds.$inferSelect) {
  const session = await auth();
  const cookieStore = await cookies();
  const anonSessionId = cookieStore.get("fpv-anon-session-id")?.value;

  if (session?.user?.id && build.userId === session.user.id) {
    return true;
  }
  if (!session?.user?.id && anonSessionId && build.anonymousSessionId === anonSessionId) {
    return true;
  }
  return false;
}

// GET /api/v1/builds/[id] - Fetch single build details with expanded components and warnings
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Fetch build
    const [build] = await db
      .select()
      .from(builds)
      .where(and(eq(builds.id, id), isNull(builds.deletedAt)))
      .limit(1);

    if (!build) {
      return err("NOT_FOUND", "The requested build was not found.", 404);
    }

    // Verify ownership or public access or admin/moderator bypass
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isOwner = await verifyBuildOwnership(build);
    const hasManageAll = hasPermission(userRoles, "manage:all-builds");
    if (!build.isPublic && !isOwner && !hasManageAll) {
      return err("FORBIDDEN", "You do not have permission to access this build.", 403);
    }

    // Fetch components
    const comps = await db
      .select()
      .from(buildComponents)
      .where(eq(buildComponents.buildId, id));

    // Resolve parts and custom parts
    const partIds = comps.map((c) => c.partId).filter(Boolean) as string[];
    const customPartIds = comps.map((c) => c.customPartId).filter(Boolean) as string[];

    const resolvedParts = partIds.length > 0
      ? await db.select().from(parts).where(inArray(parts.id, partIds))
      : [];

    const resolvedCustomParts = customPartIds.length > 0
      ? await db.select().from(customParts).where(inArray(customParts.id, customPartIds))
      : [];

    const partsMap = new Map(resolvedParts.map((p) => [p.id, p]));
    const customPartsMap = new Map(resolvedCustomParts.map((cp) => [cp.id, cp]));

    const expandedComponents = comps.map((c) => ({
      id: c.id,
      slot: c.slot,
      quantity: c.quantity,
      customNotes: c.customNotes,
      part: c.partId ? partsMap.get(c.partId) || null : null,
      customPart: c.customPartId ? customPartsMap.get(c.customPartId) || null : null,
    }));

    // Fetch warnings snapshot
    const warnings = await db
      .select()
      .from(buildWarnings)
      .where(eq(buildWarnings.buildId, id));

    return ok({
      build,
      components: expandedComponents,
      warnings,
      isOwner,
    });
  } catch (errVal: any) {
    console.error("GET build detail error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// PATCH /api/v1/builds/[id] - Update build components and metadata with optimistic locking
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, isPublic, tags, customPayloadWeightGrams, version, components, imageUrl } = body;

    if (version === undefined) {
      return err("BAD_REQUEST", "Version is required for optimistic locking.", 400);
    }

    // Fetch current build state
    const [currentBuild] = await db
      .select()
      .from(builds)
      .where(and(eq(builds.id, id), isNull(builds.deletedAt)))
      .limit(1);

    if (!currentBuild) {
      return err("NOT_FOUND", "The requested build was not found.", 404);
    }

    // Verify ownership or admin/moderator bypass
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isOwner = await verifyBuildOwnership(currentBuild);
    const hasManageAll = hasPermission(userRoles, "manage:all-builds");
    if (!isOwner && !hasManageAll) {
      return err("FORBIDDEN", "You do not have permission to update this build.", 403);
    }

    if (session?.user?.id && !hasManageAll) {
      const [dbUser] = await db
        .select({
          passwordHash: users.passwordHash,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      if (dbUser && dbUser.passwordHash && !dbUser.emailVerified) {
        return err(
          "EMAIL_NOT_VERIFIED",
          "Your email address is unverified. Please verify your email to update builds and use the app.",
          403
        );
      }
    }

    // Optimistic locking check
    if (currentBuild.version !== parseInt(version, 10)) {
      // Return 409 Conflict with latest state so client can resolve
      return NextResponse.json(
        {
          error: {
            code: "VERSION_CONFLICT",
            message: "This build has been modified by another session. Please reload and retry.",
          },
          latestBuild: currentBuild,
        },
        { status: 409 }
      );
    }

    // Prepare update parameters
    const updateData: Record<string, any> = {
      version: currentBuild.version + 1,
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = !!isPublic;
    if (tags !== undefined) updateData.tags = tags;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (customPayloadWeightGrams !== undefined) {
      updateData.customPayloadWeightGrams = parseFloat(customPayloadWeightGrams);
    }

    // Run updates in transaction
    const result = db.transaction((tx) => {
      // 1. Update builds metadata
      const [updatedBuild] = tx
        .update(builds)
        .set(updateData)
        .where(eq(builds.id, id))
        .returning()
        .all();

      // 2. Update components if provided
      if (components !== undefined && Array.isArray(components)) {
        // Clear previous components
        tx.delete(buildComponents).where(eq(buildComponents.buildId, id)).run();

        // Insert new components
        if (components.length > 0) {
          const compsToInsert = components.map((c: any) => ({
            buildId: id,
            slot: c.slot,
            quantity: c.quantity || 1,
            partId: c.partId || null,
            customPartId: c.customPartId || null,
            customNotes: c.customNotes || null,
          }));
          tx.insert(buildComponents).values(compsToInsert).run();
        }
      }

      // 3. Re-calculate warnings snapshot
      // Load current components from transaction to run calculations
      const comps = tx
        .select()
        .from(buildComponents)
        .where(eq(buildComponents.buildId, id))
        .all();

      const partIds = comps.map((c) => c.partId).filter(Boolean) as string[];
      const customPartIds = comps.map((c) => c.customPartId).filter(Boolean) as string[];

      const resolvedParts = partIds.length > 0
        ? tx.select().from(parts).where(inArray(parts.id, partIds)).all()
        : [];

      const resolvedCustomParts = customPartIds.length > 0
        ? tx.select().from(customParts).where(inArray(customParts.id, customPartIds)).all()
        : [];

      const partsMap = new Map(resolvedParts.map((p) => [p.id, p]));
      const customPartsMap = new Map(resolvedCustomParts.map((cp) => [cp.id, cp]));

      const validationComps = comps.map((c) => ({
        slot: c.slot,
        quantity: c.quantity,
        part: c.partId ? partsMap.get(c.partId) || null : null,
        customPart: c.customPartId ? customPartsMap.get(c.customPartId) || null : null,
      }));

      // Calculate AUW & TWR
      const simpleComps = validationComps.map((bc) => ({
        weightGrams: bc.part?.weightGrams ?? bc.customPart?.weightGrams ?? 0,
        quantity: bc.quantity,
      }));
      const auw = calcAUW(simpleComps, updatedBuild.customPayloadWeightGrams);

      const propeller = validationComps.find(
        (bc) => bc.part?.subCategory === "PROPELLER" || bc.customPart?.subCategory === "PROPELLER"
      );
      const motorComp = validationComps.find(
        (bc) => bc.part?.subCategory === "MOTOR" || bc.customPart?.subCategory === "MOTOR"
      );
      const batteryComp = validationComps.find(
        (bc) => bc.part?.subCategory === "BATTERY" || bc.customPart?.subCategory === "BATTERY"
      );

      let twr = 0;
      if (motorComp && propeller && batteryComp) {
        const motorCount = validationComps
          .filter((bc) => bc.part?.subCategory === "MOTOR" || bc.customPart?.subCategory === "MOTOR")
          .reduce((sum, bc) => sum + bc.quantity, 0);

        let motorKv = 0;
        let propDiameter = 0;
        let propPitch = 0;
        let propBlades = 3;
        let batteryCells = 0;
        let batteryChem: BatteryChemistry = "LiPo";

        if (motorComp.part) motorKv = (motorComp.part.attributes as any).kv || 0;
        else if (motorComp.customPart) motorKv = parseInt((motorComp.customPart.keySpecs as any).kv || "0", 10);

        if (propeller.part) {
          propDiameter = (propeller.part.attributes as any).diameterInch || 0;
          propPitch = (propeller.part.attributes as any).pitchInch || 0;
          propBlades = (propeller.part.attributes as any).blades || 3;
        } else if (propeller.customPart) {
          propDiameter = parseFloat((propeller.customPart.keySpecs as any).diameterInch || "0");
          propPitch = parseFloat((propeller.customPart.keySpecs as any).pitchInch || "0");
          propBlades = parseInt((propeller.customPart.keySpecs as any).blades || "3", 10);
        }

        if (batteryComp.part) {
          batteryCells = (batteryComp.part.attributes as any).cellCount || 0;
          batteryChem = ((batteryComp.part.attributes as any).chemistry as BatteryChemistry) || "LiPo";
        } else if (batteryComp.customPart) {
          batteryCells = parseInt((batteryComp.customPart.keySpecs as any).cellCount || "0", 10);
          batteryChem = ((batteryComp.customPart.keySpecs as any).chemistry as BatteryChemistry) || "LiPo";
        }

        // Look for empirical thrust
        const thrustTests = tx.select().from(thrustTestData).where(eq(thrustTestData.isArchived, false)).all();
        const empiricalTest = thrustTests.find(
          (t) =>
            t.motorId === motorComp.part?.id &&
            t.propellerId === propeller.part?.id &&
            t.batteryCellCount === batteryCells &&
            t.batteryChemistry === batteryChem
        );

        let maxThrust = 0;
        if (empiricalTest) {
          maxThrust = calcThrustEmpiricalGrams(empiricalTest.testPoints, motorCount);
        } else {
          maxThrust = calcThrustApproxGrams(
            propDiameter,
            propPitch,
            motorKv,
            batteryCells,
            batteryChem,
            motorCount,
            100,
            propBlades
          );
        }
        twr = calcTWR(maxThrust, auw);
      }

      // Generate warnings
      const calculatedWarnings = runAllValidations(validationComps, auw, twr);

      // Clear old warnings
      tx.delete(buildWarnings).where(eq(buildWarnings.buildId, id)).run();

      // Insert new warnings
      if (calculatedWarnings.length > 0) {
        const warningsToInsert = calculatedWarnings.map((w) => ({
          buildId: id,
          warningCode: w.warningCode,
          severity: w.severity,
          message: w.message,
          suggestedFix: w.suggestedFix || null,
        }));
        tx.insert(buildWarnings).values(warningsToInsert).run();
      }

      return {
        build: updatedBuild,
        components: validationComps,
        warnings: calculatedWarnings,
      };
    });

    return ok(result);
  } catch (errVal: any) {
    console.error("PATCH build error: ", errVal);
    if (errVal.message?.includes("UNIQUE constraint failed")) {
      return err("DUPLICATE_BUILD_NAME", "You already have a build with this name.", 400);
    }
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// DELETE /api/v1/builds/[id] - Delete a build (Owner or Moderator/Admin)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    // Fetch build
    const [build] = await db
      .select()
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);

    if (!build) {
      return err("NOT_FOUND", "The requested build was not found.", 404);
    }

    const isOwner = await verifyBuildOwnership(build);
    const hasManageAll = hasPermission(userRoles, "manage:all-builds");

    if (!isOwner && !hasManageAll) {
      return err("FORBIDDEN", "You do not have permission to delete this build.", 403);
    }

    const { searchParams } = new URL(req.url);
    const hardDelete = searchParams.get("hard") === "true";

    if (hardDelete && !hasManageAll) {
      return err("FORBIDDEN", "Only administrators can perform hard deletions.", 403);
    }

    if (hardDelete || (build.deletedAt && hasManageAll)) {
      // Hard delete build (cascades to buildComponents, buildWarnings, buildRatings)
      await db.delete(builds).where(eq(builds.id, id));
      return ok({ message: "Build permanently deleted from database." });
    }

    // Perform soft delete (set deletedAt to current timestamp)
    await db
      .update(builds)
      .set({ deletedAt: new Date() })
      .where(eq(builds.id, id));

    return ok({ message: "Build soft-deleted successfully." });
  } catch (errVal: any) {
    console.error("DELETE build error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
