import { NextResponse } from "next/server";
import { db } from "@/db";
import { parts, type MainCategory, type SubCategory } from "@/db/schema";
import { eq, and, like, or, sql, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { ok, err, paginate } from "@/lib/api-response";

// GET /api/v1/parts - Paginated, filtered, searchable parts list
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mainCategory = searchParams.get("category") as MainCategory | null;
    const subCategory = searchParams.get("subCategory") as SubCategory | null;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [];

    // Filter by archived status
    if (!includeArchived) {
      conditions.push(eq(parts.isArchived, false));
    } else {
      // If including archived, check permissions
      const session = await auth();
      const userRoles = session?.user?.roles || [];
      if (!hasPermission(userRoles, "write:parts")) {
        return err("FORBIDDEN", "You do not have permission to view archived parts.", 403);
      }
    }

    if (mainCategory) {
      conditions.push(eq(parts.mainCategory, mainCategory));
    }
    if (subCategory) {
      conditions.push(eq(parts.subCategory, subCategory));
    }

    if (search) {
      conditions.push(
        or(
          like(parts.name, `%${search}%`),
          like(parts.manufacturer, `%${search}%`),
          like(parts.model, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(parts)
      .where(whereClause);

    const total = countResult?.count || 0;

    // Data query
    const data = await db
      .select()
      .from(parts)
      .where(whereClause)
      .orderBy(desc(parts.createdAt))
      .limit(limit)
      .offset(offset);

    return paginate(data, page, limit, total);
  } catch (errVal: any) {
    console.error("GET parts error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}

// POST /api/v1/parts - Create a new curated part
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "write:parts")) {
      return err("FORBIDDEN", "You do not have permission to create parts.", 403);
    }

    const body = await req.json();
    const { id, name, manufacturer, model, weightGrams, mainCategory, subCategory, attributes, isComposite, integratedPartIds } = body;

    if (!name || !manufacturer || !model || weightGrams === undefined || !mainCategory || !subCategory) {
      return err("BAD_REQUEST", "Missing required fields.", 400);
    }

    const [newPart] = await db
      .insert(parts)
      .values({
        id: id || undefined,
        name,
        manufacturer,
        model,
        weightGrams: parseFloat(weightGrams),
        mainCategory,
        subCategory,
        attributes: attributes || {},
        isComposite: !!isComposite,
        integratedPartIds: integratedPartIds || [],
        isArchived: false,
      })
      .returning();

    return ok(newPart, 201);
  } catch (errVal: any) {
    console.error("POST parts error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
