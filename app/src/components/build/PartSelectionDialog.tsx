"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Search, Plus, Check, AlertTriangle, X, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { runAllValidations } from "@/lib/engineering/validation";
import { calcAUW } from "@/lib/engineering/auw";
import { SUB_CATEGORIES, MAIN_CATEGORIES } from "@/db/schema";

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

interface CustomPart {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  weightGrams: number;
  mainCategory: string;
  subCategory: string;
  keySpecs: any;
  isComposite: boolean;
}

interface PartSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  slot: string;
  subCategory: string;
  currentComponents: any[];
  customPayloadWeightGrams: number;
  onSelectPart: (part: any, isCustom: boolean) => void;
}

export default function PartSelectionDialog({
  isOpen,
  onClose,
  slot,
  subCategory,
  currentComponents,
  customPayloadWeightGrams,
  onSelectPart,
}: PartSelectionDialogProps) {
  const [activeTab, setActiveTab] = useState<"search" | "custom">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);

  // Custom Part Form State
  const [customName, setCustomName] = useState("");
  const [customManufacturer, setCustomManufacturer] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customWeight, setCustomWeight] = useState("");
  const [customIsComposite, setCustomIsComposite] = useState(false);
  const [customSpecs, setCustomSpecs] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Load parts matching subCategory
  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    fetch(`/api/v1/parts?subCategory=${subCategory}&limit=100`)
      .then((res) => res.json())
      .then((resBody) => {
        if (resBody.data) {
          setParts(resBody.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load parts", err);
        toast.error("Error loading parts repository.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [subCategory, isOpen]);

  if (!isOpen) return null;

  // Filter parts locally by search query
  const filteredParts = parts.filter((p) => {
    const term = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.manufacturer.toLowerCase().includes(term) ||
      p.model.toLowerCase().includes(term)
    );
  });

  // Evaluate compatibility relative to the active build
  const getCompatibilityBadge = (part: any) => {
    // Clone components list and substitute this candidate part
    const tempComponents = currentComponents.filter((c) => c.slot !== slot);
    tempComponents.push({
      slot,
      quantity: slot.startsWith("motor") || slot === "propeller" ? 4 : 1,
      part: part,
      customPart: null,
      partId: part.id,
      customPartId: null,
    });

    const simpleComps = tempComponents.map((bc) => ({
      weightGrams: bc.part?.weightGrams ?? bc.customPart?.weightGrams ?? 0,
      quantity: bc.quantity || 1,
    }));
    const tempAuw = calcAUW(simpleComps, customPayloadWeightGrams);
    
    // We run checks passing twr = 5.0 (neutral) for preview purposes
    const warnings = runAllValidations(tempComponents as any, tempAuw, 5.0);
    
    const errors = warnings.filter((w) => w.severity === "error");
    const alerts = warnings.filter((w) => w.severity === "warning");

    if (errors.length > 0) {
      return {
        status: "incompatible" as const,
        label: "⚠️ Conflict",
        color: "bg-rose-950/40 text-rose-400 border-rose-800/40",
        message: errors[0].message,
      };
    }
    if (alerts.length > 0) {
      return {
        status: "warning" as const,
        label: "⚠️ Caution",
        color: "bg-amber-950/40 text-amber-400 border-amber-800/40",
        message: alerts[0].message,
      };
    }
    return {
      status: "compatible" as const,
      label: "✅ Green",
      color: "bg-emerald-950/40 text-emerald-400 border-emerald-800/40",
      message: "Compatible with active build specifications.",
    };
  };

  // Render spec details based on subcategory
  const renderSpecsList = (attributes: any) => {
    if (!attributes) return null;
    const attrs = typeof attributes === "string" ? JSON.parse(attributes) : attributes;

    const items: string[] = [];
    if (subCategory === "FRAME") {
      if (attrs.wheelbaseMm) items.push(`Wheelbase: ${attrs.wheelbaseMm}mm`);
      if (attrs.maxPropSizeInch) items.push(`Max Prop: ${attrs.maxPropSizeInch}"`);
      if (attrs.fcMountingPattern?.length) items.push(`FC Mount: ${attrs.fcMountingPattern.join("/")}`);
      if (attrs.motorMountingPattern?.length) items.push(`Motor Mount: ${attrs.motorMountingPattern.join("/")}`);
    } else if (subCategory === "FC" || subCategory === "AIO") {
      if (attrs.mcu) items.push(`MCU: ${attrs.mcu}`);
      if (attrs.gyro) items.push(`Gyro: ${attrs.gyro}`);
      if (attrs.mountingPattern) items.push(`Mount: ${attrs.mountingPattern}mm`);
      if (attrs.inputVoltagesMax) items.push(`Max Battery: ${attrs.inputVoltagesMax}S`);
      if (attrs.hasBec) items.push("BEC: Yes");
    } else if (subCategory === "ESC") {
      if (attrs.continuousCurrentAmps) items.push(`Continuous: ${attrs.continuousCurrentAmps}A`);
      if (attrs.inputVoltagesMax) items.push(`Max Battery: ${attrs.inputVoltagesMax}S`);
      if (attrs.mountingPattern) items.push(`Mount: ${attrs.mountingPattern}mm`);
      if (attrs.firmware) items.push(`Firmware: ${attrs.firmware}`);
    } else if (subCategory === "MOTOR") {
      if (attrs.kv) items.push(`KV: ${attrs.kv}`);
      if (attrs.statorDiameterMm && attrs.statorHeightMm) items.push(`Size: ${attrs.statorDiameterMm}x${attrs.statorHeightMm}`);
      if (attrs.mountingPattern) items.push(`Mount: ${attrs.mountingPattern}`);
      if (attrs.propMountingPattern?.length) items.push(`Prop Shaft: ${attrs.propMountingPattern.join("/")}`);
    } else if (subCategory === "PROPELLER") {
      if (attrs.diameterInch) items.push(`Dia: ${attrs.diameterInch}"`);
      if (attrs.pitchInch) items.push(`Pitch: ${attrs.pitchInch}"`);
      if (attrs.blades) items.push(`Blades: ${attrs.blades}`);
      if (attrs.mountingPattern?.length) items.push(`Mount: ${attrs.mountingPattern.join("/")}`);
    } else if (subCategory === "BATTERY") {
      if (attrs.cellCount) items.push(`Cells: ${attrs.cellCount}S`);
      if (attrs.capacityMah) items.push(`Capacity: ${attrs.capacityMah}mAh`);
      if (attrs.cRating) items.push(`C-Rating: ${attrs.cRating}C`);
      if (attrs.chemistry) items.push(`Chem: ${attrs.chemistry}`);
    } else if (subCategory === "VTX") {
      if (attrs.maxPowerMw) items.push(`Max Power: ${attrs.maxPowerMw}mW`);
      if (attrs.inputVoltageMin && attrs.inputVoltageMax) items.push(`Volts: ${attrs.inputVoltageMin}-${attrs.inputVoltageMax}V`);
    }

    if (items.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1 text-[10px] text-slate-400 font-medium">
        {items.map((it, idx) => (
          <span key={idx} className="bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/40">
            {it}
          </span>
        ))}
      </div>
    );
  };

  // Submit custom part
  const handleCreateCustomPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName || !customWeight) {
      toast.error("Name and Weight are required.");
      return;
    }

    setSavingCustom(true);

    // Map slot to main category
    let mainCategory = "OTHER";
    if (subCategory === "FRAME") mainCategory = "FRAME";
    else if (["FC", "ESC", "AIO", "VTX", "CAMERA", "RC_RECEIVER", "GPS"].includes(subCategory)) mainCategory = "ELECTRONICS";
    else if (["MOTOR", "PROPELLER", "BATTERY"].includes(subCategory)) mainCategory = "PROPULSION";
    else if (["BATTERY_STRAP", "ANTENNA", "BUZZER", "LED"].includes(subCategory)) mainCategory = "ACCESSORIES";

    try {
      const response = await fetch("/api/v1/custom-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName,
          manufacturer: customManufacturer || "Custom",
          model: customModel || "Generic",
          weightGrams: parseFloat(customWeight),
          mainCategory,
          subCategory,
          keySpecs: customSpecs,
          isComposite: customIsComposite,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create custom part.");
      }

      const res = await response.json();
      toast.success("Custom part linked to slot successfully!");
      onSelectPart(res.data, true);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error creating custom part.");
    } finally {
      setSavingCustom(false);
    }
  };

  const handleSpecChange = (key: string, value: string) => {
    setCustomSpecs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl relative glow-cyan flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black tracking-wider uppercase text-white flex items-center gap-2">
              <Settings2 className="w-4.5 h-4.5 text-cyan-400" />
              Slot Config: {slot.replace("_", " ")}
            </h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
              Category: {subCategory.replace("_", " ")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-850 px-4">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
              activeTab === "search"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Search Hangar Parts
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
              activeTab === "custom"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Deploy Custom Part
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {activeTab === "search" ? (
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter parts by name, manufacturer, model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
                />
              </div>

              {/* Part list */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <span className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Syncing database...</span>
                </div>
              ) : filteredParts.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                  No compatible parts found. Consider adding a custom part!
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredParts.map((part) => {
                    const badge = getCompatibilityBadge(part);
                    return (
                      <div
                        key={part.id}
                        onClick={() => {
                          onSelectPart(part, false);
                          onClose();
                        }}
                        className="p-3.5 bg-slate-900/30 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/60 rounded-xl transition cursor-pointer flex justify-between items-start gap-4 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                              {part.manufacturer}
                            </span>
                            <span className="h-1 w-1 bg-slate-700 rounded-full" />
                            <span className="text-[10px] font-semibold text-slate-400">
                              {part.weightGrams}g
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition truncate mt-0.5">
                            {part.name}
                          </h4>
                          {renderSpecsList(part.attributes)}
                        </div>

                        {/* Compatibility indicator */}
                        <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border rounded-full ${badge.color}`}
                            title={badge.message}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[8px] text-slate-500 max-w-[150px] truncate hidden md:block">
                            {badge.message}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Custom Part Form */
            <form onSubmit={handleCreateCustomPart} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Part Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Custom Arm"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Weight (g) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 12.5"
                    value={customWeight}
                    onChange={(e) => setCustomWeight(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Custom Forge"
                    value={customManufacturer}
                    onChange={(e) => setCustomManufacturer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Model / Version
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. V1"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>

              {/* Specs Fields tailored by SubCategory */}
              <div className="border-t border-slate-850 pt-4">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-3">
                  Category Specs Input
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  {subCategory === "FRAME" && (
                    <>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Max Prop Size (inch)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 5.1"
                          onChange={(e) => handleSpecChange("maxPropSizeInch", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">FC Mounting Pattern</label>
                        <input
                          type="text"
                          placeholder="e.g. 20x20, 30.5x30.5"
                          onChange={(e) => handleSpecChange("fcMountingPattern", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Motor Mounting Pattern</label>
                        <input
                          type="text"
                          placeholder="e.g. 16x16, 12x12"
                          onChange={(e) => handleSpecChange("motorMountingPattern", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  {(subCategory === "FC" || subCategory === "AIO") && (
                    <>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Mounting Pattern</label>
                        <input
                          type="text"
                          placeholder="e.g. 30.5x30.5"
                          onChange={(e) => handleSpecChange("mountingPattern", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Max Input Volts (S cells)</label>
                        <input
                          type="number"
                          placeholder="e.g. 6"
                          onChange={(e) => handleSpecChange("inputVoltagesMax", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2 col-span-2">
                        <input
                          type="checkbox"
                          id="customHasBec"
                          onChange={(e) => handleSpecChange("hasBec", e.target.checked ? "true" : "false")}
                          className="w-4 h-4 accent-cyan-500 rounded border-slate-800 bg-slate-950 focus:ring-cyan-500 cursor-pointer"
                        />
                        <label htmlFor="customHasBec" className="text-[10px] text-slate-400 font-bold uppercase tracking-wider cursor-pointer">
                          Includes Integrated BEC (safe VTX feed)
                        </label>
                      </div>
                    </>
                  )}

                  {subCategory === "ESC" && (
                    <>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Continuous Current (Amps)</label>
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          onChange={(e) => handleSpecChange("continuousCurrentAmps", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Mounting Pattern</label>
                        <input
                          type="text"
                          placeholder="e.g. 30.5x30.5"
                          onChange={(e) => handleSpecChange("mountingPattern", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Max Input Volts (S cells)</label>
                        <input
                          type="number"
                          placeholder="e.g. 6"
                          onChange={(e) => handleSpecChange("inputVoltagesMax", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  {subCategory === "MOTOR" && (
                    <>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">KV Rating</label>
                        <input
                          type="number"
                          placeholder="e.g. 1950"
                          onChange={(e) => handleSpecChange("kv", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Mounting Pattern</label>
                        <input
                          type="text"
                          placeholder="e.g. 16x16"
                          onChange={(e) => handleSpecChange("mountingPattern", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Prop Shaft Mounting</label>
                        <input
                          type="text"
                          placeholder="e.g. 5mm, 1.5mm"
                          onChange={(e) => handleSpecChange("propMountingPattern", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Max Current Draw (Amps)</label>
                        <input
                          type="number"
                          placeholder="e.g. 45"
                          onChange={(e) => handleSpecChange("maxCurrentDraw", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  {subCategory === "PROPELLER" && (
                    <>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Diameter (inch)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 5.1"
                          onChange={(e) => handleSpecChange("diameterInch", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Pitch (inch)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 4.3"
                          onChange={(e) => handleSpecChange("pitchInch", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Blades</label>
                        <input
                          type="number"
                          placeholder="e.g. 3"
                          onChange={(e) => handleSpecChange("blades", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Mounting Pattern</label>
                        <input
                          type="text"
                          placeholder="e.g. 5mm"
                          onChange={(e) => handleSpecChange("mountingPattern", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  {subCategory === "BATTERY" && (
                    <>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Cell Count (S)</label>
                        <input
                          type="number"
                          placeholder="e.g. 6"
                          onChange={(e) => handleSpecChange("cellCount", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Chemistry</label>
                        <select
                          onChange={(e) => handleSpecChange("chemistry", e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-slate-300"
                        >
                          <option value="LiPo">LiPo</option>
                          <option value="LiHv">LiHv</option>
                          <option value="LiIon">LiIon</option>
                        </select>
                      </div>
                    </>
                  )}

                  {subCategory === "VTX" && (
                    <>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Min Input Voltage</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 7.0"
                          onChange={(e) => handleSpecChange("inputVoltageMin", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Max Input Voltage</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 26.0"
                          onChange={(e) => handleSpecChange("inputVoltageMax", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Composite part */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="customIsComposite"
                  checked={customIsComposite}
                  onChange={(e) => setCustomIsComposite(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded border-slate-800 bg-slate-950 focus:ring-cyan-500"
                />
                <label htmlFor="customIsComposite" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Is Composite Part (e.g. All-In-One Board)
                </label>
              </div>

              {/* Submit button */}
              <div className="border-t border-slate-850 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustom}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/10 transition cursor-pointer"
                >
                  {savingCustom ? "Fusing Part..." : "Save & Mount Part"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
