import React from "react";

export interface ESCCurrentBarProps {
  escCurrentHeadroom: number;
}

export default function ESCCurrentBar({ escCurrentHeadroom }: ESCCurrentBarProps) {
  // escCurrentHeadroom is the percentage headroom. E.g. 30% margin means we are using 70% of the rating.
  // -10% margin means we are using 110% of the rating.
  const usedPercent = 100 - escCurrentHeadroom;
  
  // Clamp used percent for visual display between 0 and 120%
  const displayPercent = Math.max(0, Math.min(120, usedPercent));
  
  let statusLabel = "Safe";
  let textColor = "text-emerald-400";
  let barColor = "bg-gradient-to-r from-cyan-500 to-emerald-400";
  let containerBorderClass = "border-slate-900";

  if (escCurrentHeadroom < 0) {
    statusLabel = "OVERLOADED";
    textColor = "text-rose-500 font-extrabold animate-pulse";
    barColor = "bg-gradient-to-r from-amber-500 to-rose-500";
    containerBorderClass = "border-rose-500/50 animate-pulse";
  } else if (escCurrentHeadroom < 15) {
    statusLabel = "Tight Headroom";
    textColor = "text-amber-500 font-bold";
    barColor = "bg-gradient-to-r from-yellow-400 to-amber-500";
  }

  return (
    <div className={`bg-slate-900/30 backdrop-blur-md border ${containerBorderClass} p-5 rounded-2xl flex flex-col relative overflow-hidden select-none transition-all duration-300`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        ESC Current Headroom
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-black text-white">
          {escCurrentHeadroom.toFixed(1)}%
        </span>
        <span className="text-xs font-bold text-slate-400">headroom</span>
        <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider ${textColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="relative w-full h-4 bg-slate-950 border border-slate-900 rounded-full mb-1">
        {/* Fill bar representing used capacity */}
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${(displayPercent / 120) * 100}%` }}
        />

        {/* 100% capacity marker (continuous rating limit) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
          style={{ left: `${(100 / 120) * 100}%` }}
        >
          <div className="absolute top-4 -left-6 bg-rose-600 text-white font-bold text-[8px] px-1 rounded-sm shadow-md whitespace-nowrap">
            Limit
          </div>
        </div>
      </div>

      <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-4">
        <span>0% load</span>
        <span>60%</span>
        <span>100% limit</span>
        <span>120% max</span>
      </div>
    </div>
  );
}
