import { NextResponse } from "next/server";
import { db } from "@/db";
import { parts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { ok, err } from "@/lib/api-response";

// GET /api/v1/parts/[id] - Fetch a single part
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [part] = await db
      .select()
      .from(parts)
      .where(eq(parts.id, id))
      .limit(1);

    if (!part) {
      return err("NOT_FOUND", "The requested part was not found.", 404);
    }

    return ok(part);
  } catch (errVal: any) {
    console.error("GET part detail error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// PATCH /api/v1/parts/[id] - Update a curated part
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "write:parts")) {
      return err("FORBIDDEN", "You do not have permission to update parts.", 403);
    }

    const body = await req.json();
    const updateData: Record<string, any> = {};

    const allowedFields = [
      "name",
      "manufacturer",
      "model",
      "weightGrams",
      "mainCategory",
      "subCategory",
      "attributes",
      "isComposite",
      "integratedPartIds",
      "isArchived",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "weightGrams") {
          updateData[field] = parseFloat(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return err("BAD_REQUEST", "No update fields provided.", 400);
    }

    updateData.updatedAt = new Date();

    const [updatedPart] = await db
      .update(parts)
      .set(updateData)
      .where(eq(parts.id, id))
      .returning();

    if (!updatedPart) {
      return err("NOT_FOUND", "The requested part to update was not found.", 404);
    }

    return ok(updatedPart);
  } catch (errVal: any) {
    console.error("PATCH part error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// DELETE /api/v1/parts/[id] - Soft delete a curated part
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "write:parts")) {
      return err("FORBIDDEN", "You do not have permission to delete parts.", 403);
    }

    // Soft delete sets `isArchived = true`
    const [deletedPart] = await db
      .update(parts)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(parts.id, id))
      .returning();

    if (!deletedPart) {
      return err("NOT_FOUND", "The requested part to delete was not found.", 404);
    }

    return ok({ message: "Part soft-deleted successfully.", part: deletedPart });
  } catch (errVal: any) {
    console.error("DELETE part error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
