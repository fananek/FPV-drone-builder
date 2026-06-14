"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Download, Copy, MessageSquare, Send, Check, Hexagon, Cpu, Zap, RotateCw, Fan, Battery, Tv, Camera, Radio, Compass, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useBuildMetrics } from "@/hooks/useBuildMetrics";
import MetricsDashboard from "@/components/dashboard/MetricsDashboard";

interface ClientDetailsViewProps {
  build: any;
  components: any[];
  warnings: any[];
  ratings: any[];
  session: any;
}

export default function ClientDetailsView({
  build,
  components,
  warnings,
  ratings,
  session,
}: ClientDetailsViewProps) {
  const router = useRouter();

  // Ratings form state
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // Retrieve flight metrics client-side
  const { metrics, loading: calculatingMetrics, error: metricsError } = useBuildMetrics(
    components,
    build.customPayloadWeightGrams
  );

  const handleCloneBuild = async () => {
    toast.promise(
      fetch(`/api/v1/builds/${build.id}/clone`, { method: "POST" })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error?.message || "Failed to clone");
          }
          const body = await res.json();
          return body.build;
        }),
      {
        loading: "Cloning build to your hangar...",
        success: (cloned) => {
          router.push(`/dashboard?id=${cloned.id}`);
          return `Build cloned successfully! Opening on hangar deck.`;
        },
        error: (err: any) => err.message || "Error duplicating configuration.",
      }
    );
  };

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stars || submittingRating) return;

    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/v1/builds/${build.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, review }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit review.");
      }

      toast.success("Review logged. Telemetry database updated.");
      setReview("");
      router.refresh(); // Refresh Server Component data to load updated reviews list
    } catch (err) {
      console.error(err);
      toast.error("Error submitting rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ build, components }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${build.name.replace(/\s+/g, "_")}_build.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("JSON configuration exported.");
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto flex flex-col gap-6 select-none">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5 print:hidden">
        <button
          onClick={() => router.push("/gallery")}
          className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Gallery Deck
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCloneBuild}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/10 transition cursor-pointer flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Clone Configuration
          </button>
          <button
            onClick={handleExportJson}
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            title="Export JSON"
          >
            <Download className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={handleExportPdf}
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: Specs List */}
        <div className="xl:col-span-8 flex flex-col gap-6 print:w-full">
          {/* Metadata Card */}
          <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-2xl flex flex-col sm:flex-row gap-5 items-start">
            {/* Build Image Slot */}
            <div className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shadow-xl">
              {build.imageUrl ? (
                <img src={build.imageUrl} alt={build.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-700">
                  <ImageOff className="w-8 h-8 text-slate-650" />
                  <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5">No Image</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black text-white uppercase tracking-wider">{build.name}</h1>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-medium">
                {build.description || "No description provided."}
              </p>
              {build.tags && build.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4 print:hidden">
                  {build.tags.map((t: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 bg-slate-950/60 text-slate-400 border border-slate-850/40 rounded text-[9px] font-semibold"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Slots Table */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2 px-1">
              Configuration Specification
            </span>
            {components.map((comp) => {
              const part = comp.part || comp.customPart;
              
              // Map slots to Lucide Icons
              const SLOT_ICONS: Record<string, React.ComponentType<any>> = {
                frame: Hexagon,
                fc: Cpu,
                esc: Zap,
                motor: RotateCw,
                propeller: Fan,
                battery: Battery,
                vtx: Tv,
                camera: Camera,
                rx: Radio,
                gps: Compass,
              };
              
              const IconComponent = SLOT_ICONS[comp.slot] || Hexagon;
              
              return (
                <div key={comp.slot} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-900/10 border border-slate-900 rounded-xl gap-2 hover:border-slate-800 group transition duration-350">
                  <div className="w-full md:w-1/3 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 group-hover:border-cyan-500/30 rounded-xl text-slate-450 shrink-0 shadow-lg transition duration-300">
                      <IconComponent className="w-5.5 h-5.5 text-cyan-400" />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">Slot</span>
                      <span className="text-xs font-bold text-white uppercase">{comp.slot.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {part ? (
                      <div>
                        <div className="text-[10px] uppercase font-black text-cyan-400">
                          {part.manufacturer}
                        </div>
                        <div className="text-xs font-bold text-slate-300 truncate">{part.name}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Empty Payload</span>
                    )}
                  </div>
                  {part && (
                    <span className="text-[10px] font-bold text-slate-500 shrink-0 self-end md:self-auto">
                      {part.weightGrams}g
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reviews List and Submission */}
          <div className="border-t border-slate-900 pt-6 space-y-6 print:hidden">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block px-1">
              Pilot Reviews & Feedback
            </span>

            {/* Submit rating form */}
            {session ? (
              <form onSubmit={handleRateSubmit} className="p-5 bg-slate-900/20 border border-slate-900 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Score rating:
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setStars(star)}
                        className="p-1 hover:scale-110 transition cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= stars ? "fill-amber-500 text-amber-500" : "text-slate-600"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                    Written review (max 500 characters)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Provide performance feedback or configuration recommendations..."
                    className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingRating}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publish Rating
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center p-6 bg-slate-900/10 border border-slate-900 rounded-xl text-xs text-slate-500">
                You must be logged in to rate configurations.
              </div>
            )}

            {/* List */}
            {ratings.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-xs font-bold uppercase tracking-wider">
                No ratings logged yet. Be the first!
              </div>
            ) : (
              <div className="space-y-3">
                {ratings.map((rate) => (
                  <div key={rate.id} className="p-4 bg-slate-900/10 border border-slate-900/60 rounded-xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase text-white">
                          {rate.user?.name || "Telemetry Pilot"}
                        </span>
                        <span className="text-[8px] text-slate-500 block">
                          Sync: {new Date(rate.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= rate.stars ? "fill-amber-500 text-amber-500" : "text-slate-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {rate.review && (
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed font-medium">
                        {rate.review}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Telemetry Metrics */}
        <div className="xl:col-span-4 flex flex-col gap-6 print:hidden">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            Telemetry Audits
          </span>
          <MetricsDashboard
            metrics={metrics}
            loading={calculatingMetrics}
            error={metricsError}
          />
        </div>
      </div>
    </div>
  );
}
