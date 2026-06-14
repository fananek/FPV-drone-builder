import { useState, useEffect } from "react";

export interface BuildMetrics {
  auw: number;
  dryWeight: number;
  batteryWeight: number;
  twr: number;
  tipSpeedMach: number;
  escCurrentHeadroom: number;
  topSpeedKmh: number;
  control: {
    score: number;
    label: string;
    description: string;
  };
  minMaxRpm: {
    min: number;
    max: number;
  };
  hoverThrottle: number;
  flightTimes: {
    hover: number;
    freestyle: number;
    racing: number;
  };
  isEstimated: boolean;
  warnings: Array<{
    warningCode: string;
    severity: "error" | "warning" | "info";
    message: string;
    suggestedFix?: string;
  }>;
  thrustCurve: Array<{
    throttlePercent: number;
    currentAmps: number;
    thrustGrams: number;
    voltageVolts: number;
    rpm?: number;
  }>;
}

export function useBuildMetrics(components: any[], customPayloadWeightGrams: number) {
  const [metrics, setMetrics] = useState<BuildMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Serialize the parts array to establish a stable reference for the dependency array.
  // This prevents unnecessary re-fetches and infinite loops when the array reference changes
  // but its items/content remain identical.
  const serializedComponents = JSON.stringify(
    (components || []).map((c) => ({
      slot: c.slot,
      quantity: c.quantity,
      partId: c.partId || null,
      customPartId: c.customPartId || null,
    }))
  );

  useEffect(() => {
    const parsedComponents = JSON.parse(serializedComponents);

    // If no components are selected yet, return default zeroed metrics
    if (parsedComponents.length === 0) {
      setMetrics((prev) => {
        if (
          prev &&
          prev.auw === customPayloadWeightGrams &&
          prev.dryWeight === customPayloadWeightGrams &&
          prev.batteryWeight === 0 &&
          prev.twr === 0 &&
          prev.tipSpeedMach === 0 &&
          prev.escCurrentHeadroom === 0 &&
          prev.topSpeedKmh === 0 &&
          prev.control.score === 0 &&
          prev.minMaxRpm.min === 0 &&
          prev.hoverThrottle === 0 &&
          prev.flightTimes.hover === 0 &&
          prev.isEstimated === true &&
          prev.warnings.length === 0 &&
          prev.thrustCurve.length === 0
        ) {
          return prev; // Return same reference to prevent re-render loop
        }
        return {
          auw: customPayloadWeightGrams,
          dryWeight: customPayloadWeightGrams,
          batteryWeight: 0,
          twr: 0,
          tipSpeedMach: 0,
          escCurrentHeadroom: 0,
          topSpeedKmh: 0,
          control: {
            score: 0,
            label: "Unflyable",
            description: "Mount components to simulate responsiveness profiles.",
          },
          minMaxRpm: { min: 0, max: 0 },
          hoverThrottle: 0,
          flightTimes: { hover: 0, freestyle: 0, racing: 0 },
          isEstimated: true,
          warnings: [],
          thrustCurve: [],
        };
      });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/v1/calculate/metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            components: parsedComponents,
            customPayloadWeightGrams,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to calculate flight metrics.");
        }

        const res = await response.json();
        setMetrics(res.data);
        setError(null);
      } catch (errVal: any) {
        console.error("Error loading metrics: ", errVal);
        setError(errVal.message || "Error running engineering calculations.");
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [serializedComponents, customPayloadWeightGrams]);

  return { metrics, loading, error };
}

