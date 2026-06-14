import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { db } from "@/db";
import { parts, type Part } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, err } from "@/lib/api-response";

// POST /api/v1/ai/wizard-step - Get compatibility-filtered part recommendations with AI reasoning
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { intent, frameSize, selectedComponents, targetSlot } = body;

    if (!targetSlot) {
      return err("BAD_REQUEST", "targetSlot is required.", 400);
    }

    // 1. Fetch all candidate parts for this subCategory / slot
    // Map targetSlot (e.g. MOTOR, PROPELLER) to subCategory string
    const candidateParts = await db
      .select()
      .from(parts)
      .where(and(eq(parts.subCategory, targetSlot), eq(parts.isArchived, false)));

    // 2. Perform rule-based mechanical filtering if a frame is already selected
    const framePart = selectedComponents?.frame as Part | undefined;
    let filteredParts = candidateParts;

    if (framePart && framePart.attributes) {
      const frameAttrs = typeof framePart.attributes === "string"
        ? JSON.parse(framePart.attributes)
        : framePart.attributes;

      if (targetSlot === "PROPELLER") {
        const maxProp = parseFloat(frameAttrs.maxPropSizeInch || "0");
        if (maxProp > 0) {
          filteredParts = candidateParts.filter((p) => {
            const propAttrs = typeof p.attributes === "string" ? JSON.parse(p.attributes) : p.attributes;
            const dia = parseFloat(propAttrs.diameterInch || "0");
            return dia <= maxProp;
          });
        }
      } else if (targetSlot === "MOTOR") {
        const motorPatterns = frameAttrs.motorMountingPattern || [];
        if (motorPatterns.length > 0) {
          filteredParts = candidateParts.filter((p) => {
            const motorAttrs = typeof p.attributes === "string" ? JSON.parse(p.attributes) : p.attributes;
            return motorPatterns.includes(motorAttrs.mountingPattern);
          });
        }
      } else if (targetSlot === "FC" || targetSlot === "ESC" || targetSlot === "AIO") {
        const fcPatterns = frameAttrs.fcMountingPattern || [];
        if (fcPatterns.length > 0) {
          filteredParts = candidateParts.filter((p) => {
            const stackAttrs = typeof p.attributes === "string" ? JSON.parse(p.attributes) : p.attributes;
            return fcPatterns.includes(stackAttrs.mountingPattern);
          });
        }
      }
    }

    // If no parts match mechanical constraints, return empty list
    if (filteredParts.length === 0) {
      return ok({ recommendations: [] });
    }

    // Check if AI key is configured
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const isConfigured = apiKey && apiKey !== "google-gemini-dummy-api-key";

    if (!isConfigured) {
      // Offline fallback: return all compatible parts with a default description
      const recommendations = filteredParts.map((p) => ({
        part: p,
        reasoning: "Compatible with your selected frame dimensions.",
        score: 1,
      }));
      return ok({ recommendations });
    }

    // 3. AI Selection & Reasoning
    const candidateSummary = filteredParts
      .map((p) => `ID: ${p.id} | Name: ${p.manufacturer} ${p.model} | Weight: ${p.weightGrams}g | Specs: ${JSON.stringify(p.attributes)}`)
      .join("\n");

    const prompt = `You are an FPV expert. A pilot is building a drone.
Intent / Flying Style: ${intent || "General flying"}
Scale / Size: ${frameSize || "Not specified"}
Selected Parts: ${JSON.stringify(selectedComponents || {})}

Candidate parts for the next slot (${targetSlot}):
${candidateSummary}

Task:
Select the top 3 best matching parts from the candidates above for the pilot's intent.
Provide a 1-sentence reasoning for why each is a great fit.

Return your answer strictly in this JSON format:
[
  { "id": "part-id-1", "reasoning": "reasoning text..." },
  { "id": "part-id-2", "reasoning": "reasoning text..." },
  { "id": "part-id-3", "reasoning": "reasoning text..." }
]
Only return JSON. No markdown blocks.`;

    const aiResult = await generateText({
      model: google("gemini-2.0-flash"),
      prompt,
    });

    try {
      const parsedText = aiResult.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const selections = JSON.parse(parsedText);

      const recommendations = selections
        .map((sel: any) => {
          const match = filteredParts.find((p) => p.id === sel.id);
          if (!match) return null;
          return {
            part: match,
            reasoning: sel.reasoning,
            score: 3, // High recommendation
          };
        })
        .filter(Boolean);

      // Append any remaining compatible parts that AI didn't explicitly pick as top 3
      const recommendedIds = new Set(selections.map((sel: any) => sel.id));
      const otherParts = filteredParts
        .filter((p) => !recommendedIds.has(p.id))
        .map((p) => ({
          part: p,
          reasoning: "Mechanically compatible with your build.",
          score: 1,
        }));

      return ok({ recommendations: [...recommendations, ...otherParts] });
    } catch (parseErr) {
      console.error("AI JSON parse error, returning unranked list: ", parseErr, aiResult.text);
      const recommendations = filteredParts.map((p) => ({
        part: p,
        reasoning: "Mechanically compatible with your selected frame.",
        score: 1,
      }));
      return ok({ recommendations });
    }
  } catch (errVal: any) {
    console.error("Wizard step recommendation error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred during recommendations.", 500);
  }
}
