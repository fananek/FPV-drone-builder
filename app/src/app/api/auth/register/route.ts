import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, builds, customParts } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Email and password are required." } },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Password must be at least 6 characters long." } },
        { status: 400 }
      );
    }

    // Check if email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: { code: "EMAIL_ALREADY_IN_USE", message: "A user with this email already exists." } },
        { status: 400 }
      );
    }

    // Hash the password with bcrypt (minimum cost factor 12)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user in DB
    const [newUser] = await db
      .insert(users)
      .values({
        name: name || null,
        email: email.toLowerCase(),
        passwordHash,
        roles: ["registered_user"],
      })
      .returning();

    // Migrate anonymous builds and custom parts to this new user
    const cookieStore = await cookies();
    const anonSessionId = cookieStore.get("fpv-anon-session-id")?.value;

    if (anonSessionId) {
      console.log(`Migrating builds and custom parts from anonymous session ${anonSessionId} to user ${newUser.id}`);
      
      // Update builds
      await db
        .update(builds)
        .set({
          userId: newUser.id,
          anonymousSessionId: null, // clear anonymous session ID upon migration
        })
        .where(eq(builds.anonymousSessionId, anonSessionId));

      // Update custom parts
      await db
        .update(customParts)
        .set({
          userId: newUser.id,
        })
        .where(eq(customParts.userId, anonSessionId));

      // Delete the placeholder anonymous user if it was created
      await db.delete(users).where(eq(users.id, anonSessionId));
    }

    return NextResponse.json(
      {
        data: {
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            roles: newUser.roles,
          },
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Registration error: ", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "An unexpected error occurred during registration." } },
      { status: 500 }
    );
  }
}
