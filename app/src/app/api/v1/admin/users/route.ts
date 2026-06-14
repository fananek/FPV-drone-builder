import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { ok, err } from "@/lib/api-response";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!userRoles.includes("system_admin")) {
      return err("FORBIDDEN", "Only system_admin is permitted to access user management.", 403);
    }

    const data = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
        roles: users.roles,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return ok(data);
  } catch (errVal: any) {
    console.error("GET admin users error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
