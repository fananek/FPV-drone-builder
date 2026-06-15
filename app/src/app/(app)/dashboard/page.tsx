"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FolderPlus,
  Compass,
  ArrowLeft,
  Trash2,
  Share2,
  Download,
  Settings,
  Sparkles,
  Search,
  Eye,
  Plus,
  Play,
  Hexagon,
  Cpu,
  Zap,
  RotateCw,
  Fan,
  Battery,
  Tv,
  Camera,
  Radio,
  Upload,
  ImageOff
} from "lucide-react";
import { toast } from "sonner";
import { useBuildMetrics } from "@/hooks/useBuildMetrics";
import { useAutoSave } from "@/hooks/useAutoSave";
import MetricsDashboard from "@/components/dashboard/MetricsDashboard";
import PartSelectionDialog from "@/components/build/PartSelectionDialog";
import AIAdvisorSidebar from "@/components/build/AIAdvisorSidebar";

interface Build {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  tags: string[];
  customPayloadWeightGrams: number;
  averageRating: number | null;
  ratingCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  imageUrl?: string | null;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const activeId = searchParams.get("id");
  const isNewRequested = searchParams.get("new") === "true";

  // Hangar state
  const [buildsList, setBuildsList] = useState<Build[]>([]);
  const [loadingHangar, setLoadingHangar] = useState(true);
  const [allExistingTags, setAllExistingTags] = useState<string[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);

  // Active Editor state
  const [activeBuild, setActiveBuild] = useState<Build | null>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loadingEditor, setLoadingEditor] = useState(false);

  // Part Selector modal state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSlot, setSelectorSlot] = useState("");
  const [selectorSubCategory, setSelectorSubCategory] = useState("");

  const isAnonymous = !session || !session.user;
  const isLimitReached = isAnonymous && buildsList.length >= 3;

  // Load Hangar
  const loadHangar = async (includeDeleted: boolean = showDeleted) => {
    setLoadingHangar(true);
    try {
      const res = await fetch(`/api/v1/builds?includeDeleted=${includeDeleted}`);
      if (!res.ok) throw new Error("Failed to fetch builds");
      const body = await res.json();
      const list = body.data || [];
      setBuildsList(list);

      // Extract unique tags
      const tagsSet = new Set<string>();
      list.forEach((b: any) => {
        if (b.tags && Array.isArray(b.tags)) {
          b.tags.forEach((t: string) => tagsSet.add(t));
        }
      });
      setAllExistingTags(Array.from(tagsSet));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load hangar builds.");
    } finally {
      setLoadingHangar(false);
    }
  };

  useEffect(() => {
    loadHangar(showDeleted);
  }, [showDeleted]);

  // Handle auto-triggering a new build
  useEffect(() => {
    if (isNewRequested) {
      handleCreateBlankBuild();
    }
  }, [isNewRequested]);

  // Load active build details in Editor
  useEffect(() => {
    if (!activeId) {
      setActiveBuild(null);
      setComponents([]);
      return;
    }

    setLoadingEditor(true);
    fetch(`/api/v1/builds/${activeId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Build not found");
        return res.json();
      })
      .then((body) => {
        if (body.data) {
          setActiveBuild(body.data.build);
          // Map backend components format to editor slot components list
          setComponents(
            body.data.components.map((c: any) => ({
              slot: c.slot,
              quantity: c.quantity,
              partId: c.part?.id || null,
              customPartId: c.customPart?.id || null,
              part: c.part,
              customPart: c.customPart,
              customNotes: c.customNotes,
            }))
          );
          setWarnings(body.data.warnings || []);
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load active build.");
        router.push("/dashboard");
      })
      .finally(() => {
        setLoadingEditor(false);
      });
  }, [activeId, router]);

  // Setup flight metrics calculations hook
  const payloadWeight = activeBuild?.customPayloadWeightGrams ?? 0;
  const { metrics, loading: calculatingMetrics, error: metricsError } = useBuildMetrics(
    components,
    payloadWeight
  );

  // Setup auto-save hook
  const { saveStatus } = useAutoSave(
    activeBuild ? (activeId || "") : "",
    {
      name: activeBuild?.name || "",
      description: activeBuild?.description || "",
      isPublic: activeBuild?.isPublic || false,
      tags: activeBuild?.tags || [],
      customPayloadWeightGrams: payloadWeight,
      version: activeBuild?.version || 1,
      imageUrl: activeBuild?.imageUrl || null,
      components,
    },
    (updatedBuild) => {
      // On save success, update local version to match server
      setActiveBuild((prev) => (prev ? { ...prev, version: updatedBuild.version } : null));
    },
    (latestBuild: Build) => {
      // On conflict, reload build state
      toast.warning("Reloading latest telemetry data...");
      setActiveBuild(latestBuild);
    }
  );

  // Create new blank build
  const handleCreateBlankBuild = async () => {
    if (isLimitReached) {
      toast.warning("Anonymous limit reached. Please register to configure more builds.");
      return;
    }
    try {
      const res = await fetch("/api/v1/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Custom FPV Build #${Math.floor(100 + Math.random() * 900)}`,
          description: "Free-form custom configuration",
          tags: ["custom"],
          isPublic: false,
          customPayloadWeightGrams: 0,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error?.message || "Failed to create build");
      }
      const body = await res.json();
      toast.success("New project deck initialized.");
      router.push(`/dashboard?id=${body.data.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error creating blank build.");
    }
  };

  // Delete build
  const handleDeleteBuild = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this build? Once confirmed, it will be soft-deleted and can be recovered within 30 days before permanent deletion.")) return;

    try {
      const res = await fetch(`/api/v1/builds/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Build soft-deleted. It can be recovered within 30 days.");
      if (activeId === id) {
        router.push("/dashboard");
      } else {
        loadHangar();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting build.");
    }
  };

  // Recover build
  const handleRecoverBuild = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/builds/${id}/recover`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to recover build.");
      }
      toast.success("Build recovered successfully and restored to hangar.");
      loadHangar();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error recovering build.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File is too large. Choose an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const targetWidth = 400;
        const targetHeight = 300;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const width = img.width;
        const height = img.height;
        const imgRatio = width / height;
        const targetRatio = targetWidth / targetHeight;
        let sx = 0, sy = 0, sWidth = width, sHeight = height;

        if (imgRatio > targetRatio) {
          sWidth = height * targetRatio;
          sx = (width - sWidth) / 2;
        } else {
          sHeight = width / targetRatio;
          sy = (height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        const base64 = canvas.toDataURL("image/jpeg", 0.85);
        setActiveBuild((prev) => (prev ? { ...prev, imageUrl: base64 } : null));
        toast.success("Build image uploaded and updated!");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Slot handler updates
  const handleSlotSelectPart = (part: any, isCustom: boolean) => {
    setComponents((prev) => {
      const updated = prev.filter((c) => c.slot !== selectorSlot);
      updated.push({
        slot: selectorSlot,
        quantity: selectorSlot.startsWith("motor") || selectorSlot === "propeller" ? 4 : 1,
        partId: isCustom ? null : part.id,
        customPartId: isCustom ? part.id : null,
        part: isCustom ? null : part,
        customPart: isCustom ? part : null,
      });

      // Composite rules: if choosing AIO in FC slot, occupy and lock ESC slot
      if (selectorSlot === "fc" && (part.subCategory === "AIO" || part.isComposite)) {
        // Remove individual ESC
        const filtered = updated.filter((c) => c.slot !== "esc");
        filtered.push({
          slot: "esc",
          quantity: 1,
          partId: isCustom ? null : part.id,
          customPartId: isCustom ? part.id : null,
          part: isCustom ? null : part,
          customPart: isCustom ? part : null,
        });
        return filtered;
      }

      return updated;
    });
  };

  const handleClearSlot = (slotName: string) => {
    setComponents((prev) => {
      const updated = prev.filter((c) => c.slot !== slotName);
      // If we clear AIO from FC slot, also unlock and clear ESC slot
      if (slotName === "fc") {
        const hasAio = prev.some((c) => c.slot === "fc" && (c.part?.subCategory === "AIO" || c.customPart?.subCategory === "AIO"));
        if (hasAio) {
          return updated.filter((c) => c.slot !== "esc");
        }
      }
      return updated;
    });
  };

  // Check if AIO is active to lock slots
  const activeAioComp = components.find(
    (c) => c.part?.subCategory === "AIO" || c.customPart?.subCategory === "AIO"
  );
  const isEscSlotLocked = !!activeAioComp;

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

  // Render slot row
  const renderSlotRow = (label: string, slotName: string, subCat: string) => {
    const comp = components.find((c) => c.slot === slotName);
    const resolvedPart = comp?.part || comp?.customPart;
    const isLocked = slotName === "esc" && isEscSlotLocked;
    const IconComponent = SLOT_ICONS[slotName] || Hexagon;

    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-900/20 border border-slate-900 rounded-xl gap-4 hover:border-slate-800 transition duration-350">
        {/* Slot descriptor */}
        <div className="w-full md:w-1/4 flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 group-hover:border-cyan-500/30 rounded-xl text-slate-450 shrink-0 shadow-lg transition duration-300">
            <IconComponent className="w-5.5 h-5.5 text-cyan-400" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block">
              Slot Config
            </span>
            <span className="text-xs font-bold text-white uppercase">{label}</span>
            {isLocked && (
              <span className="inline-block px-1.5 py-0.5 bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 text-[8px] font-black uppercase rounded tracking-wider mt-1">
                Integrated AIO
              </span>
            )}
          </div>
        </div>

        {/* Selected part view */}
        <div className="flex-1 min-w-0">
          {isLocked ? (
            <div className="text-xs font-medium text-slate-400">
              {activeAioComp?.part?.name || activeAioComp?.customPart?.name} (Shared stack logic)
            </div>
          ) : resolvedPart ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black text-cyan-400">
                  {resolvedPart.manufacturer}
                </span>
                <span className="h-1 w-1 bg-slate-700 rounded-full" />
                <span className="text-[10px] text-slate-400 font-medium">
                  {resolvedPart.weightGrams}g
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate">{resolvedPart.name}</div>
            </div>
          ) : (
            <div className="text-xs text-slate-600 font-bold uppercase tracking-wider select-none">
              Empty Payload
            </div>
          )}
        </div>

        {/* Action button */}
        {!isLocked && (
          <div className="flex items-center gap-2 self-end md:self-auto">
            {resolvedPart && (
              <button
                onClick={() => handleClearSlot(slotName)}
                className="p-2 text-slate-500 hover:text-rose-400 bg-slate-950/40 border border-slate-900 hover:border-rose-950 rounded-xl transition cursor-pointer"
                title="Dismount Part"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setSelectorSlot(slotName);
                setSelectorSubCategory(subCat);
                setSelectorOpen(true);
              }}
              className="px-4 py-2 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase rounded-xl tracking-wider transition cursor-pointer"
            >
              {resolvedPart ? "Reconfigure" : "Mount Part"}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Export JSON
  const handleExportJson = () => {
    if (!activeBuild) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ build: activeBuild, components }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activeBuild.name.replace(/\s+/g, "_")}_build.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("JSON deck exported successfully.");
  };

  // PDF print export trigger
  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen p-6 relative">
      {/* Editor View */}
      {activeId && activeBuild ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Main workspace pane */}
          <div className="xl:col-span-8 flex flex-col gap-5 print:w-full print:border-0">
            {/* Navigation top bar */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 print:hidden">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Hangar Deck
              </button>

              <div className="flex items-center gap-2">
                {/* Save status badge */}
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-2">
                  Uplink:{" "}
                  <span
                    className={
                      saveStatus === "saved"
                        ? "text-emerald-400"
                        : saveStatus === "saving"
                        ? "text-cyan-400 animate-pulse"
                        : "text-amber-400 animate-pulse"
                    }
                  >
                    {saveStatus}
                  </span>
                </span>
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
                <button
                  onClick={(e) => handleDeleteBuild(activeBuild.id, e as any)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-rose-950/60 hover:text-rose-450 text-slate-400 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  title="Delete Build"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  Delete Build
                </button>
              </div>
            </div>

            {/* Editable metadata pane */}
            <div className="p-6 bg-slate-900/30 backdrop-blur-md border border-slate-900 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                {/* Build Image Slot */}
                <div className="relative group shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden cursor-pointer hover:border-cyan-500/50 transition duration-300 shadow-xl">
                  {activeBuild.imageUrl ? (
                    <img src={activeBuild.imageUrl} alt={activeBuild.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-650 group-hover:text-cyan-500 transition duration-300">
                      <Camera className="w-8 h-8" />
                      <span className="text-[9px] font-bold uppercase tracking-wider mt-1.5">No Image</span>
                    </div>
                  )}
                  {/* Hover upload overlay */}
                  <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition duration-300">
                    <Upload className="w-5 h-5 text-cyan-400" />
                    <span className="text-[8px] font-black uppercase text-cyan-400 tracking-widest mt-1">Upload Photo</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>

                <div className="flex-1 w-full flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={activeBuild.name}
                      onChange={(e) =>
                        setActiveBuild((prev) => (prev ? { ...prev, name: e.target.value } : null))
                      }
                      placeholder="Provide build name..."
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-800 focus:border-cyan-500 text-lg font-black text-white outline-none py-1 transition"
                    />
                    <input
                      type="text"
                      value={activeBuild.description || ""}
                      onChange={(e) =>
                        setActiveBuild((prev) => (prev ? { ...prev, description: e.target.value } : null))
                      }
                      placeholder="Enter configuration notes..."
                      className="w-full bg-transparent text-xs text-slate-400 outline-none py-1 mt-1 placeholder-slate-600"
                    />
                  </div>

                  <div className="flex items-center gap-3 shrink-0 print:hidden">
                    {/* Public visibility toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Public share
                      </span>
                      <input
                        type="checkbox"
                        checked={activeBuild.isPublic}
                        onChange={(e) =>
                          setActiveBuild((prev) => (prev ? { ...prev, isPublic: e.target.checked } : null))
                        }
                        className="w-4 h-4 accent-cyan-500 rounded border-slate-800 bg-slate-950 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Tags and custom payload weights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-900/60 pt-4 print:hidden">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1.5">
                    Hangar Tags
                  </label>
                  <MultiValueTagInput
                    tags={activeBuild.tags || []}
                    onChange={(newTags) =>
                      setActiveBuild((prev) =>
                        prev ? { ...prev, tags: newTags } : null
                      )
                    }
                    allExistingTags={allExistingTags}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1.5">
                    Payload Weight (GoPro, mounts, etc. in grams)
                  </label>
                  <input
                    type="number"
                    value={activeBuild.customPayloadWeightGrams || ""}
                    onChange={(e) =>
                      setActiveBuild((prev) =>
                        prev
                          ? {
                              ...prev,
                              customPayloadWeightGrams: parseFloat(e.target.value) || 0,
                            }
                          : null
                      )
                    }
                    placeholder="e.g. 75"
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Slots Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2 px-1">
                Airframe Composition
              </span>

              {renderSlotRow("Carbon Fiber Frame", "frame", "FRAME")}
              {renderSlotRow("Flight Controller", "fc", "FC")}
              {renderSlotRow("Electronic Speed Controller", "esc", "ESC")}
              {renderSlotRow("Brushless Motors (x4)", "motor", "MOTOR")}
              {renderSlotRow("Propellers (x4)", "propeller", "PROPELLER")}
              {renderSlotRow("Lithium Battery Pack", "battery", "BATTERY")}
              {renderSlotRow("Video Transmitter (VTX)", "vtx", "VTX")}
              {renderSlotRow("FPV Camera", "camera", "CAMERA")}
              {renderSlotRow("RC Receiver (RX)", "rx", "RC_RECEIVER")}
              {renderSlotRow("GPS telemetry module", "gps", "GPS")}
            </div>
          </div>

          {/* Telemetry dashboard pane */}
          <div className="xl:col-span-4 flex flex-col gap-6 print:hidden">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
              Live Simulation Feed
            </span>
            <MetricsDashboard
              metrics={metrics}
              loading={calculatingMetrics}
              error={metricsError}
            />
          </div>

          {/* AI Advisor Chat sidebar */}
          <div className="print:hidden">
            <AIAdvisorSidebar
              buildState={{
                name: activeBuild.name,
                intent: activeBuild.tags?.join(", ") || "Custom Freestyle",
                frameSize: "5 inch",
                auw: metrics?.auw || 0,
                twr: metrics?.twr || 0,
                components,
                warnings: metrics?.warnings || [],
              }}
            />
          </div>

          {/* Selection Modal dialog */}
          <PartSelectionDialog
            isOpen={selectorOpen}
            onClose={() => setSelectorOpen(false)}
            slot={selectorSlot}
            subCategory={selectorSubCategory}
            currentComponents={components}
            customPayloadWeightGrams={payloadWeight}
            onSelectPart={handleSlotSelectPart}
          />
        </div>
      ) : (
        /* Hangar Grid view */
        <div className="max-w-6xl mx-auto flex flex-col gap-6 select-none">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-900 pb-5 gap-4">
            <div>
              <h1 className="text-xl font-black tracking-wider uppercase text-white">
                Pilot Hangar
              </h1>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
                Manage and audit your active custom builds
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-white transition mr-2 bg-slate-900/40 px-3 py-2 border border-slate-800 rounded-xl">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded border-slate-850 bg-slate-950 cursor-pointer"
                />
                Show Deleted Builds
              </label>
              <button
                onClick={() => {
                  if (isLimitReached) {
                    toast.warning("Anonymous limit reached. Please register to configure more builds.");
                  } else {
                    router.push("/wizard");
                  }
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/10 transition cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Launch Wizard
              </button>
              <button
                onClick={handleCreateBlankBuild}
                className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Assemble Custom
              </button>
            </div>
          </div>

          {isLimitReached && (
            <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold">⚠️ Anonymous Hangar Limit</span>
                <p className="text-slate-300 font-medium leading-relaxed">
                  You have reached the maximum allowance of 3 builds for anonymous sessions. Register or log in to build more drones and keep them saved.
                </p>
              </div>
              <button
                onClick={() => router.push("/register")}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer shrink-0 self-end sm:self-auto"
              >
                Register Pilot Account
              </button>
            </div>
          )}

          {loadingHangar ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-500">
              <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold uppercase tracking-widest">Syncing hangar decks...</span>
            </div>
          ) : buildsList.length === 0 ? (
            <div className="text-center py-24 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center p-6">
              <Compass className="w-10 h-10 stroke-1 text-slate-600 mb-3" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hangar is Empty</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed mt-1">
                No active drone configurations linked to your pilot credentials. Initiate your first project now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buildsList.map((build) => {
                const isSoftDeleted = !!build.deletedAt;

                return (
                  <div
                    key={build.id}
                    onClick={() => {
                      if (isSoftDeleted) {
                        toast.error("Please recover this build first to edit it.");
                        return;
                      }
                      router.push(`/dashboard?id=${build.id}`);
                    }}
                    className={`p-5 bg-slate-900/20 hover:bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-2xl shadow-xl transition cursor-pointer flex flex-col justify-between h-44 group relative overflow-hidden ${
                      isSoftDeleted ? "opacity-55 border-dashed border-rose-900/40" : ""
                    }`}
                  >
                    {/* Subtle hover background highlight */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition duration-300" />

                    <div className="flex gap-4 items-start">
                      {/* Thumbnail Image */}
                      <div className="shrink-0 w-16 h-16 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center overflow-hidden">
                        {build.imageUrl ? (
                          <img src={build.imageUrl} alt={build.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-700">
                            <Hexagon className="w-6 h-6 text-slate-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition truncate pr-4">
                            {build.name}
                          </h3>
                          {isSoftDeleted ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-rose-950/40 text-rose-450 border-rose-800/40 shrink-0">
                              Deleted
                            </span>
                          ) : (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                build.isPublic
                                  ? "bg-cyan-950/40 text-cyan-400 border-cyan-800/40"
                                  : "bg-slate-950/60 text-slate-500 border-slate-850"
                              }`}
                            >
                              {build.isPublic ? "Shared" : "Private"}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 font-medium leading-relaxed">
                          {build.description || "No description provided."}
                        </p>
                      </div>
                    </div>

                    <div>
                      {/* Tags list */}
                      {build.tags && build.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {build.tags.slice(0, 3).map((t, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-slate-950/60 text-slate-400 border border-slate-850/40 rounded text-[9px] font-semibold"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t border-slate-900/60 pt-3 mt-auto">
                        <span className="text-[9px] font-semibold text-slate-500">
                          Sync: {new Date(build.updatedAt).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isSoftDeleted ? (
                            <button
                              onClick={(e) => handleRecoverBuild(build.id, e)}
                              className="px-2.5 py-1.5 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900 hover:text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0"
                              title="Recover Build"
                            >
                              <RotateCw className="w-3 h-3" />
                              Recover
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/builds/${build.id}`);
                                }}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
                                  title="Preview Board"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteBuild(build.id, e)}
                                className="p-1.5 text-slate-400 hover:text-rose-450 rounded-lg hover:bg-slate-900 transition cursor-pointer"
                                title="Purge Build"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest font-sans">Syncing hangar decks...</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

interface MultiValueTagInputProps {
  tags: string[];
  onChange: (newTags: string[]) => void;
  allExistingTags: string[];
}

function MultiValueTagInput({
  tags,
  onChange,
  allExistingTags,
}: MultiValueTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const defaultSuggestions = ["freestyle", "cinematic", "racing", "longrange", "indoor"];

  const combinedSuggestions = Array.from(
    new Set([...defaultSuggestions, ...allExistingTags.map((t) => t.toLowerCase())])
  );

  const filteredSuggestions = combinedSuggestions.filter(
    (tag) =>
      tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(tag)
  );

  const addTag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase();
    if (cleanTag && !tags.includes(cleanTag)) {
      onChange([...tags, cleanTag]);
    }
    setInputValue("");
    setIsOpen(false);
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-950/60 border border-slate-800 rounded-xl focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition min-h-[38px]">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-semibold text-slate-350"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="text-slate-500 hover:text-rose-400 font-bold transition ml-0.5 text-xs focus:outline-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "e.g. freestyle, 5inch, 6s" : ""}
          className="flex-1 min-w-[80px] bg-transparent outline-none border-none text-xs text-white placeholder-slate-650 p-0 focus:ring-0 focus:border-transparent"
        />
      </div>

      {isOpen && inputValue && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-36 overflow-y-auto">
          {filteredSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
