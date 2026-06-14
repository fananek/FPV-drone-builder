"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, GitCompare, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface BuildData {
  build: {
    id: string;
    name: string;
    description: string | null;
  };
  components: any[];
  metrics?: {
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
    flightTimes: {
      hover: number;
      freestyle: number;
      racing: number;
    };
  };
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get("ids") || "";

  const [buildsData, setBuildsData] = useState<BuildData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idsParam) {
      setLoading(false);
      return;
    }

    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch builds detail in parallel
    Promise.all(
      ids.map(async (id) => {
        try {
          const detailRes = await fetch(`/api/v1/builds/${id}`);
          if (!detailRes.ok) throw new Error(`Build ${id} not found`);
          const detail = await detailRes.json();
          
          // Fetch metrics calculations for this build
          const metricsRes = await fetch("/api/v1/calculate/metrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              components: detail.data.components.map((c: any) => ({
                slot: c.slot,
                quantity: c.quantity,
                partId: c.part?.id || null,
                customPartId: c.customPart?.id || null,
              })),
              customPayloadWeightGrams: detail.data.build.customPayloadWeightGrams,
            }),
          });
          
          const metricsBody = await metricsRes.json();

          return {
            build: detail.data.build,
            components: detail.data.components,
            metrics: metricsBody.data || null,
          };
        } catch (err) {
          console.error(`Error loading comparison data for build ID ${id}`, err);
          return null;
        }
      })
    )
      .then((results) => {
        setBuildsData(results.filter((r) => r !== null) as BuildData[]);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load compare metrics.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [idsParam]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest">Compiling comparison deck...</span>
      </div>
    );
  }

  if (buildsData.length === 0) {
    return (
      <div className="min-h-screen p-6 max-w-4xl mx-auto flex flex-col items-center justify-center text-center select-none">
        <GitCompare className="w-12 h-12 stroke-1 text-slate-600 mb-4" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">No Builds Selected</h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed mt-1 mb-6">
          Compare up to 4 public or private drone configurations side-by-side. Check build boxes in the gallery to initiate.
        </p>
        <button
          onClick={() => router.push("/gallery")}
          className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/10 transition cursor-pointer flex items-center gap-1.5"
        >
          Browse Public Gallery
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Row comparison helpers: returns the class style based on value relative to row values
  const getCellColorClass = (
    value: number,
    allValues: number[],
    mode: "lower-is-better" | "higher-is-better"
  ) => {
    // If all values are the same, return neutral grey style
    const unique = Array.from(new Set(allValues));
    if (unique.length <= 1) return "text-slate-300 bg-slate-900/10 border-slate-900";

    const target = mode === "lower-is-better" ? Math.min(...allValues) : Math.max(...allValues);
    const worst = mode === "lower-is-better" ? Math.max(...allValues) : Math.min(...allValues);

    if (value === target) {
      return "text-emerald-400 bg-emerald-950/20 border-emerald-900/30 font-bold";
    }
    if (value === worst) {
      return "text-rose-400 bg-rose-950/20 border-rose-900/30 font-bold";
    }
    return "text-slate-300 bg-slate-900/10 border-slate-900";
  };

  // Extract row lists
  const names = buildsData.map((d) => d.build.name);
  const auws = buildsData.map((d) => d.metrics?.auw ?? 0);
  const dryWeights = buildsData.map((d) => d.metrics?.dryWeight ?? 0);
  const batteryWeights = buildsData.map((d) => d.metrics?.batteryWeight ?? 0);
  const twrs = buildsData.map((d) => d.metrics?.twr ?? 0);
  const tipSpeeds = buildsData.map((d) => d.metrics?.tipSpeedMach ?? 0);
  const currentHeadrooms = buildsData.map((d) => d.metrics?.escCurrentHeadroom ?? 0);
  const topSpeeds = buildsData.map((d) => d.metrics?.topSpeedKmh ?? 0);
  const controlScores = buildsData.map((d) => d.metrics?.control.score ?? 0);
  const hoverTimes = buildsData.map((d) => d.metrics?.flightTimes.hover ?? 0);
  const freestyleTimes = buildsData.map((d) => d.metrics?.flightTimes.freestyle ?? 0);
  const racingTimes = buildsData.map((d) => d.metrics?.flightTimes.racing ?? 0);

  const getSlotPartName = (data: BuildData, slotName: string) => {
    const comp = data.components.find((c) => c.slot === slotName);
    const resolved = comp?.part || comp?.customPart;
    if (!resolved) return "Empty Payload";
    return `${resolved.manufacturer} ${resolved.model}`;
  };

  return (
    <div className="min-h-screen p-6 select-none max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/gallery")}
            className="p-2 border border-slate-900 hover:border-slate-800 hover:text-white text-slate-400 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-wider uppercase text-white flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-cyan-400" />
              Comparison Matrix
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
              Comparing {buildsData.length} drone configurations side-by-side
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Grid Table */}
      <div className="overflow-x-auto border border-slate-900 bg-slate-950/60 rounded-2xl shadow-2xl">
        <table className="w-full border-collapse text-left text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-900">
              <th className="p-4 font-black uppercase text-slate-500 tracking-widest w-1/5 bg-slate-950/40">Spec Telemetry</th>
              {buildsData.map((data) => (
                <th
                  key={data.build.id}
                  onClick={() => router.push(`/builds/${data.build.id}`)}
                  className="p-4 font-black uppercase text-white tracking-wider w-1/5 hover:text-cyan-400 transition cursor-pointer border-l border-slate-900 bg-slate-950/20"
                >
                  <div className="truncate max-w-[160px]">{data.build.name}</div>
                  <span className="text-[9px] text-slate-500 font-semibold lowercase tracking-normal">click for details</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* AUW Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">All-Up Weight</td>
              {buildsData.map((data, idx) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.auw ?? 0,
                    auws,
                    "lower-is-better"
                  )}`}
                >
                  {(data.metrics?.auw ?? 0).toFixed(1)}g
                </td>
              ))}
            </tr>

            {/* Dry Weight Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Dry Weight</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.dryWeight ?? 0,
                    dryWeights,
                    "lower-is-better"
                  )}`}
                >
                  {(data.metrics?.dryWeight ?? 0).toFixed(1)}g
                </td>
              ))}
            </tr>

            {/* Battery Weight Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Battery Weight</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 text-slate-300`}
                >
                  {(data.metrics?.batteryWeight ?? 0).toFixed(1)}g
                </td>
              ))}
            </tr>

            {/* TWR Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Thrust-to-Weight (TWR)</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.twr ?? 0,
                    twrs,
                    "higher-is-better"
                  )}`}
                >
                  {(data.metrics?.twr ?? 0).toFixed(2)}:1
                </td>
              ))}
            </tr>

            {/* Estimated Top Speed Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Estimated Top Speed</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.topSpeedKmh ?? 0,
                    topSpeeds,
                    "higher-is-better"
                  )}`}
                >
                  {(data.metrics?.topSpeedKmh ?? 0).toFixed(0)} km/h ({((data.metrics?.topSpeedKmh ?? 0) * 0.621371).toFixed(0)} mph)
                </td>
              ))}
            </tr>

            {/* Flight Control / Feel Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Flight Control / Feel</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.control.score ?? 0,
                    controlScores,
                    "higher-is-better"
                  )}`}
                >
                  {data.metrics?.control.label} ({data.metrics?.control.score}/100)
                </td>
              ))}
            </tr>

            {/* Motor RPM Range Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Motor RPM Range</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className="p-4 border-l border-slate-900 text-slate-300"
                >
                  {data.metrics?.minMaxRpm ? (
                    `${data.metrics.minMaxRpm.min.toLocaleString()} - ${data.metrics.minMaxRpm.max.toLocaleString()} RPM`
                  ) : (
                    "N/A"
                  )}
                </td>
              ))}
            </tr>

            {/* Hover Time Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Estimated Hover Time</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.flightTimes.hover ?? 0,
                    hoverTimes,
                    "higher-is-better"
                  )}`}
                >
                  {(data.metrics?.flightTimes.hover ?? 0).toFixed(1)} min
                </td>
              ))}
            </tr>

            {/* Freestyle Time Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Estimated Freestyle Time</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.flightTimes.freestyle ?? 0,
                    freestyleTimes,
                    "higher-is-better"
                  )}`}
                >
                  {(data.metrics?.flightTimes.freestyle ?? 0).toFixed(1)} min
                </td>
              ))}
            </tr>

            {/* Racing Time Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Estimated Racing Time</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.flightTimes.racing ?? 0,
                    racingTimes,
                    "higher-is-better"
                  )}`}
                >
                  {(data.metrics?.flightTimes.racing ?? 0).toFixed(1)} min
                </td>
              ))}
            </tr>

            {/* Prop Tip Speed Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Prop Tip Speed</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.tipSpeedMach ?? 0,
                    tipSpeeds,
                    "lower-is-better"
                  )}`}
                >
                  {(data.metrics?.tipSpeedMach ?? 0).toFixed(2)} Mach ({((data.metrics?.tipSpeedMach ?? 0) * 343).toFixed(0)} m/s)
                </td>
              ))}
            </tr>

            {/* ESC Current Headroom Row */}
            <tr className="border-b border-slate-900">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">ESC Current Headroom</td>
              {buildsData.map((data) => (
                <td
                  key={data.build.id}
                  className={`p-4 border-l border-slate-900 ${getCellColorClass(
                    data.metrics?.escCurrentHeadroom ?? 0,
                    currentHeadrooms,
                    "higher-is-better"
                  )}`}
                >
                  {(data.metrics?.escCurrentHeadroom ?? 0).toFixed(1)}%
                </td>
              ))}
            </tr>

            {/* Slots Category Divider */}
            <tr className="border-b border-slate-900 bg-slate-950/60 select-none">
              <td colSpan={buildsData.length + 1} className="p-3 font-black uppercase text-slate-500 tracking-widest text-[9px]">
                Component Layout Comparison
              </td>
            </tr>

            {/* Frame Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Carbon Frame</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "frame")}
                </td>
              ))}
            </tr>

            {/* FC Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Flight Controller</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "fc")}
                </td>
              ))}
            </tr>

            {/* ESC Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Speed Controller</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "esc")}
                </td>
              ))}
            </tr>

            {/* Motor Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Brushless Motor</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "motor")}
                </td>
              ))}
            </tr>

            {/* Propeller Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Propeller</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "propeller")}
                </td>
              ))}
            </tr>

            {/* Battery Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Battery Pack</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "battery")}
                </td>
              ))}
            </tr>

            {/* VTX Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">Video Transmit (VTX)</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "vtx")}
                </td>
              ))}
            </tr>

            {/* Camera Row */}
            <tr className="border-b border-slate-900/60">
              <td className="p-4 font-bold text-slate-400 uppercase tracking-wider bg-slate-950/10">FPV Camera</td>
              {buildsData.map((data) => (
                <td key={data.build.id} className="p-4 border-l border-slate-900 text-slate-300 font-semibold truncate max-w-[160px]">
                  {getSlotPartName(data, "camera")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest">Compiling comparison deck...</span>
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
