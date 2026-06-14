import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, buildRatings, builds } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in to view your profile." } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Pilot user not found." } },
        { status: 404 }
      );
    }

    const needsVerification = user.passwordHash !== null && user.emailVerified === null;

    return NextResponse.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: user.roles,
        subscriptionStatus: user.subscriptionStatus,
        needsVerification,
      }
    });
  } catch (err: any) {
    console.error("GET profile stats error: ", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in." } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();
    const { verify } = body;

    const updateValues: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (verify === true) {
      updateValues.emailVerified = new Date();
    } else if (verify === false) {
      updateValues.emailVerified = null;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Pilot user not found." } },
        { status: 404 }
      );
    }

    const needsVerification = updatedUser.passwordHash !== null && updatedUser.emailVerified === null;

    return NextResponse.json({
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
        roles: updatedUser.roles,
        subscriptionStatus: updatedUser.subscriptionStatus,
        needsVerification,
      }
    });
  } catch (err: any) {
    console.error("PATCH profile stats error: ", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in to delete your account." } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`Deleting user account: ${userId}`);

    // 1. Find all builds this user has rated
    const ratingsToRecalc = await db
      .select({ buildId: buildRatings.buildId })
      .from(buildRatings)
      .where(eq(buildRatings.userId, userId));

    const ratedBuildIds = ratingsToRecalc.map((r) => r.buildId);

    // 2. Delete the user. Cascading foreign keys will clean up:
    // accounts, sessions, builds, buildComponents, ratings, customParts, warnings
    await db.delete(users).where(eq(users.id, userId));

    // 3. Recalculate ratings metrics for affected builds that still exist
    if (ratedBuildIds.length > 0) {
      for (const bId of ratedBuildIds) {
        // Verify build still exists (since user's own builds are deleted by cascade)
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

    return NextResponse.json(
      { data: { message: "Account successfully deleted." } },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Account deletion error: ", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "An unexpected error occurred during account deletion." } },
      { status: 500 }
    );
  }
}
