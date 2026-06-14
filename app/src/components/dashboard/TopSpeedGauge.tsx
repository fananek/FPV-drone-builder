import React from "react";

export interface TopSpeedGaugeProps {
  topSpeedKmh: number;
}

export default function TopSpeedGauge({ topSpeedKmh }: TopSpeedGaugeProps) {
  // Use a max dial scale of 200 km/h, but scale dynamically if the speed is higher
  const maxScale = topSpeedKmh > 200 ? Math.ceil(topSpeedKmh / 50) * 50 : 200;
  const clampedSpeed = Math.max(0, Math.min(maxScale, topSpeedKmh));

  const radius = 50;
  const strokeWidth = 6;
  const circ = Math.PI * radius;
  
  const percent = clampedSpeed / maxScale;
  const strokeOffset = circ - percent * circ;

  // Conversion to MPH
  const topSpeedMph = topSpeedKmh * 0.621371;

  let speedLabel = "Park Cruiser";
  let speedColor = "text-blue-400 bg-blue-950/40 border-blue-800/30";

  if (topSpeedKmh < 60) {
    speedLabel = "Park Cruiser";
    speedColor = "text-blue-400 bg-blue-950/40 border-blue-800/30";
  } else if (topSpeedKmh >= 60 && topSpeedKmh < 120) {
    speedLabel = "Acro Speed";
    speedColor = "text-emerald-400 bg-emerald-950/40 border-emerald-800/30";
  } else if (topSpeedKmh >= 120 && topSpeedKmh < 160) {
    speedLabel = "High Velocity";
    speedColor = "text-amber-400 bg-amber-950/40 border-amber-800/30";
  } else {
    speedLabel = "Insane Speed";
    speedColor = "text-purple-400 bg-purple-950/40 border-purple-800/30 font-black animate-pulse";
  }

  return (
    <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 hover:border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden h-44 select-none transition-all duration-300">
      <div className="absolute top-3 left-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
        Estimated Top Speed
      </div>

      <div className="relative w-36 h-20 mt-6 flex items-center justify-center">
        {/* SVG Circular Gauge */}
        <svg className="w-full h-full" viewBox="0 0 120 60">
          <defs>
            <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" /> {/* blue-500 */}
              <stop offset="40%" stopColor="#10b981" /> {/* emerald-500 */}
              <stop offset="80%" stopColor="#f59e0b" /> {/* amber-500 */}
              <stop offset="100%" stopColor="#a855f7" /> {/* purple-500 */}
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
            stroke="url(#speedGradient)"
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
            {topSpeedKmh.toFixed(0)}<span className="text-sm font-bold text-slate-400"> km/h</span>
          </span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">
            ({topSpeedMph.toFixed(0)} mph)
          </span>
        </div>
      </div>

      <span className={`px-2.5 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-full ${speedColor}`}>
        {speedLabel}
      </span>
    </div>
  );
}
