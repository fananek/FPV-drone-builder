import React from "react";

export interface ControlGaugeProps {
  control: {
    score: number;
    label: string;
    description: string;
  };
}

export default function ControlGauge({ control }: ControlGaugeProps) {
  const score = control?.score || 0;
  const label = control?.label || "Unflyable";
  const description = control?.description || "Incomplete components.";

  const radius = 50;
  const strokeWidth = 6;
  const circ = Math.PI * radius;
  
  const percent = score / 100;
  const strokeOffset = circ - percent * circ;

  let badgeColor = "text-slate-400 bg-slate-950/40 border-slate-800/30";

  switch (label) {
    case "Sluggish":
      badgeColor = "text-slate-400 bg-slate-900/40 border-slate-800/30";
      break;
    case "Drifty":
      badgeColor = "text-amber-400 bg-amber-950/40 border-amber-800/30";
      break;
    case "Cinematic":
      badgeColor = "text-blue-400 bg-blue-950/40 border-blue-800/30";
      break;
    case "Freestyle":
      badgeColor = "text-emerald-400 bg-emerald-950/40 border-emerald-800/30";
      break;
    case "Racing":
      badgeColor = "text-cyan-400 bg-cyan-950/40 border-cyan-800/30";
      break;
    case "Ultra-Agile":
      badgeColor = "text-purple-400 bg-purple-950/40 border-purple-800/30 font-black animate-pulse";
      break;
  }

  return (
    <div 
      className="bg-slate-900/30 backdrop-blur-md border border-slate-900 hover:border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden h-44 select-none transition-all duration-300 group"
      title={description}
    >
      <div className="absolute top-3 left-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
        Flight Control & Feel
      </div>

      <div className="relative w-36 h-20 mt-6 flex items-center justify-center">
        {/* SVG Circular Gauge */}
        <svg className="w-full h-full" viewBox="0 0 120 60">
          <defs>
            <linearGradient id="controlGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" /> {/* orange-550 */}
              <stop offset="35%" stopColor="#eab308" /> {/* yellow-500 */}
              <stop offset="65%" stopColor="#10b981" /> {/* emerald-500 */}
              <stop offset="100%" stopColor="#ec4899" /> {/* pink-500 */}
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
            stroke="url(#controlGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Readout in center of arc */}
        <div className="absolute bottom-0 flex flex-col items-center justify-center">
          {/* Label displays names like Freestyle, Racing etc */}
          <span className="text-2xl font-black tracking-tight text-white leading-none group-hover:opacity-0 transition-opacity duration-300">
            {label}
          </span>
          <span className="text-[10px] text-slate-400 font-bold mt-1 group-hover:opacity-0 transition-opacity duration-300">
            Agility Index: {score}
          </span>

          {/* Hover description text overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none w-32">
            <span className="text-[8px] font-semibold text-slate-300 leading-snug line-clamp-3">
              {description}
            </span>
          </div>
        </div>
      </div>

      <span className={`px-2.5 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-full ${badgeColor}`}>
        {label} Feel
      </span>
    </div>
  );
}
