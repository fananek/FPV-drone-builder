import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export type SaveStatus = "idle" | "saving" | "saved" | "retrying" | "error" | "conflict";

export function useAutoSave(
  buildId: string,
  buildState: {
    name: string;
    description: string | null;
    isPublic: boolean;
    tags: string[];
    customPayloadWeightGrams: number;
    version: number;
    components: any[];
    imageUrl?: string | null;
  },
  onSaveSuccess: (updatedBuild: any) => void,
  onConflict: (latestBuild: any) => void
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);

  // Keep latest state in ref to avoid re-triggering timeout on every key press
  const stateRef = useRef(buildState);
  stateRef.current = buildState;

  useEffect(() => {
    // Skip auto-saving on initial render/load when components are not loaded yet
    if (!buildId) return;

    setSaveStatus("saving");

    const performSave = async (attempt = 1): Promise<void> => {
      const currentState = stateRef.current;
      
      try {
        const response = await fetch(`/api/v1/builds/${buildId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: currentState.name,
            description: currentState.description,
            isPublic: currentState.isPublic,
            tags: currentState.tags,
            customPayloadWeightGrams: currentState.customPayloadWeightGrams,
            version: currentState.version,
            imageUrl: currentState.imageUrl || null,
            components: currentState.components.map((c) => ({
              slot: c.slot,
              quantity: c.quantity,
              partId: c.partId || null,
              customPartId: c.customPartId || null,
              customNotes: c.customNotes || null,
            })),
          }),
        });

        if (response.status === 409) {
          setSaveStatus("conflict");
          const result = await response.json();
          onConflict(result.latestBuild);
          toast.warning("Conflict detected. Another session modified this build.");
          return;
        }

        if (response.status === 400) {
          setSaveStatus("error");
          const result = await response.json().catch(() => ({}));
          const errMsg = result.error?.message || "Invalid build state.";
          toast.error(errMsg);
          return;
        }

        if (!response.ok) {
          throw new Error("HTTP Save Error");
        }

        const result = await response.json();
        // result.data.build contains the updated build row (with bumped version)
        onSaveSuccess(result.data.build);
        setSaveStatus("saved");
        setRetryCount(0);
      } catch (err) {
        console.error(`Save attempt ${attempt} failed: `, err);
        
        if (attempt < 3) {
          setSaveStatus("retrying");
          const backoffTime = Math.pow(2, attempt) * 1000; // 2s, 4s
          setTimeout(() => {
            performSave(attempt + 1);
          }, backoffTime);
        } else {
          setSaveStatus("error");
          toast.error("Connection uplink lost. Auto-save offline.");
        }
      }
    };

    const timer = setTimeout(() => {
      performSave();
    }, 1000); // 1-second debounce

    return () => clearTimeout(timer);
  }, [
    buildId,
    // Dependency on values to trigger auto-save when changed
    buildState.name,
    buildState.description,
    buildState.isPublic,
    buildState.tags,
    buildState.customPayloadWeightGrams,
    buildState.imageUrl,
    // JSON stringify components so changes inside the array trigger the effect
    JSON.stringify(buildState.components)
  ]);

  return { saveStatus };
}
