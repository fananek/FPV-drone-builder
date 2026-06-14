import React from "react";
import TWRGauge from "./TWRGauge";
import TipSpeedGauge from "./TipSpeedGauge";
import TopSpeedGauge from "./TopSpeedGauge";
import ControlGauge from "./ControlGauge";
import AUWBar from "./AUWBar";
import ESCCurrentBar from "./ESCCurrentBar";
import FlightTimeBars from "./FlightTimeBars";
import ThrustCurveChart from "./ThrustCurveChart";
import BuildWarningsPanel from "../build/BuildWarningsPanel";
import { type BuildMetrics } from "@/hooks/useBuildMetrics";
import { Gauge, Loader2 } from "lucide-react";

export interface MetricsDashboardProps {
  metrics: BuildMetrics | null;
  loading: boolean;
  error: string | null;
}

export default function MetricsDashboard({ metrics, loading, error }: MetricsDashboardProps) {
  if (error) {
    return (
      <div className="bg-slate-950 border border-red-500/20 p-6 rounded-2xl flex flex-col items-center justify-center text-center h-96">
        <span className="text-sm font-bold text-red-500 uppercase tracking-widest mb-2">
          Calculation Error
        </span>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          {error}
        </p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-slate-950 border border-slate-900 p-6 rounded-2xl flex flex-col items-center justify-center text-center h-96 text-slate-500 select-none">
        <Gauge className="w-10 h-10 stroke-1 mb-3 animate-pulse text-slate-600" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Initializing Engine...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-sm border border-slate-800/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 z-20 shadow-lg select-none">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider">
            Simulating...
          </span>
        </div>
      )}

      {/* Gauges Grid */}
      <div className="grid grid-cols-2 gap-4">
        <TWRGauge twr={metrics.twr} />
        <TipSpeedGauge mach={metrics.tipSpeedMach} />
        <TopSpeedGauge topSpeedKmh={metrics.topSpeedKmh} />
        <ControlGauge control={metrics.control} />
      </div>

      {/* AUW Bar with Dry Weight & Battery Recommendation */}
      <AUWBar 
        auw={metrics.auw} 
        dryWeight={metrics.dryWeight} 
        batteryWeight={metrics.batteryWeight} 
      />

      {/* ESC Current Headroom */}
      <ESCCurrentBar escCurrentHeadroom={metrics.escCurrentHeadroom} />

      {/* Flight Times */}
      <FlightTimeBars flightTimes={metrics.flightTimes} />

      {/* Thrust Curve (Only visible when empirical data exists or we have estimated curve) */}
      <ThrustCurveChart thrustCurve={metrics.thrustCurve} />

      {/* Warnings Panel */}
      <BuildWarningsPanel warnings={metrics.warnings} />
    </div>
  );
}
