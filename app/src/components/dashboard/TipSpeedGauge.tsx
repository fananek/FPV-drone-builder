import React from "react";

export interface TipSpeedGaugeProps {
  mach: number;
}

export default function TipSpeedGauge({ mach }: TipSpeedGaugeProps) {
  // Clamp Mach between 0 and 1.2 for dial display
  const clampedMach = Math.max(0, Math.min(1.2, mach));

  const radius = 50;
  const strokeWidth = 6;
  const circ = Math.PI * radius;
  
  const percent = clampedMach / 1.2;
  const strokeOffset = circ - percent * circ;

  let speedLabel = "Subsonic Safe";
  let speedColor = "text-emerald-400 bg-emerald-950/40 border-emerald-800/30";
  let containerBorderClass = "border-slate-900";

  if (mach >= 0.9) {
    speedLabel = "Critical Flutter";
    speedColor = "text-rose-400 bg-rose-950/60 border-rose-800/50 font-black animate-pulse";
    containerBorderClass = "border-rose-500/30 shadow-lg shadow-rose-500/5";
  } else if (mach >= 0.85) {
    speedLabel = "Approaching Limit";
    speedColor = "text-amber-400 bg-amber-950/40 border-amber-800/30 font-bold";
  }

  return (
    <div className={`bg-slate-900/30 backdrop-blur-md border ${containerBorderClass} hover:border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden h-44 select-none transition-all duration-300`}>
      <div className="absolute top-3 left-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
        Propeller Tip Speed
      </div>

      <div className="relative w-36 h-20 mt-6 flex items-center justify-center">
        {/* SVG Circular Gauge */}
        <svg className="w-full h-full" viewBox="0 0 120 60">
          <defs>
            <linearGradient id="machGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" /> {/* emerald-500 */}
              <stop offset="70%" stopColor="#f59e0b" /> {/* amber-500 */}
              <stop offset="85%" stopColor="#ef4444" /> {/* red-500 */}
              <stop offset="100%" stopColor="#b91c1c" /> {/* dark-red-700 */}
            </linearGradient>
          </defs>

          {/* Background track */}
          <path
            d="M 10 50 A 50 50 0 0 1 110 50"
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* Value track */}
          <path
            d="M 10 50 A 50 50 0 0 1 110 50"
            fill="none"
            stroke="url(#machGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Readout in center of arc */}
        <div className="absolute bottom-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tracking-tight text-white leading-none">
            {mach.toFixed(2)}<span className="text-sm font-bold text-slate-400"> M</span>
          </span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">({(mach * 343).toFixed(0)} m/s)</span>
        </div>
      </div>

      <span className={`px-2.5 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-full ${speedColor}`}>
        {speedLabel}
      </span>
    </div>
  );
}
