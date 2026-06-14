import { NextResponse } from "next/server";
import { db } from "@/db";
import { parts, type MainCategory, type SubCategory } from "@/db/schema";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { ok, err } from "@/lib/api-response";

// POST /api/v1/parts/bulk-import - Bulk import parts from a CSV-mapped JSON payload
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];

    if (!hasPermission(userRoles, "bulk-import:parts")) {
      return err("FORBIDDEN", "You do not have permission to bulk import parts.", 403);
    }

    const body = await req.json();
    const { parts: partsToImport } = body;

    if (!partsToImport || !Array.isArray(partsToImport)) {
      return err("BAD_REQUEST", "Payload must contain an array of parts to import.", 400);
    }

    const importedCount = await db.transaction(async (tx) => {
      let count = 0;
      for (const item of partsToImport) {
        const { id, name, manufacturer, model, weightGrams, mainCategory, subCategory, attributes, isComposite, integratedPartIds } = item;

        if (!name || !manufacturer || !model || weightGrams === undefined || !mainCategory || !subCategory) {
          throw new Error(`Invalid part data: missing required fields for ${name || "unknown part"}`);
        }

        let parsedAttributes = attributes || {};
        if (typeof parsedAttributes === "string") {
          try {
            parsedAttributes = JSON.parse(parsedAttributes);
          } catch (e) {
            parsedAttributes = {};
          }
        }

        let parsedIntegratedPartIds = integratedPartIds || [];
        if (typeof parsedIntegratedPartIds === "string") {
          try {
            parsedIntegratedPartIds = JSON.parse(parsedIntegratedPartIds);
          } catch (e) {
            parsedIntegratedPartIds = [];
          }
        }

        await tx.insert(parts).values({
          id: id || undefined,
          name,
          manufacturer,
          model,
          weightGrams: parseFloat(weightGrams),
          mainCategory: mainCategory as MainCategory,
          subCategory: subCategory as SubCategory,
          attributes: parsedAttributes,
          isComposite: !!isComposite,
          integratedPartIds: parsedIntegratedPartIds,
          isArchived: false,
        });
        count++;
      }
      return count;
    });

    return ok({ message: `Successfully imported ${importedCount} parts.`, count: importedCount });
  } catch (errVal: any) {
    console.error("Bulk import parts error: ", errVal);
    return err("SERVER_ERROR", errVal.message || "An unexpected error occurred during bulk import.", 500);
  }
}
