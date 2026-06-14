import { NextResponse } from "next/server";
import { db } from "@/db";
import { builds, users } from "@/db/schema";
import { eq, or, desc, isNull, isNotNull, lt, and, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { ok, err } from "@/lib/api-response";

// GET /api/v1/builds - Fetch user's builds (curated by user session or anonymous session cookie)
export async function GET(req: Request) {
  try {
    const session = await auth();
    const cookieStore = await cookies();
    const anonSessionId = cookieStore.get("fpv-anon-session-id")?.value;

    const { searchParams } = new URL(req.url);
    const fetchAll = searchParams.get("all") === "true";
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // Enforce dynamic cleanup of anonymous builds older than 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
      await db
        .delete(builds)
        .where(
          and(
            isNull(builds.userId),
            isNotNull(builds.anonymousSessionId),
            lt(builds.createdAt, cutoff)
          )
        );
    } catch (cleanupErr) {
      console.error("Expired anonymous builds cleanup error: ", cleanupErr);
    }

    // Enforce dynamic cleanup of soft-deleted builds older than 30 days
    try {
      await db
        .delete(builds)
        .where(
          and(
            isNotNull(builds.deletedAt),
            lt(builds.deletedAt, cutoff)
          )
        );
    } catch (cleanupErr) {
      console.error("Expired soft-deleted builds cleanup error: ", cleanupErr);
    }

    // Admin option to fetch all builds
    if (fetchAll) {
      const userRoles = session?.user?.roles || [];
      if (!userRoles.includes("system_admin")) {
        return err("FORBIDDEN", "You do not have administrative clearance to access all builds.", 403);
      }
      const data = await db
        .select({
          id: builds.id,
          userId: builds.userId,
          anonymousSessionId: builds.anonymousSessionId,
          name: builds.name,
          description: builds.description,
          isPublic: builds.isPublic,
          tags: builds.tags,
          customPayloadWeightGrams: builds.customPayloadWeightGrams,
          clonedFromBuildId: builds.clonedFromBuildId,
          averageRating: builds.averageRating,
          ratingCount: builds.ratingCount,
          version: builds.version,
          createdAt: builds.createdAt,
          updatedAt: builds.updatedAt,
          deletedAt: builds.deletedAt,
          userName: users.name,
          userEmail: users.email,
          imageUrl: builds.imageUrl,
        })
        .from(builds)
        .leftJoin(users, eq(builds.userId, users.id))
        .where(includeDeleted ? undefined : isNull(builds.deletedAt))
        .orderBy(desc(builds.updatedAt));
      return ok(data);
    }

    const conditions = [];

    if (session?.user?.id) {
      // Authenticated user: fetch their registered builds
      conditions.push(eq(builds.userId, session.user.id));
      // Optionally also fetch any un-migrated anonymous builds matching the cookie
      if (anonSessionId) {
        conditions.push(eq(builds.anonymousSessionId, anonSessionId));
      }
    } else if (anonSessionId) {
      // Anonymous user: fetch builds matching their anonymous cookie
      conditions.push(eq(builds.anonymousSessionId, anonSessionId));
    } else {
      // No identity at all
      return ok([]);
    }

    const whereClause = conditions.length > 1 ? or(...conditions) : conditions[0];

    const data = await db
      .select()
      .from(builds)
      .where(includeDeleted ? whereClause : and(whereClause, isNull(builds.deletedAt)))
      .orderBy(desc(builds.updatedAt));

    return ok(data);
  } catch (errVal: any) {
    console.error("GET builds error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// POST /api/v1/builds - Create a new build
export async function POST(req: Request) {
  try {
    const session = await auth();
    const cookieStore = await cookies();
    const anonSessionId = cookieStore.get("fpv-anon-session-id")?.value;

    const body = await req.json();
    const { name, description, isPublic, tags, customPayloadWeightGrams, imageUrl } = body;

    const buildName = name || `New Build ${new Date().toLocaleDateString()}`;

    // Verify anonymous user count limit of 3 builds
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

    // Prepare insert values
    const insertValues: Record<string, any> = {
      name: buildName,
      description: description || null,
      isPublic: !!isPublic,
      tags: tags || [],
      customPayloadWeightGrams: parseFloat(customPayloadWeightGrams || "0"),
      version: 1,
      imageUrl: imageUrl || null,
    };

    if (session?.user?.id) {
      insertValues.userId = session.user.id;
    } else if (anonSessionId) {
      insertValues.anonymousSessionId = anonSessionId;
    } else {
      // If no session cookie exists (e.g. API access), generate a new anonymous UUID
      const newAnonId = crypto.randomUUID();
      insertValues.anonymousSessionId = newAnonId;
    }

    const [newBuild] = await db
      .insert(builds)
      .values(insertValues as any)
      .returning();

    const response = ok(newBuild, 201);

    // If we had to generate a new anonymous session ID, set the cookie on the response
    if (!session?.user?.id && !anonSessionId) {
      response.cookies.set("fpv-anon-session-id", insertValues.anonymousSessionId, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
    }

    return response;
  } catch (errVal: any) {
    console.error("POST build error: ", errVal);
    
    // Check for unique constraint violation on (userId, name)
    if (errVal.message?.includes("UNIQUE constraint failed")) {
      return err("DUPLICATE_BUILD_NAME", "You already have a build with this name.", 400);
    }
    
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
