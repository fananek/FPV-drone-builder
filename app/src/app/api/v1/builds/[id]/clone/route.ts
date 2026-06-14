import { NextResponse } from "next/server";
import { db } from "@/db";
import { builds, buildComponents, buildWarnings, parts, customParts, users } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { ok, err } from "@/lib/api-response";

// POST /api/v1/builds/[id]/clone - Deep copy a public build to the requester's hangar
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const cookieStore = await cookies();
    const anonSessionId = cookieStore.get("fpv-anon-session-id")?.value;

    // 1. Fetch original build
    const [originalBuild] = await db
      .select()
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);

    if (!originalBuild) {
      return err("NOT_FOUND", "Original build not found.", 404);
    }

    // Verify anonymous user count limit of 3 builds before cloning
    if (!session?.user?.id) {
      const activeAnonId = anonSessionId;
      if (activeAnonId) {
        const [existingBuildsCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(builds)
          .where(eq(builds.anonymousSessionId, activeAnonId));
        if ((existingBuildsCount?.count || 0) >= 3) {
          return err(
            "LIMIT_EXCEEDED",
            "Anonymous users can create max 3 builds. Please register an account to create more builds.",
            400
          );
        }
      }
    } else {
      // Email verification gate: registered via email (has passwordHash) must have emailVerified
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
          "Your email address is unverified. Please verify your email to create builds and use the app.",
          403
        );
      }
    }

    // 2. Check if build is public or belongs to requester
    const isOwner =
      (session?.user?.id && originalBuild.userId === session.user.id) ||
      (!session?.user?.id && anonSessionId && originalBuild.anonymousSessionId === anonSessionId);

    if (!originalBuild.isPublic && !isOwner) {
      return err("FORBIDDEN", "You do not have permission to clone this build.", 403);
    }

    // 3. Perform cloning in a transaction
    const clonedBuild = db.transaction((tx) => {
      // Create clone build row
      const insertValues: Record<string, any> = {
        name: `Clone of ${originalBuild.name}`,
        description: originalBuild.description,
        isPublic: false,
        tags: originalBuild.tags || [],
        customPayloadWeightGrams: originalBuild.customPayloadWeightGrams,
        clonedFromBuildId: originalBuild.id,
        version: 1,
      };

      if (session?.user?.id) {
        insertValues.userId = session.user.id;
      } else if (anonSessionId) {
        insertValues.anonymousSessionId = anonSessionId;
      } else {
        const newAnonId = crypto.randomUUID();
        insertValues.anonymousSessionId = newAnonId;
      }

      const [newBuild] = tx
        .insert(builds)
        .values(insertValues as any)
        .returning()
        .all();

      // Copy components
      const originalComponents = tx
        .select()
        .from(buildComponents)
        .where(eq(buildComponents.buildId, id))
        .all();

      if (originalComponents.length > 0) {
        const partIds = originalComponents.map((c) => c.partId).filter(Boolean) as string[];
        const customPartIds = originalComponents.map((c) => c.customPartId).filter(Boolean) as string[];

        const validPartIds = partIds.length > 0
          ? new Set(tx.select({ id: parts.id }).from(parts).where(inArray(parts.id, partIds)).all().map((p) => p.id))
          : new Set<string>();

        const validCustomPartIds = customPartIds.length > 0
          ? new Set(tx.select({ id: customParts.id }).from(customParts).where(inArray(customParts.id, customPartIds)).all().map((cp) => cp.id))
          : new Set<string>();

        const clonedComps = originalComponents.map((c) => ({
          buildId: newBuild.id,
          slot: c.slot,
          quantity: c.quantity,
          partId: c.partId && validPartIds.has(c.partId) ? c.partId : null,
          customPartId: c.customPartId && validCustomPartIds.has(c.customPartId) ? c.customPartId : null,
          customNotes: c.customNotes,
        }));
        tx.insert(buildComponents).values(clonedComps).run();
      }

      // Copy warnings snapshot
      const originalWarnings = tx
        .select()
        .from(buildWarnings)
        .where(eq(buildWarnings.buildId, id))
        .all();

      if (originalWarnings.length > 0) {
        const clonedWarns = originalWarnings.map((w) => ({
          buildId: newBuild.id,
          warningCode: w.warningCode,
          severity: w.severity,
          message: w.message,
          suggestedFix: w.suggestedFix,
        }));
        tx.insert(buildWarnings).values(clonedWarns).run();
      }

      return newBuild;
    });

    const response = ok({ message: "Build cloned successfully.", build: clonedBuild }, 201);

    // If we had to generate a new anonymous session ID, set the cookie on the response
    const hasId = !!session?.user?.id;
    if (!hasId && !anonSessionId) {
      response.cookies.set("fpv-anon-session-id", clonedBuild.anonymousSessionId!, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
    }

    return response;
  } catch (errVal: any) {
    console.error("Clone build error: ", errVal);
    
    if (errVal.message?.includes("UNIQUE constraint failed")) {
      return err("DUPLICATE_BUILD_NAME", "You already have a build with this name.", 400);
    }
    
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
