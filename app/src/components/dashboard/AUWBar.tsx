import React from "react";

export interface AUWBarProps {
  auw: number;
  dryWeight: number;
  batteryWeight: number;
}

export default function AUWBar({ auw, dryWeight, batteryWeight }: AUWBarProps) {
  // Use a max scale of 1000g, but if auw exceeds it, scale to auw * 1.2
  const maxScale = auw > 1000 ? Math.ceil(auw / 500) * 500 : 1000;
  
  // Percent of current AUW
  const percent = Math.min(100, (auw / maxScale) * 100);
  
  // Percent position of the 250g regulatory line
  const markerPercent = (250 / maxScale) * 100;

  const isSub250 = auw < 250;
  const barColor = isSub250 ? "bg-gradient-to-r from-cyan-500 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-rose-500";
  const statusLabel = isSub250 ? "Sub-250g (FAA registration exempt)" : "Registration required (≥ 250g)";
  const statusColor = isSub250 ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/30" : "text-amber-400 bg-amber-950/40 border-amber-800/30";

  // Battery recommendation: battery should be roughly 50% of the drone's dry weight
  const recBatteryWeight = dryWeight * 0.5;
  const devRatio = recBatteryWeight > 0 ? batteryWeight / recBatteryWeight : 0;
  const batteryPctOfDry = dryWeight > 0 ? (batteryWeight / dryWeight) * 100 : 0;

  let recMessage = "No battery selected. Recommended weight: ~0g.";
  let recStatusColor = "text-slate-400";

  if (dryWeight <= 0) {
    recMessage = "Mount frame and electronics to simulate weights.";
  } else if (batteryWeight <= 0) {
    recMessage = `No battery mounted. Recommended pack weight: ~${recBatteryWeight.toFixed(0)}g (50% of dry weight).`;
  } else if (devRatio >= 0.8 && devRatio <= 1.2) {
    recMessage = `Optimal battery weight match (${batteryPctOfDry.toFixed(0)}% of dry weight). Well balanced for performance.`;
    recStatusColor = "text-emerald-400";
  } else if (devRatio < 0.8) {
    recMessage = `Lighter battery mounted (${batteryPctOfDry.toFixed(0)}% of dry weight). High agility, but expects shorter flight times. (Rec: ~${recBatteryWeight.toFixed(0)}g)`;
    recStatusColor = "text-cyan-400";
  } else {
    recMessage = `Heavier battery mounted (${batteryPctOfDry.toFixed(0)}% of dry weight). Long cruise times, but decreased snap responsiveness. (Rec: ~${recBatteryWeight.toFixed(0)}g)`;
    recStatusColor = "text-amber-400";
  }

  return (
    <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-5 rounded-2xl flex flex-col relative overflow-hidden select-none">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        All-Up Weight (AUW)
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-black text-white">{auw.toFixed(1)}</span>
        <span className="text-xs font-bold text-slate-400">grams</span>
        <span className={`ml-auto text-[9px] border px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="relative w-full h-4 bg-slate-950 border border-slate-900/60 rounded-full mb-1">
        {/* Fill bar */}
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${percent}%` }}
        />

        {/* 250g Marker Vertical Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 z-10 flex flex-col items-center"
          style={{ left: `${markerPercent}%` }}
        >
          {/* Tooltip marker */}
          <div className="absolute top-4 bg-rose-500 text-white font-bold text-[8px] px-1 rounded-sm shadow-md whitespace-nowrap">
            250g Limit
          </div>
        </div>
      </div>

      {/* Scale indicators */}
      <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-4 border-b border-slate-900/60 pb-3">
        <span>0g</span>
        <span>250g</span>
        <span>500g</span>
        <span>750g</span>
        <span>{maxScale}g</span>
      </div>

      {/* Battery weight rule-of-thumb panel */}
      <div className="mt-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-slate-950/40 border border-slate-900 rounded-xl">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Dry Weight</div>
            <div className="font-extrabold text-white mt-0.5">{dryWeight.toFixed(1)}g</div>
          </div>
          <div className="p-2 bg-slate-950/40 border border-slate-900 rounded-xl">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Battery Weight</div>
            <div className="font-extrabold text-slate-300 mt-0.5">{batteryWeight.toFixed(1)}g</div>
          </div>
          <div className="p-2 bg-slate-950/40 border border-slate-900 rounded-xl">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Recommended</div>
            <div className="font-extrabold text-cyan-400 mt-0.5">~{recBatteryWeight.toFixed(0)}g</div>
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/25 border border-slate-900 rounded-xl text-[10px] leading-relaxed font-semibold">
          <span className="text-slate-400">Rule of Thumb: </span>
          <span className={recStatusColor}>{recMessage}</span>
        </div>
      </div>
    </div>
  );
}
