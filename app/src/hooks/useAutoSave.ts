import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export type SaveStatus = "idle" | "saving" | "saved" | "retrying" | "error" | "conflict";

export interface BuildComponentState {
  slot: string;
  quantity: number;
  partId?: string | null;
  customPartId?: string | null;
  part?: unknown;
  customPart?: unknown;
  customNotes?: string | null;
}

export interface BuildState {
  name: string;
  description: string | null;
  isPublic: boolean;
  tags: string[];
  customPayloadWeightGrams: number;
  version: number;
  components: BuildComponentState[];
  imageUrl?: string | null;
}

// Helper to compare build states
function isStateEqual(a: BuildState | null, b: BuildState | null) {
  if (!a || !b) return false;
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.isPublic === b.isPublic &&
    a.customPayloadWeightGrams === b.customPayloadWeightGrams &&
    a.imageUrl === b.imageUrl &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    JSON.stringify(a.components) === JSON.stringify(b.components)
  );
}

export function useAutoSave<TBuild>(
  buildId: string,
  buildState: BuildState,
  onSaveSuccess: (updatedBuild: { version: number }) => void,
  onConflict: (latestBuild: TBuild) => void
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Keep latest state in ref to avoid re-triggering timeout on every key press
  const stateRef = useRef<BuildState>(buildState);
  useEffect(() => {
    stateRef.current = buildState;
  }, [buildState]);

  // Keep track of the last known saved/loaded state from the server
  const lastSavedStateRef = useRef<BuildState | null>(null);

  // Reset lastSavedStateRef when buildId changes
  useEffect(() => {
    lastSavedStateRef.current = null;
  }, [buildId]);

  const componentsString = JSON.stringify(buildState.components);

  useEffect(() => {
    // Skip auto-saving on initial render/load when components are not loaded yet
    if (!buildId) return;

    const currentState = stateRef.current;

    // If lastSavedStateRef is not initialized, initialize it with the current loaded state
    if (!lastSavedStateRef.current) {
      lastSavedStateRef.current = currentState;
      return;
    }

    // If the version of the current state has changed, it means we loaded a new version from the server.
    // In this case, we update our lastSavedStateRef and consider the state clean.
    if (currentState.version !== lastSavedStateRef.current.version) {
      lastSavedStateRef.current = currentState;
      return;
    }

    // If the state hasn't changed from the last saved state, do not trigger auto-save.
    if (isStateEqual(currentState, lastSavedStateRef.current)) {
      return;
    }

    // Otherwise, we have unsaved local changes!
    setSaveStatus("saving");

    const performSave = async (attempt = 1): Promise<void> => {
      const stateToSave = stateRef.current;
      
      try {
        const response = await fetch(`/api/v1/builds/${buildId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: stateToSave.name,
            description: stateToSave.description,
            isPublic: stateToSave.isPublic,
            tags: stateToSave.tags,
            customPayloadWeightGrams: stateToSave.customPayloadWeightGrams,
            version: stateToSave.version,
            imageUrl: stateToSave.imageUrl || null,
            components: stateToSave.components.map((c) => ({
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
        const savedBuild = result.data.build;
        
        lastSavedStateRef.current = {
          ...stateToSave,
          version: savedBuild.version,
        };

        onSaveSuccess(savedBuild);
        setSaveStatus("saved");
      } catch (err) {
        console.error(`Save attempt ${attempt} failed: `, err);
        
        if (attempt < 3) {
          setSaveStatus("retrying");
          const backoffTime = Math.pow(2, attempt) * 1000;
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
    buildState.name,
    buildState.description,
    buildState.isPublic,
    buildState.tags,
    buildState.customPayloadWeightGrams,
    buildState.imageUrl,
    componentsString,
    onSaveSuccess,
    onConflict
  ]);

  return { saveStatus };
}
