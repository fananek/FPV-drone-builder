import React from "react";

export interface FlightTimeBarsProps {
  flightTimes: {
    hover: number;
    freestyle: number;
    racing: number;
  };
}

export default function FlightTimeBars({ flightTimes }: FlightTimeBarsProps) {
  // Format minutes (e.g., 5.75) to "5m 45s"
  const formatTime = (minutes: number) => {
    if (isNaN(minutes) || minutes <= 0) return "0s";
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Find max flight time to scale the progress bars (min scale 10 minutes)
  const maxTime = Math.max(10, flightTimes.hover, flightTimes.freestyle, flightTimes.racing);

  const profiles = [
    {
      name: "Hovering / Cruise",
      value: flightTimes.hover,
      color: "from-cyan-500 to-emerald-400",
      description: "Low-throttle indoor flight or static photogrammetry.",
    },
    {
      name: "Freestyle / Acro",
      value: flightTimes.freestyle,
      color: "from-blue-500 to-indigo-400",
      description: "Moderate throttle, aggressive flips, rolls, and punches.",
    },
    {
      name: "Full Racing / Hard Thrash",
      value: flightTimes.racing,
      color: "from-amber-500 to-rose-500",
      description: "Sustained high throttle. Heavy sag. Depletes pack rapidly.",
    },
  ];

  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-5 rounded-2xl flex flex-col relative overflow-hidden select-none">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
        Estimated Flight Times
      </div>

      <div className="flex flex-col gap-5">
        {profiles.map((profile, index) => {
          const percent = Math.min(100, (profile.value / maxTime) * 100);
          return (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-300">{profile.name}</span>
                <span className="text-sm font-black text-white">{formatTime(profile.value)}</span>
              </div>
              
              {/* Progress Bar Container */}
              <div className="relative w-full h-3 bg-slate-950 border border-slate-900 rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${profile.color}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-500 leading-normal">{profile.description}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
