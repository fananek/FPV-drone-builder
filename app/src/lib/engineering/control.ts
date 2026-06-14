/**
 * Calculates a flight agility/control responsiveness score and outputs its classification.
 */
export interface ControlFeel {
  score: number;
  label: string;
  description: string;
}

export function calcControlFeel(
  twr: number,
  wheelbaseMm: number,
  propBlades: number
): ControlFeel {
  const twrVal = twr || 0;
  const wb = wheelbaseMm || 220; // Default to standard 5-inch wheelbase (220mm)
  const blades = propBlades || 3;

  if (twrVal <= 1.0) {
    return {
      score: 0,
      label: "Unflyable",
      description: "Thrust is equal to or less than weight. The drone cannot hover or lift off.",
    };
  }

  // Agility Score = (TWR * 7) + (250 - Wheelbase) * 0.15 + (Blades * 3)
  const agilityScore = (twrVal * 7) + (250 - wb) * 0.15 + (blades * 3);
  const score = Math.min(99, Math.max(5, Math.round(agilityScore)));

  let label = "";
  let description = "";

  if (score < 35) {
    label = "Sluggish";
    description = "Stable and heavy. Prioritizes payload and smooth, straight-line flights over quick acro maneuvers.";
  } else if (score >= 35 && score < 50) {
    label = "Drifty";
    description = "Easy to guide and control, but slides wide in tight turns. Best for slow, indoor micro paths.";
  } else if (score >= 50 && score < 65) {
    label = "Cinematic";
    description = "Dampened inputs, very stable. Excellent for carrying HD cameras and tracking smooth sweeps.";
  } else if (score >= 65 && score < 82) {
    label = "Freestyle";
    description = "High agility and snappy recovery. Balanced power-to-weight, perfect for acro flips, snaps, and dives.";
  } else if (score >= 82 && score < 93) {
    label = "Racing";
    description = "Speed-focused, tracks lines like a bullet on rails. Less floaty than freestyle, extremely locked-in.";
  } else {
    label = "Ultra-Agile";
    description = "Instantaneous reaction, extreme thrust acceleration. Snappy and touchy; demands expert pilot inputs.";
  }

  return { score, label, description };
}
