import React from "react";

export interface TWRGaugeProps {
  twr: number;
}

export default function TWRGauge({ twr }: TWRGaugeProps) {
  // Clamp TWR between 0 and 12 for visual representation
  const clampedTwr = Math.max(0, Math.min(12, twr));
  
  const radius = 50;
  const strokeWidth = 6;
  const circ = Math.PI * radius;
  
  const percent = clampedTwr / 12;
  const strokeOffset = circ - percent * circ;

  let profileLabel = "Unflyable";
  let profileColor = "text-rose-400 bg-rose-950/40 border-rose-800/30";

  if (twr < 1.5) {
    profileLabel = "Low Thrust";
    profileColor = "text-rose-400 bg-rose-950/40 border-rose-800/30";
  } else if (twr >= 1.5 && twr < 3.0) {
    profileLabel = "Cinematic / Aerial";
    profileColor = "text-amber-400 bg-amber-950/40 border-amber-800/30";
  } else if (twr >= 3.0 && twr < 5.0) {
    profileLabel = "Sport / Acro";
    profileColor = "text-emerald-400 bg-emerald-950/40 border-emerald-800/30";
  } else {
    profileLabel = "Freestyle / Race Pro";
    profileColor = "text-cyan-400 bg-cyan-950/40 border-cyan-800/30";
  }

  return (
    <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 hover:border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden h-44 select-none transition-all duration-300">
      <div className="absolute top-3 left-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
        Thrust-To-Weight (TWR)
      </div>

      <div className="relative w-36 h-20 mt-6 flex items-center justify-center">
        {/* SVG Circular Gauge */}
        <svg className="w-full h-full" viewBox="0 0 120 60">
          <defs>
            <linearGradient id="twrGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" /> {/* rose-500 */}
              <stop offset="30%" stopColor="#f59e0b" /> {/* amber-500 */}
              <stop offset="70%" stopColor="#10b981" /> {/* emerald-500 */}
              <stop offset="100%" stopColor="#06b6d4" /> {/* cyan-500 */}
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
            stroke="url(#twrGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Readout in the center of arc */}
        <div className="absolute bottom-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tracking-tight text-white leading-none">
            {twr.toFixed(2)}
          </span>
        </div>
      </div>

      <span className={`px-2.5 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-full ${profileColor}`}>
        {profileLabel}
      </span>
    </div>
  );
}
