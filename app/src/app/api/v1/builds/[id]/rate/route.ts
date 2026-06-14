import { NextResponse } from "next/server";
import { db } from "@/db";
import { builds, buildRatings } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { ok, err } from "@/lib/api-response";

// POST /api/v1/builds/[id]/rate - Rate and review a public build
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return err("UNAUTHORIZED", "You must be registered and logged in to rate builds.", 401);
    }

    const userId = session.user.id;
    const body = await req.json();
    const { stars, review } = body;

    const ratingStars = parseInt(stars, 10);
    if (isNaN(ratingStars) || ratingStars < 1 || ratingStars > 5) {
      return err("BAD_REQUEST", "Rating must be an integer between 1 and 5.", 400);
    }

    if (review && review.length > 500) {
      return err("BAD_REQUEST", "Review text must be 500 characters or less.", 400);
    }

    // 1. Verify build exists and is public
    const [build] = await db
      .select()
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);

    if (!build) {
      return err("NOT_FOUND", "The build you are trying to rate was not found.", 404);
    }

    if (!build.isPublic) {
      return err("FORBIDDEN", "You cannot rate a private build.", 403);
    }

    // 2. Perform upsert and update build metrics in a transaction
    const result = await db.transaction(async (tx) => {
      // Check if rating already exists
      const [existingRating] = await tx
        .select()
        .from(buildRatings)
        .where(
          and(
            eq(buildRatings.buildId, id),
            eq(buildRatings.userId, userId)
          )
        )
        .limit(1);

      if (existingRating) {
        // Update
        await tx
          .update(buildRatings)
          .set({
            stars: ratingStars,
            review: review || null,
            updatedAt: new Date(),
          })
          .where(eq(buildRatings.id, existingRating.id));
      } else {
        // Insert
        await tx.insert(buildRatings).values({
          buildId: id,
          userId,
          stars: ratingStars,
          review: review || null,
        });
      }

      // Calculate denormalized metrics
      const [aggResult] = await tx
        .select({
          count: sql<number>`count(*)`,
          avg: sql<number>`avg(stars)`,
        })
        .from(buildRatings)
        .where(eq(buildRatings.buildId, id));

      const ratingCount = aggResult?.count || 0;
      const averageRating = aggResult?.avg ? parseFloat(aggResult.avg.toFixed(2)) : null;

      // Update builds record
      const [updatedBuild] = await tx
        .update(builds)
        .set({
          averageRating,
          ratingCount,
        })
        .where(eq(builds.id, id))
        .returning();

      return {
        averageRating: updatedBuild.averageRating,
        ratingCount: updatedBuild.ratingCount,
      };
    });

    return ok({ message: "Rating submitted successfully.", metrics: result });
  } catch (errVal: any) {
    console.error("Rate build error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
