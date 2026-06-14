"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Settings, Plus, ArrowLeft, Trash2, Edit, Check, EyeOff, Sparkles, Upload, Cpu, Zap, Hammer, Users } from "lucide-react";
import { toast } from "sonner";

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
  isArchived: boolean;
}

export default function AdminPartsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subCategoryFilter, setSubCategoryFilter] = useState("");

  // CRUD Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formName, setFormName] = useState("");
  const [formManufacturer, setFormManufacturer] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formWeight, setFormWeight] = useState("");
  const [formMainCat, setFormMainCat] = useState("FRAME");
  const [formSubCat, setFormSubCat] = useState("FRAME");
  const [formIsComposite, setFormIsComposite] = useState(false);
  const [formAttributes, setFormAttributes] = useState("");
  const [savingPart, setSavingPart] = useState(false);

  // CSV Bulk Import State
  const [csvText, setCsvText] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Check role clearance
  const roles = session?.user?.roles || [];
  const isAdmin = roles.includes("system_admin") || roles.includes("metadata_admin");

  const loadParts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/parts?limit=100&includeArchived=true");
      if (!res.ok) throw new Error("Failed to load parts");
      const body = await res.json();
      setParts(body.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Error reading parts archive.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && isAdmin) {
      loadParts();
    }
  }, [status, isAdmin, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest">Opening Secure Core...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 bg-rose-950/60 border border-rose-900/40 rounded-2xl flex items-center justify-center text-rose-500 mb-4">
          <EyeOff className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2">Security Clearance Denied</h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Access restricted. Your credentials do not hold required administrative privileges to modify parts index.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 text-xs text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider underline underline-offset-4 cursor-pointer"
        >
          Return to Hangar Deck
        </button>
      </div>
    );
  }

  // Open modal to add or edit
  const openModal = (part: Part | null = null) => {
    if (part) {
      setEditingPart(part);
      setFormName(part.name);
      setFormManufacturer(part.manufacturer);
      setFormModel(part.model);
      setFormWeight(part.weightGrams.toString());
      setFormMainCat(part.mainCategory);
      setFormSubCat(part.subCategory);
      setFormIsComposite(part.isComposite);
      setFormAttributes(JSON.stringify(part.attributes, null, 2));
    } else {
      setEditingPart(null);
      setFormName("");
      setFormManufacturer("");
      setFormModel("");
      setFormWeight("");
      setFormMainCat("FRAME");
      setFormSubCat("FRAME");
      setFormIsComposite(false);
      setFormAttributes("{}");
    }
    setModalOpen(true);
  };

  // Submit CRUD part form
  const handlePartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPart(true);

    let attrs = {};
    try {
      attrs = JSON.parse(formAttributes);
    } catch (err) {
      toast.error("Attributes must be a valid JSON object.");
      setSavingPart(false);
      return;
    }

    const payload = {
      name: formName,
      manufacturer: formManufacturer,
      model: formModel,
      weightGrams: parseFloat(formWeight),
      mainCategory: formMainCat,
      subCategory: formSubCat,
      attributes: attrs,
      isComposite: formIsComposite,
    };

    try {
      const url = editingPart ? `/api/v1/parts/${editingPart.id}` : "/api/v1/parts";
      const method = editingPart ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Request failed.");
      toast.success(editingPart ? "Part details updated." : "New curated part registered.");
      setModalOpen(false);
      loadParts();
    } catch (err) {
      console.error(err);
      toast.error("Error saving part configuration.");
    } finally {
      setSavingPart(false);
    }
  };

  // Soft delete (Archive) part
  const handleArchivePart = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to archive this part? It will be hidden from search engines.")) return;

    try {
      const res = await fetch(`/api/v1/parts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Part archived.");
      loadParts();
    } catch (err) {
      console.error(err);
      toast.error("Error archiving part.");
    }
  };

  // Restore archived part
  const handleRestorePart = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/parts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) throw new Error("Restore failed");
      toast.success("Part restored to active list.");
      loadParts();
    } catch (err) {
      console.error(err);
      toast.error("Error restoring part.");
    }
  };

  // Bulk CSV parser import
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    setImportingCsv(true);

    try {
      // Basic CSV parse logic
      const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        throw new Error("CSV payload must contain headers and at least 1 data row.");
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
      const partsToImport = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map(r => r.trim().replace(/['"]/g, ""));
        const obj: any = {};
        headers.forEach((h, idx) => {
          const val = row[idx];
          if (h === "weightGrams") {
            obj[h] = parseFloat(val);
          } else if (h === "isComposite") {
            obj[h] = val === "true" || val === "1";
          } else {
            obj[h] = val;
          }
        });
        
        // Append empty attributes object if missing
        if (!obj.attributes) {
          obj.attributes = {};
        }
        partsToImport.push(obj);
      }

      const res = await fetch("/api/v1/parts/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts: partsToImport }),
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error?.message || "Import failed.");
      }

      const body = await res.json();
      toast.success(body.data?.message || "Parts list imported successfully.");
      setCsvText("");
      loadParts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "CSV parse error.");
    } finally {
      setImportingCsv(false);
    }
  };


  // Filter list locally
  const filteredParts = parts.filter((p) => {
    const term = search.toLowerCase();
    const matchesQuery =
      p.name.toLowerCase().includes(term) ||
      p.manufacturer.toLowerCase().includes(term) ||
      p.model.toLowerCase().includes(term);
    
    if (subCategoryFilter) {
      return matchesQuery && p.subCategory === subCategoryFilter;
    }
    return matchesQuery;
  });

  return (
    <div className="min-h-screen p-6 select-none max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-wider uppercase text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              Administrative Control Deck
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
              Manage curated parts registry, bulk CSV imports, and thrust test stands
            </p>
          </div>
        </div>
      </div>

      {/* Admin Sub-navigation Tabs */}
      <div className="flex border-b border-slate-900 pb-px gap-2">
        <button
          onClick={() => router.push("/admin/parts")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-cyan-500 text-white transition cursor-pointer flex items-center gap-1.5"
        >
          <Cpu className="w-3.5 h-3.5" />
          Parts Registry
        </button>
        <button
          onClick={() => router.push("/admin/thrust-data")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-350 transition cursor-pointer flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          Thrust Test Stand
        </button>
        <button
          onClick={() => router.push("/admin/builds")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-350 transition cursor-pointer flex items-center gap-1.5"
        >
          <Hammer className="w-3.5 h-3.5" />
          Builds Registry
        </button>
        {roles.includes("system_admin") && (
          <button
            onClick={() => router.push("/admin/users")}
            className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-350 transition cursor-pointer flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            User Management
          </button>
        )}
      </div>

      {/* Parts CRUD List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block px-1">
            Curated Parts Listing
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCsvModalOpen(true)}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Bulk Import CSV
            </button>
            <button
              onClick={() => openModal(null)}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Part
            </button>
          </div>
        </div>

          {/* Local Filters filter */}
          <div className="flex gap-3 items-center bg-slate-900/10 p-3.5 border border-slate-900 rounded-xl">
            <input
              type="text"
              placeholder="Search parts index..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs text-white placeholder-slate-600"
            />
            <select
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-slate-400 cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="FRAME">Frame</option>
              <option value="FC">FC</option>
              <option value="ESC">ESC</option>
              <option value="AIO">AIO Board</option>
              <option value="MOTOR">Motor</option>
              <option value="PROPELLER">Propeller</option>
              <option value="BATTERY">Battery</option>
              <option value="VTX">VTX</option>
              <option value="CAMERA">Camera</option>
            </select>
          </div>

          {/* Parts table list */}
          <div className="border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/80">
                  <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Manufacturer/Part</th>
                  <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Subcategory</th>
                  <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-right">Weight</th>
                  <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Status</th>
                  <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest select-none">
                      No matching parts in catalog
                    </td>
                  </tr>
                ) : (
                  filteredParts.map((part) => (
                    <tr
                      key={part.id}
                      className={`border-b border-slate-900 hover:bg-slate-900/10 transition ${
                        part.isArchived ? "opacity-45" : ""
                      }`}
                    >
                      <td className="p-3.5 font-semibold">
                        <div className="text-[10px] text-slate-500 uppercase font-black">{part.manufacturer}</div>
                        <div className="text-white text-xs truncate max-w-[200px] mt-0.5">{part.name}</div>
                      </td>
                      <td className="p-3.5 font-bold text-slate-400 uppercase tracking-wide">{part.subCategory}</td>
                      <td className="p-3.5 font-bold text-slate-300 text-right">{part.weightGrams}g</td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            part.isArchived
                              ? "bg-rose-950/40 text-rose-400 border-rose-800/40"
                              : "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                          }`}
                        >
                          {part.isArchived ? "Archived" : "Active"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openModal(part)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-900 transition cursor-pointer"
                            title="Edit part specs"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {part.isArchived ? (
                            <button
                              onClick={(e) => handleRestorePart(part.id, e)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-900 transition cursor-pointer"
                              title="Restore part"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleArchivePart(part.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-900 transition cursor-pointer"
                              title="Archive part"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* CSV Bulk Catalog Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl relative glow-cyan flex flex-col">
            <div className="p-4 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <Upload className="w-4.5 h-4.5 text-cyan-400" />
                CSV Bulk Catalog Import
              </h2>
              <button
                onClick={() => setCsvModalOpen(false)}
                className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCsvImport} className="p-5 space-y-4 text-xs text-slate-200">
              <div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  Paste comma-separated rows. Expected headers:
                  <code className="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded font-mono mx-1">name,manufacturer,model,weightGrams,mainCategory,subCategory,isComposite</code>
                </p>
              </div>

              <div>
                <textarea
                  rows={8}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="name,manufacturer,model,weightGrams,mainCategory,subCategory,isComposite&#10;Apex Arms,ImpulseRC,Apex,12.5,FRAME,FRAME,false"
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs text-white placeholder-slate-650 font-mono"
                />
              </div>

              <div className="border-t border-slate-855 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importingCsv || !csvText.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  {importingCsv ? "Importing..." : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Import Parts
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CRUD Part Detail Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl relative glow-cyan flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                {editingPart ? "Configure Part Specifications" : "Register Curated Part"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePartSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Part Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 outline-none text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    value={formManufacturer}
                    onChange={(e) => setFormManufacturer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 outline-none text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 outline-none text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Weight (g) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 outline-none text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Main Category</label>
                  <select
                    value={formMainCat}
                    onChange={(e) => setFormMainCat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-slate-400 cursor-pointer"
                  >
                    <option value="FRAME">FRAME</option>
                    <option value="ELECTRONICS">ELECTRONICS</option>
                    <option value="PROPULSION">PROPULSION</option>
                    <option value="ACCESSORIES">ACCESSORIES</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Subcategory</label>
                  <select
                    value={formSubCat}
                    onChange={(e) => setFormSubCat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-slate-400 cursor-pointer"
                  >
                    <option value="FRAME">FRAME</option>
                    <option value="FC">FC</option>
                    <option value="ESC">ESC</option>
                    <option value="AIO">AIO</option>
                    <option value="MOTOR">MOTOR</option>
                    <option value="PROPELLER">PROPELLER</option>
                    <option value="BATTERY">BATTERY</option>
                    <option value="VTX">VTX</option>
                    <option value="CAMERA">CAMERA</option>
                    <option value="RC_RECEIVER">RC_RECEIVER</option>
                    <option value="GPS">GPS</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="isComposite"
                  checked={formIsComposite}
                  onChange={(e) => setFormIsComposite(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 bg-slate-950 border-slate-800 rounded"
                />
                <label htmlFor="isComposite" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Is Composite Stack Board
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Specifications Attributes JSON blob
                </label>
                <textarea
                  rows={6}
                  value={formAttributes}
                  onChange={(e) => setFormAttributes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-white font-mono"
                />
              </div>

              <div className="border-t border-slate-850 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPart}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  {savingPart ? "Saving..." : "Save Part"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
