"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Home,
  Trees,
  Video,
  Compass,
  Trophy,
  Zap,
  Activity,
  Check,
  Disc,
  FolderOpen,
  Hexagon,
  Cpu,
  RotateCw,
  Fan,
  Battery,
  Tv,
  Camera,
  Radio
} from "lucide-react";
import { toast } from "sonner";
import { useBuildMetrics } from "@/hooks/useBuildMetrics";
import AIAdvisorSidebar from "@/components/build/AIAdvisorSidebar";

interface Part {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  weightGrams: number;
  mainCategory: string;
  subCategory: string;
  attributes: any;
  isComposite: boolean;
}

const FLYING_STYLES = [
  { id: "Indoor", label: "Indoor Whoop", desc: "Tight spaces, micro racing, ducts for safety.", icon: Home },
  { id: "Outdoor Freestyle", label: "Freestyle & Acro", desc: "Acrobatic flips, raw power, durable carbon builds.", icon: Trees },
  { id: "Cinematic / Smooth", label: "Cinematic / CineWhoop", desc: "Buttery smooth sweeps, HD camera payloads, stable flights.", icon: Video },
  { id: "Long Range", label: "Long Range Explorer", desc: "GPS rescue, battery efficiency, cruising over horizons.", icon: Compass },
  { id: "Racing", label: "FPV Track Racing", desc: "Ultra-low latency, maximum speed, responsive handling.", icon: Trophy },
];

const SIZE_OPTIONS: Record<string, { label: string; scale: string; regNote?: boolean }[]> = {
  "Indoor": [
    { label: "Tiny Whoop 75 mm", scale: "75mm", regNote: true },
    { label: "2\" Micro Quad", scale: "2inch", regNote: true },
  ],
  "Outdoor Freestyle": [
    { label: "3-inch Mini freestyle", scale: "3inch" },
    { label: "5-inch Standard freestyle", scale: "5inch" },
    { label: "7-inch Heavy cruiser", scale: "7inch" },
  ],
  "Cinematic / Smooth": [
    { label: "3-inch CineWhoop (Ducted)", scale: "3cinewhoop", regNote: true },
    { label: "5-inch CineWhoop (ND mount)", scale: "5cinewhoop" },
  ],
  "Long Range": [
    { label: "5-inch Lightweight cruiser", scale: "5lr" },
    { label: "7-inch Mountain explorer", scale: "7lr" },
  ],
  "Racing": [
    { label: "5-inch Spec track racer", scale: "5racing" },
  ],
};

const ASSEMBLY_STEPS = [
  { slot: "frame", subCat: "FRAME", label: "Carbon Frame", icon: Hexagon },
  { slot: "fc", subCat: "FC", label: "Flight Controller (FC)", icon: Cpu },
  { slot: "esc", subCat: "ESC", label: "Speed Controller (ESC)", icon: Zap },
  { slot: "motor", subCat: "MOTOR", label: "Motors", icon: RotateCw },
  { slot: "propeller", subCat: "PROPELLER", label: "Propellers", icon: Fan },
  { slot: "battery", subCat: "BATTERY", label: "Battery Pack", icon: Battery },
  { slot: "vtx", subCat: "VTX", label: "Video Transmitter (VTX)", icon: Tv },
  { slot: "camera", subCat: "CAMERA", label: "Camera", icon: Camera },
];

export default function WizardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [existingBuildsCount, setExistingBuildsCount] = useState(0);

  useEffect(() => {
    // Load build count if session is unauthenticated
    if (!session || !session.user) {
      fetch("/api/v1/builds")
        .then((res) => res.json())
        .then((body) => {
          if (body.data) {
            setExistingBuildsCount(body.data.length);
          }
        })
        .catch((err) => console.error("Error loading builds count in wizard: ", err));
    }
  }, [session]);

  const isAnonymous = !session || !session.user;
  const isLimitReached = isAnonymous && existingBuildsCount >= 3;

  // Selections state
  const [flyingStyle, setFlyingStyle] = useState("");
  const [scale, setScale] = useState("");
  const [assemblyIndex, setAssemblyIndex] = useState(0);

  // Active build components state
  const [selectedParts, setSelectedParts] = useState<Record<string, Part>>({});
  
  // AI Recommendations cache
  const [recs, setRecs] = useState<{ part: Part; reasoning: string; score: number }[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Final review metadata
  const [buildName, setBuildName] = useState("");
  const [buildDesc, setBuildDesc] = useState("Assembled via Guided Wizard");
  const [savingBuild, setSavingBuild] = useState(false);

  // Map components list to calculate metrics
  const mappedComponents = Object.entries(selectedParts).map(([slotName, part]) => ({
    slot: slotName,
    quantity: slotName === "motor" || slotName === "propeller" ? 4 : 1,
    partId: part.id,
    part,
    customPart: null,
  }));

  const { metrics, loading: calculatingMetrics } = useBuildMetrics(mappedComponents, 0);

  // Set default build name when steps resolve
  useEffect(() => {
    if (flyingStyle && scale && !buildName) {
      setBuildName(`${flyingStyle} ${scale} build`);
    }
  }, [flyingStyle, scale, buildName]);

  // Load AI recommendations for Step 3 Assembly sub-step
  useEffect(() => {
    if (step !== 3) return;

    const currentStepConfig = ASSEMBLY_STEPS[assemblyIndex];
    if (!currentStepConfig) return;

    // AIO composite check: if FC slot has an AIO board, skip ESC step automatically
    if (currentStepConfig.slot === "esc") {
      const activeFc = selectedParts["fc"];
      if (activeFc && (activeFc.subCategory === "AIO" || activeFc.isComposite)) {
        // Automatically link the ESC slot to the AIO board and skip to next
        setSelectedParts((prev) => ({ ...prev, esc: activeFc }));
        toast.info("AIO Flight Controller selected: ESC slot automatically mapped.");
        setAssemblyIndex((prev) => prev + 1);
        return;
      }
    }

    setLoadingRecs(true);
    fetch("/api/v1/ai/wizard-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: flyingStyle,
        frameSize: scale,
        selectedComponents: selectedParts,
        targetSlot: currentStepConfig.subCat,
      }),
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.data?.recommendations) {
          setRecs(body.data.recommendations);
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch compatibility recommendations.");
      })
      .finally(() => {
        setLoadingRecs(false);
      });
  }, [step, assemblyIndex, flyingStyle, scale, selectedParts]);

  const handleSelectPart = (part: Part) => {
    const currentStepConfig = ASSEMBLY_STEPS[assemblyIndex];
    setSelectedParts((prev) => ({ ...prev, [currentStepConfig.slot]: part }));
    
    // Automatically advance to next assembly step or final step
    if (assemblyIndex < ASSEMBLY_STEPS.length - 1) {
      setAssemblyIndex((prev) => prev + 1);
    } else {
      setStep(4);
    }
  };

  const handleStepBack = () => {
    if (step === 3 && assemblyIndex > 0) {
      setAssemblyIndex((prev) => prev - 1);
    } else {
      setStep((prev) => Math.max(1, prev - 1));
    }
  };

  const handleSaveBuild = async () => {
    if (!buildName.trim()) {
      toast.error("Please provide a name for this build.");
      return;
    }

    setSavingBuild(true);
    try {
      const response = await fetch("/api/v1/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: buildName,
          description: buildDesc,
          tags: [flyingStyle.toLowerCase().replace(/\s+/g, ""), scale.toLowerCase().replace(/\s+/g, ""), "wizard"],
          isPublic: false,
          customPayloadWeightGrams: 0,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to save build");
      }

      const body = await response.json();
      const newBuildId = body.data.id;

      // Link selected components to the new build
      const componentsToInsert = Object.entries(selectedParts).map(([slot, part]) => ({
        slot,
        quantity: slot === "motor" || slot === "propeller" ? 4 : 1,
        partId: part.id,
      }));

      const patchResponse = await fetch(`/api/v1/builds/${newBuildId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1, // initial version
          components: componentsToInsert,
        }),
      });

      if (!patchResponse.ok) {
        throw new Error("Failed to link parts to build");
      }

      toast.success("Build deck successfully synchronized in Hangar.");
      router.push(`/dashboard?id=${newBuildId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error finalizing guided build assembly.");
    } finally {
      setSavingBuild(false);
    }
  };

  const currentStepConfig = ASSEMBLY_STEPS[assemblyIndex];

  return (
    <div className="min-h-screen p-6 flex flex-col items-center select-none max-w-4xl mx-auto relative">
      {/* Progress Header */}
      <div className="w-full mb-8 flex justify-between items-center print:hidden">
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-4.5 h-4.5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase text-white">Guided Build Wizard</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Step {step} of 4</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="hidden md:flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <span className={step >= 1 ? "text-cyan-400" : ""}>Intent</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step >= 2 ? "text-cyan-400" : ""}>Scale</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step >= 3 ? "text-cyan-400" : ""}>Assembly</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step >= 4 ? "text-cyan-400" : ""}>Review</span>
        </div>
      </div>

      {/* STEP 1: Intent & Flying Style */}
      {step === 1 && (
        <div className="w-full flex flex-col gap-6 animate-fade-in">
          <div className="text-center md:text-left">
            <h2 className="text-lg font-black tracking-wider uppercase text-white">Identify Your Mission Profile</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Select your primary flight envelope environment. This constraints mechanical weight classes and frames.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FLYING_STYLES.map((style) => {
              const Icon = style.icon;
              const isSelected = flyingStyle === style.id;
              return (
                <div
                  key={style.id}
                  onClick={() => {
                    setFlyingStyle(style.id);
                    setScale(""); // Reset scale selection
                    setStep(2);
                  }}
                  className={`p-5 bg-slate-900/20 border hover:bg-slate-900/40 rounded-2xl cursor-pointer transition flex items-start gap-4 ${
                    isSelected ? "border-cyan-500 shadow-lg shadow-cyan-500/5 bg-slate-900/40" : "border-slate-900"
                  }`}
                >
                  <div className={`p-3 rounded-xl border ${isSelected ? "bg-cyan-950/60 border-cyan-800 text-cyan-400" : "bg-slate-950/60 border-slate-900 text-slate-500"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase">{style.label}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">{style.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Scale & Size */}
      {step === 2 && (
        <div className="w-full flex flex-col gap-6 animate-fade-in">
          <div>
            <h2 className="text-lg font-black tracking-wider uppercase text-white">Choose Airframe Scale</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Select propeller size dimensions tailored to your flying style.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SIZE_OPTIONS[flyingStyle]?.map((opt) => {
              const isSelected = scale === opt.scale;
              return (
                <div
                  key={opt.scale}
                  onClick={() => {
                    setScale(opt.scale);
                    setStep(3);
                    setAssemblyIndex(0);
                  }}
                  className={`p-5 bg-slate-900/20 border hover:bg-slate-900/40 rounded-2xl cursor-pointer transition flex flex-col justify-between h-32 ${
                    isSelected ? "border-cyan-500 bg-slate-900/40" : "border-slate-900"
                  }`}
                >
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase">{opt.label}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Scale: {opt.scale}</p>
                  </div>
                  {opt.regNote && (
                    <span className="text-[9px] text-emerald-400 font-semibold leading-snug">
                      ℹ️ Sub-250g weight: avoids registration in many jurisdictions.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: Guided Assembly */}
      {step === 3 && currentStepConfig && (
        <div className="w-full flex flex-col gap-6 animate-fade-in">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">
                Assembly Sub-step: {assemblyIndex + 1} of {ASSEMBLY_STEPS.length}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">
                Active: {currentStepConfig.label}
              </span>
            </div>
            <h2 className="text-lg font-black tracking-wider uppercase text-white mt-1">
              Select {currentStepConfig.label}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Equip a part matching your build requirements. AI recommendations are sorted below.
            </p>
          </div>

          {loadingRecs ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold uppercase tracking-widest">Running telemetry simulation...</span>
            </div>
          ) : recs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
              No compatible parts found in active repository matching size limits.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {recs.map((rec, idx) => {
                const part = rec.part;
                const isTopPick = rec.score >= 3;
                return (
                  <div
                    key={part.id}
                    onClick={() => handleSelectPart(part)}
                    className="p-4 bg-slate-900/20 border border-slate-900 hover:border-cyan-500/50 hover:bg-slate-900/40 rounded-2xl cursor-pointer transition flex flex-col md:flex-row justify-between gap-4 relative overflow-hidden group"
                  >
                    {isTopPick && (
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-cyan-500 to-indigo-500" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isTopPick && (
                          <span className="px-1.5 py-0.5 bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 text-[8px] font-black uppercase rounded tracking-wider flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI Recommendation
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                          {part.manufacturer}
                        </span>
                        <span className="h-1 w-1 bg-slate-700 rounded-full" />
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {part.weightGrams}g
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition truncate mt-1">
                        {part.name}
                      </h4>
                      <p className="text-[11px] text-cyan-400/80 leading-relaxed font-semibold mt-1">
                        {rec.reasoning}
                      </p>
                    </div>

                    <button className="px-5 py-2.5 bg-slate-950/60 border border-slate-800 text-white font-bold text-xs uppercase rounded-xl tracking-wider hover:bg-slate-950 transition shrink-0 self-end md:self-auto cursor-pointer">
                      Equip Part
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Telemetry Review */}
      {step === 4 && (
        <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start animate-fade-in relative z-10">
          <div className="xl:col-span-7 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-black tracking-wider uppercase text-white">Assemble configuration</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your custom drone components are successfully linked. Audit safety limits and name your build.
              </p>
            </div>

            {isLimitReached && (
              <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-amber-400 font-medium">
                <div className="flex items-start gap-2.5">
                  <span>⚠️ Anonymous Limit Reached</span>
                  <p className="text-slate-300 font-medium">
                    You have reached the maximum allowance of 3 builds for anonymous sessions. Register or log in to save this build configuration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer shrink-0"
                >
                  Register Account
                </button>
              </div>
            )}

            {/* Inputs Form */}
            <div className="p-5 bg-slate-900/30 border border-slate-900 rounded-2xl space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">
                  Build Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indoor Whoop Cruiser"
                  value={buildName}
                  onChange={(e) => setBuildName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">
                  Description / Build Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Include flying requirements, batteries used, or special parts configurations..."
                  value={buildDesc}
                  onChange={(e) => setBuildDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                />
              </div>
            </div>

            {/* Assembled parts list list */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block px-1">
                Equipment Summary
              </span>
              {ASSEMBLY_STEPS.map((s) => {
                const part = selectedParts[s.slot];
                const IconComponent = s.icon;
                return (
                  <div key={s.slot} className="flex justify-between items-center p-3 bg-slate-900/10 border border-slate-900 rounded-xl text-xs hover:border-slate-800 transition duration-350">
                    <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider flex items-center gap-2">
                      <IconComponent className="w-3.5 h-3.5 text-cyan-400" />
                      {s.label}
                    </span>
                    <span className="font-bold text-white truncate max-w-[200px] md:max-w-xs">
                      {part ? `${part.manufacturer} ${part.model}` : "Not Selected"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Final CTA */}
            <button
              onClick={handleSaveBuild}
              disabled={savingBuild || !buildName.trim() || isLimitReached}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-black text-sm uppercase rounded-xl tracking-wider shadow-xl shadow-cyan-500/15 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {savingBuild ? (
                <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  Assemble in Hangar
                </>
              )}
            </button>
          </div>

          {/* Metrics dashboard dashboard */}
          <div className="xl:col-span-5 flex flex-col gap-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
              Safety Audit Telemetry
            </span>
            <div className="p-5 bg-slate-900/20 border border-slate-900 rounded-2xl space-y-4">
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-400">All-Up Weight</span>
                <span className="text-xs text-white font-bold">{(metrics?.auw || 0).toFixed(1)}g</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-400">Thrust-to-Weight</span>
                <span className="text-xs text-cyan-400 font-bold">{(metrics?.twr || 0).toFixed(2)}:1</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-400">Prop Tip Speed</span>
                <span className="text-xs text-white font-bold">{(metrics?.tipSpeedMach || 0).toFixed(2)} Mach ({((metrics?.tipSpeedMach || 0) * 343).toFixed(0)} m/s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Active Warnings</span>
                <span className="text-xs text-rose-400 font-bold">{metrics?.warnings?.length || 0}</span>
              </div>
            </div>

            {/* Warnings list summary */}
            {metrics?.warnings && metrics.warnings.length > 0 && (
              <div className="space-y-2">
                {metrics.warnings.slice(0, 3).map((w, idx) => (
                  <div key={idx} className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl flex gap-2 items-start">
                    <span className="px-1 py-0.5 bg-rose-950/40 text-rose-400 border border-rose-800/40 text-[8px] font-black uppercase rounded shrink-0">
                      {w.warningCode}
                    </span>
                    <p className="text-[11px] text-rose-400 leading-snug font-medium">{w.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Advisor Chat sidebar */}
          <AIAdvisorSidebar
            buildState={{
              name: buildName,
              intent: flyingStyle,
              frameSize: scale,
              auw: metrics?.auw || 0,
              twr: metrics?.twr || 0,
              components: mappedComponents,
              warnings: metrics?.warnings || [],
            }}
          />
        </div>
      )}

      {/* Footer Navigation Buttons */}
      <div className="w-full border-t border-slate-900 mt-8 pt-4 flex justify-between items-center print:hidden">
        {step > 1 ? (
          <button
            onClick={handleStepBack}
            className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        ) : (
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Hangar
          </button>
        )}

        {step < 3 && (
          <button
            onClick={() => setStep((prev) => prev + 1)}
            disabled={(step === 1 && !flyingStyle) || (step === 2 && !scale)}
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
