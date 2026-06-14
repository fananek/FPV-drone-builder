import { NextResponse } from "next/server";
import { db } from "@/db";
import { customParts, users, type MainCategory, type SubCategory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { ok, err } from "@/lib/api-response";

// POST /api/v1/custom-parts - Create a user-defined custom part
export async function POST(req: Request) {
  try {
    const session = await auth();
    const cookieStore = await cookies();
    const anonSessionId = cookieStore.get("fpv-anon-session-id")?.value;

    let targetUserId = "";

    if (session?.user?.id) {
      targetUserId = session.user.id;
    } else if (anonSessionId) {
      targetUserId = anonSessionId;

      // Lazy-provision a placeholder anonymous user in the database to satisfy
      // the foreign key constraint on custom_parts.userId
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, anonSessionId))
        .limit(1);

      if (!existingUser) {
        console.log(`Lazy-provisioning anonymous user row for session: ${anonSessionId}`);
        await db.insert(users).values({
          id: anonSessionId,
          email: `${anonSessionId}@anonymous.local`,
          roles: ["anonymous"],
        });
      }
    } else {
      return err("BAD_REQUEST", "No user identity or anonymous session ID available.", 400);
    }

    const body = await req.json();
    const { name, manufacturer, model, weightGrams, mainCategory, subCategory, keySpecs, isComposite } = body;

    if (!name || weightGrams === undefined || !mainCategory || !subCategory) {
      return err("BAD_REQUEST", "Missing required fields (name, weightGrams, mainCategory, subCategory).", 400);
    }

    const [newCustomPart] = await db
      .insert(customParts)
      .values({
        userId: targetUserId,
        name,
        manufacturer: manufacturer || "Unknown",
        model: model || "Custom",
        weightGrams: parseFloat(weightGrams),
        mainCategory: mainCategory as MainCategory,
        subCategory: subCategory as SubCategory,
        keySpecs: keySpecs || {},
        isComposite: !!isComposite,
      })
      .returning();

    return ok(newCustomPart, 201);
  } catch (errVal: any) {
    console.error("POST custom part error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred during custom part creation.", 500);
  }
}
