import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, buildRatings, builds } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { ok, err } from "@/lib/api-response";

// PATCH /api/v1/admin/users/[id] - Update user roles, subscription status, or email verification status (restricted to system_admin)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!userRoles.includes("system_admin")) {
      return err("FORBIDDEN", "Only system_admin is permitted to manage users.", 403);
    }

    const body = await req.json();
    const { roles, subscriptionStatus, emailVerified } = body;

    const updateValues: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (roles !== undefined) {
      if (!Array.isArray(roles)) {
        return err("BAD_REQUEST", "Roles must be an array.", 400);
      }
      updateValues.roles = roles;
    }

    if (subscriptionStatus !== undefined) {
      updateValues.subscriptionStatus = subscriptionStatus;
    }

    if (emailVerified !== undefined) {
      if (emailVerified === true) {
        updateValues.emailVerified = new Date();
      } else if (emailVerified === false || emailVerified === null) {
        updateValues.emailVerified = null;
      } else {
        updateValues.emailVerified = new Date(emailVerified);
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        roles: users.roles,
        subscriptionStatus: users.subscriptionStatus,
        updatedAt: users.updatedAt,
      });

    if (!updatedUser) {
      return err("NOT_FOUND", "Pilot user not found.", 404);
    }

    return ok({ message: "Pilot profile updated successfully.", user: updatedUser });
  } catch (errVal: any) {
    console.error("PATCH admin user error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// DELETE /api/v1/admin/users/[id] - Delete a user account and recalculate ratings metrics (restricted to system_admin)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!userRoles.includes("system_admin")) {
      return err("FORBIDDEN", "Only system_admin is permitted to delete users.", 403);
    }

    // Prevent system admin from deleting themselves
    if (session?.user?.id === id) {
      return err("BAD_REQUEST", "You cannot self-terminate your connection from this panel.", 400);
    }

    console.log(`Admin deleting user account: ${id}`);

    // 1. Find all builds this user has rated
    const ratingsToRecalc = await db
      .select({ buildId: buildRatings.buildId })
      .from(buildRatings)
      .where(eq(buildRatings.userId, id));

    const ratedBuildIds = ratingsToRecalc.map((r) => r.buildId);

    // 2. Delete the user
    // Cascading foreign keys will clean up profiles, builds, components, customParts, warnings, sessions, accounts
    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, email: users.email });

    if (!deletedUser) {
      return err("NOT_FOUND", "Pilot user not found.", 404);
    }

    // 3. Recalculate ratings metrics for affected builds that still exist
    if (ratedBuildIds.length > 0) {
      for (const bId of ratedBuildIds) {
        const [build] = await db
          .select()
          .from(builds)
          .where(eq(builds.id, bId))
          .limit(1);

        if (build) {
          const [aggResult] = await db
            .select({
              count: sql<number>`count(*)`,
              avg: sql<number>`avg(stars)`,
            })
            .from(buildRatings)
            .where(eq(buildRatings.buildId, bId));

          const ratingCount = aggResult?.count || 0;
          const averageRating = aggResult?.avg ? parseFloat(aggResult.avg.toFixed(2)) : null;

          await db
            .update(builds)
            .set({
              averageRating,
              ratingCount,
            })
            .where(eq(builds.id, bId));
        }
      }
    }

    return ok({ message: "Pilot account successfully decommissioned.", user: deletedUser });
  } catch (errVal: any) {
    console.error("DELETE admin user error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
