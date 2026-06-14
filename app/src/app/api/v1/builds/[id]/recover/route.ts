import { NextResponse } from "next/server";
import { db } from "@/db";
import { builds, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { ok, err } from "@/lib/api-response";
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

// POST /api/v1/builds/[id]/recover - Recover a soft-deleted build
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Fetch build (including soft-deleted ones)
    const [build] = await db
      .select()
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);

    if (!build) {
      return err("NOT_FOUND", "The requested build was not found.", 404);
    }

    // Check if it's actually soft-deleted
    if (!build.deletedAt) {
      return err("BAD_REQUEST", "This build is not deleted.", 400);
    }

    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isOwner = await verifyBuildOwnership(build);
    const hasManageAll = hasPermission(userRoles, "manage:all-builds");

    if (hasManageAll) {
      if (build.userId) {
        const [ownerExists] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, build.userId))
          .limit(1);
        if (!ownerExists) {
          return err("BAD_REQUEST", "Cannot recover build because the owner user account has been deleted.", 400);
        }
      }
    } else if (!isOwner) {
      return err("FORBIDDEN", "You do not have permission to recover this build.", 403);
    }

    // Recover the build
    const [recoveredBuild] = await db
      .update(builds)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(builds.id, id))
      .returning();

    return ok({ message: "Build recovered successfully.", build: recoveredBuild });
  } catch (errVal: any) {
    console.error("POST recover build error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
