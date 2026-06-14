import { db } from "./index";
import { builds, buildComponents, parts, customParts } from "./schema";
import { eq } from "drizzle-orm";
import {
  calcAUW,
  calcTWR,
  calcTipSpeedMach,
  calcEscCurrentHeadroom,
  calcHoverThrottle,
  calcTotalCurrentAmps,
  calcFlightTime,
  runAllValidations,
} from "../lib/engineering";

async function main() {
  const allBuilds = await db.select().from(builds);
  console.log(`Found ${allBuilds.length} builds in database.`);

  for (const build of allBuilds) {
    console.log(`\n----------------------------------------`);
    console.log(`Build ID: ${build.id}`);
    console.log(`Name: ${build.name}`);
    console.log(`Description: ${build.description}`);

    const comps = await db
      .select()
      .from(buildComponents)
      .where(eq(buildComponents.buildId, build.id));
    
    console.log(`Selected Components (${comps.length}):`);
    const expandedComponents = [];

    for (const comp of comps) {
      let partDetail = null;
      let customPartDetail = null;
      let name = "";
      let category = "";
      let subCategory = "";
      let attributes: any = {};

      if (comp.partId) {
        const [p] = await db.select().from(parts).where(eq(parts.id, comp.partId));
        if (p) {
          partDetail = p;
          name = p.name;
          category = p.mainCategory;
          subCategory = p.subCategory;
          attributes = typeof p.attributes === "string" ? JSON.parse(p.attributes) : p.attributes;
        }
      } else if (comp.customPartId) {
        const [cp] = await db.select().from(customParts).where(eq(customParts.id, comp.customPartId));
        if (cp) {
          customPartDetail = cp;
          name = cp.name;
          category = cp.mainCategory;
          subCategory = cp.subCategory;
          attributes = cp.keySpecs || {};
        }
      }

      console.log(`  - Slot: ${comp.slot}, Qty: ${comp.quantity}, Part: ${name} (${subCategory})`);
      if (attributes) {
        console.log(`    Attributes:`, JSON.stringify(attributes));
      }

      expandedComponents.push({
        slot: comp.slot,
        quantity: comp.quantity,
        part: partDetail,
        customPart: customPartDetail,
      });
    }

    // Run calculations
    const motorComp = expandedComponents.find(c => c.part?.subCategory === "MOTOR" || c.customPart?.subCategory === "MOTOR");
    const escComp = expandedComponents.find(c => c.part?.subCategory === "ESC" || c.part?.subCategory === "AIO" || c.customPart?.subCategory === "ESC" || c.customPart?.subCategory === "AIO");
    
    if (motorComp && escComp) {
      const getAttrs = (comp: any) => {
        if (!comp) return null;
        if (comp.part) {
          const attrs = comp.part.attributes;
          return typeof attrs === "string" ? JSON.parse(attrs) : attrs;
        }
        return comp.customPart?.keySpecs || {};
      };

      const motor = getAttrs(motorComp);
      const esc = getAttrs(escComp);
      const motorCount = expandedComponents
        .filter((c) => c.part?.subCategory === "MOTOR" || c.customPart?.subCategory === "MOTOR")
        .reduce((sum, c) => sum + c.quantity, 0) || 4;

      if (motor && esc) {
        const margin = calcEscCurrentHeadroom(
          esc.continuousCurrentAmps || 0,
          motor.maxCurrentDraw || 0,
          motorCount
        );
        console.log(`\nCalculation inputs:`);
        console.log(`  ESC Continuous Current: ${esc.continuousCurrentAmps} A`);
        console.log(`  Motor Max Current Draw: ${motor.maxCurrentDraw} A`);
        console.log(`  Motor Count: ${motorCount}`);
        console.log(`  Calculated ESC Current Headroom: ${margin}%`);
      }
    }
  }
}

main().catch(console.error);
