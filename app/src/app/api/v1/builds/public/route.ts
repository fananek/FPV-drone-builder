import { NextResponse } from "next/server";
import { db } from "@/db";
import { builds, buildComponents, parts, customParts, thrustTestData, type Build, type Part, type CustomPart, type BatteryChemistry } from "@/db/schema";
import { eq, inArray, isNull, and } from "drizzle-orm";
import { ok, err, paginate } from "@/lib/api-response";
import { calcAUW, calcTWR, calcThrustEmpiricalGrams, calcThrustApproxGrams } from "@/lib/engineering";

type FullBuildComponent = {
  slot: string;
  quantity: number;
  part: Part | null;
  customPart: CustomPart | null;
};

// GET /api/v1/builds/public - Public builds gallery with filtering and sorting
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category"); // e.g. "Freestyle", "Cinematic", "Racing", "Long Range", "Indoor"
    const weightClass = searchParams.get("weightClass"); // "sub-250", "250-500", "500plus"
    const frameSize = searchParams.get("frameSize"); // "2", "3", "5", "7"
    const sort = searchParams.get("sort") || "newest";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // 1. Fetch all public builds from database
    const publicBuilds = await db
      .select()
      .from(builds)
      .where(and(eq(builds.isPublic, true), isNull(builds.deletedAt)));

    if (publicBuilds.length === 0) {
      return paginate([], page, limit, 0);
    }

    const buildIds = publicBuilds.map((b) => b.id);

    // 2. Fetch all components for these builds
    const componentsList = await db
      .select()
      .from(buildComponents)
      .where(inArray(buildComponents.buildId, buildIds));

    // Gather part IDs and custom part IDs to batch-fetch them
    const partIds = componentsList.map((c) => c.partId).filter(Boolean) as string[];
    const customPartIds = componentsList.map((c) => c.customPartId).filter(Boolean) as string[];

    const fetchedParts = partIds.length > 0
      ? await db.select().from(parts).where(inArray(parts.id, partIds))
      : [];

    const fetchedCustomParts = customPartIds.length > 0
      ? await db.select().from(customParts).where(inArray(customParts.id, customPartIds))
      : [];

    const partsMap = new Map(fetchedParts.map((p) => [p.id, p]));
    const customPartsMap = new Map(fetchedCustomParts.map((cp) => [cp.id, cp]));

    // Fetch matching thrust tests for TWR calculations
    const allThrustTests = await db.select().from(thrustTestData);

    // 3. Map components and calculate metrics for each build
    const buildsWithMetrics = publicBuilds.map((build) => {
      const buildComps = componentsList
        .filter((c) => c.buildId === build.id)
        .map((c) => ({
          slot: c.slot,
          quantity: c.quantity,
          part: c.partId ? partsMap.get(c.partId) || null : null,
          customPart: c.customPartId ? customPartsMap.get(c.customPartId) || null : null,
        }));

      // Calculate AUW
      const simpleComps = buildComps.map((bc) => ({
        weightGrams: bc.part?.weightGrams ?? bc.customPart?.weightGrams ?? 0,
        quantity: bc.quantity,
      }));
      const auw = calcAUW(simpleComps, build.customPayloadWeightGrams);

      // Find propeller diameter
      const propeller = buildComps.find(
        (bc) => bc.part?.subCategory === "PROPELLER" || bc.customPart?.subCategory === "PROPELLER"
      );
      let propDiameter = 0;
      let propPitch = 0;
      let propBlades = 3;
      if (propeller) {
        if (propeller.part) {
          const attrs = propeller.part.attributes as any;
          propDiameter = attrs.diameterInch || 0;
          propPitch = attrs.pitchInch || 0;
          propBlades = attrs.blades || 3;
        } else if (propeller.customPart) {
          const specs = propeller.customPart.keySpecs as any;
          propDiameter = parseFloat(specs.diameterInch || "0");
          propPitch = parseFloat(specs.pitchInch || "0");
          propBlades = parseInt(specs.blades || "3", 10);
        }
      }

      // Calculate TWR
      const motorComp = buildComps.find(
        (bc) => bc.part?.subCategory === "MOTOR" || bc.customPart?.subCategory === "MOTOR"
      );
      const batteryComp = buildComps.find(
        (bc) => bc.part?.subCategory === "BATTERY" || bc.customPart?.subCategory === "BATTERY"
      );

      let twr = 0;
      if (motorComp && propeller && batteryComp) {
        const motorCount = buildComps
          .filter((bc) => bc.part?.subCategory === "MOTOR" || bc.customPart?.subCategory === "MOTOR")
          .reduce((sum, bc) => sum + bc.quantity, 0);

        let motorKv = 0;
        if (motorComp.part) {
          motorKv = (motorComp.part.attributes as any).kv || 0;
        } else if (motorComp.customPart) {
          motorKv = parseInt((motorComp.customPart.keySpecs as any).kv || "0", 10);
        }

        let batteryCells = 0;
        let batteryChem: BatteryChemistry = "LiPo";
        if (batteryComp.part) {
          batteryCells = (batteryComp.part.attributes as any).cellCount || 0;
          batteryChem = ((batteryComp.part.attributes as any).chemistry as BatteryChemistry) || "LiPo";
        } else if (batteryComp.customPart) {
          batteryCells = parseInt((batteryComp.customPart.keySpecs as any).cellCount || "0", 10);
          batteryChem = ((batteryComp.customPart.keySpecs as any).chemistry as BatteryChemistry) || "LiPo";
        }

        // Look for empirical thrust data
        const empiricalTest = allThrustTests.find(
          (t) =>
            t.motorId === motorComp.part?.id &&
            t.propellerId === propeller.part?.id &&
            t.batteryCellCount === batteryCells &&
            t.batteryChemistry === batteryChem
        );

        let maxThrust = 0;
        if (empiricalTest) {
          maxThrust = calcThrustEmpiricalGrams(empiricalTest.testPoints, motorCount);
        } else {
          maxThrust = calcThrustApproxGrams(
            propDiameter,
            propPitch,
            motorKv,
            batteryCells,
            batteryChem,
            motorCount,
            100, // 100% throttle
            propBlades
          );
        }
        twr = calcTWR(maxThrust, auw);
      }

      return {
        build,
        auw,
        twr,
        propDiameter,
        components: buildComps,
      };
    });

    // 4. Apply filters
    let filtered = buildsWithMetrics;

    if (category) {
      // Intent/Category: matches tags (case insensitive)
      filtered = filtered.filter((item) =>
        item.build.tags?.some((t) => t.toLowerCase() === category.toLowerCase())
      );
    }

    if (weightClass) {
      if (weightClass === "sub-250") {
        filtered = filtered.filter((item) => item.auw < 250);
      } else if (weightClass === "250-500") {
        filtered = filtered.filter((item) => item.auw >= 250 && item.auw <= 500);
      } else if (weightClass === "500plus") {
        filtered = filtered.filter((item) => item.auw > 500);
      }
    }

    if (frameSize) {
      if (frameSize === "2") {
        filtered = filtered.filter((item) => item.propDiameter < 3);
      } else if (frameSize === "3") {
        filtered = filtered.filter((item) => item.propDiameter >= 3 && item.propDiameter < 4);
      } else if (frameSize === "5") {
        filtered = filtered.filter((item) => item.propDiameter >= 4 && item.propDiameter < 6);
      } else if (frameSize === "7") {
        filtered = filtered.filter((item) => item.propDiameter >= 6);
      }
    }

    // 5. Apply sorting
    if (sort === "newest") {
      filtered.sort((a, b) => b.build.createdAt.getTime() - a.build.createdAt.getTime());
    } else if (sort === "popular") {
      filtered.sort((a, b) => b.build.ratingCount - a.build.ratingCount);
    } else if (sort === "highest-rated") {
      filtered.sort((a, b) => (b.build.averageRating || 0) - (a.build.averageRating || 0));
    } else if (sort === "lightest") {
      filtered.sort((a, b) => a.auw - b.auw);
    } else if (sort === "highest-twr") {
      filtered.sort((a, b) => b.twr - a.twr);
    }

    // 6. Pagination
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    // Return mapped builds with metrics
    const data = paginated.map((item) => ({
      ...item.build,
      auw: item.auw,
      twr: item.twr,
      propDiameter: item.propDiameter,
    }));

    return paginate(data, page, limit, total);
  } catch (errVal: any) {
    console.error("GET public builds error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred.", 500);
  }
}
