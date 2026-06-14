import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { err } from "@/lib/api-response";
import { auth } from "@/auth";

// Rate limiting map (IP/User -> Timestamp[])
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxReqs = 60; // 60 requests per minute

  const timestamps = rateLimitMap.get(key) || [];
  // Filter out timestamps older than 1 minute
  const activeTimestamps = timestamps.filter((t) => now - t < windowMs);
  
  if (activeTimestamps.length >= maxReqs) {
    return false;
  }

  activeTimestamps.push(now);
  rateLimitMap.set(key, activeTimestamps);
  return true;
}

export async function POST(req: Request) {
  try {
    // Check API Key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const isConfigured = apiKey && apiKey !== "google-gemini-dummy-api-key";

    if (!isConfigured) {
      return err(
        "NO_API_KEY",
        "The Gemini AI Advisor is currently offline. Please configure a valid GOOGLE_GENERATIVE_AI_API_KEY in the server environment.",
        503
      );
    }

    // Rate Limiting
    const session = await auth();
    const rateLimitKey = session?.user?.id || req.headers.get("x-forwarded-for") || "anonymous-client";
    if (!checkRateLimit(rateLimitKey)) {
      return err("RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Maximum 60 requests per minute.", 429);
    }

    const { messages, buildState } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return err("BAD_REQUEST", "Missing required field: messages.", 400);
    }

    // Deconstruct build configuration state for the system prompt
    const buildName = buildState?.name || "Unnamed Build";
    const intent = buildState?.intent || "Not specified";
    const frameSize = buildState?.frameSize || "Not specified";
    const auw = buildState?.auw || 0;
    const twr = buildState?.twr || 0;
    const components = buildState?.components || [];
    const warnings = buildState?.warnings || [];

    const componentsList = components
      .map((c: any) => {
        const p = c.part || c.customPart;
        if (!p) return `- [${c.slot}] Empty`;
        return `- [${c.slot}] ${p.manufacturer} ${p.model} (${p.weightGrams}g, Category: ${p.subCategory})`;
      })
      .join("\n");

    const warningsList = warnings
      .map((w: any) => `- [${w.warningCode}] (${w.severity}) ${w.message} (Suggested Fix: ${w.suggestedFix || "None"})`)
      .join("\n");

    const systemPrompt = `You are the FPV Hangar AI Advisor, a world-class expert FPV drone engineer and telemetry specialist.
Your task is to guide and collaborate with the user in designing, auditing, and troubleshooting their custom drone builds.

=== Current Build Configuration ===
Build Name: ${buildName}
Flying Style (Intent): ${intent}
Scale/Frame Size: ${frameSize}
All-Up Weight: ${auw.toFixed(1)}g
Thrust-to-Weight Ratio: ${twr.toFixed(2)}

=== Active Components ===
${componentsList || "No components selected yet."}

=== Active Engineering Validation Warnings ===
${warningsList || "No safety warnings. Build is green and ready for takeoff!"}

=== Guidelines ===
1. Provide direct, non-vague, technically precise FPV engineering feedback.
2. Refer to physical quantities: battery cells (1S-6S), motor KV ratings, stator sizes (e.g. 2207), mounting patterns, and prop tip speeds (Mach).
3. If there are active safety warnings, prioritize explaining the risk and guiding the user on how to resolve them.
4. Keep explanations grounded in physics (e.g., stator volume heat dissipation, KV voltage load limits, battery C-ratings vs ESC draw).
5. Be professional, supportive, and clear.
`;

    // Stream response using Vercel AI SDK
    const result = streamText({
      model: google("gemini-2.0-flash"),
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    return result.toTextStreamResponse();
  } catch (errVal: any) {
    console.error("AI chat error: ", errVal);
    return err("SERVER_ERROR", "An unexpected error occurred during AI advisor communication.", 500);
  }
}
