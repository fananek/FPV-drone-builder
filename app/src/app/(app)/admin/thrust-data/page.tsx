"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Settings, Plus, ArrowLeft, Trash2, Edit, Check, EyeOff, Sparkles, Upload, Cpu, Zap, Hammer, Users } from "lucide-react";
import { toast } from "sonner";

interface ThrustTestPoint {
  throttlePercent: number;
  currentAmps: number;
  thrustGrams: number;
  voltageVolts: number;
  rpm?: number;
}

interface ThrustTest {
  id: string;
  motorId: string;
  propellerId: string;
  batteryCellCount: number;
  batteryChemistry: string;
  testPoints: ThrustTestPoint[];
  isEmpirical: boolean;
  sourceLabel: string | null;
  isArchived: boolean;
  createdAt: number;
}

interface Part {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  subCategory: string;
}

export default function AdminThrustDataPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tests, setTests] = useState<ThrustTest[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // CRUD / Upload Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<ThrustTest | null>(null);
  const [thrustMotorId, setThrustMotorId] = useState("");
  const [thrustPropId, setThrustPropId] = useState("");
  const [thrustCells, setThrustCells] = useState("4");
  const [thrustChemistry, setThrustChemistry] = useState("LiPo");
  const [formTestPoints, setFormTestPoints] = useState<ThrustTestPoint[]>([]);
  const [thrustSource, setThrustSource] = useState("RCBenchmark Stand Data");
  const [isEmpirical, setIsEmpirical] = useState(true);
  const [uploadingThrust, setUploadingThrust] = useState(false);

  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [jsonInputText, setJsonInputText] = useState("");

  const [bulkJsonModalOpen, setBulkJsonModalOpen] = useState(false);
  const [bulkJsonText, setBulkJsonText] = useState("");
  const [importingBulkJson, setImportingBulkJson] = useState(false);

  // Telemetry Grid Handlers
  const handleUpdatePoint = (index: number, field: keyof ThrustTestPoint, value: number) => {
    const updated = [...formTestPoints];
    updated[index] = {
      ...updated[index],
      [field]: isNaN(value) ? 0 : value,
    };
    setFormTestPoints(updated);
  };

  const handleAddPointRow = () => {
    const lastPoint = formTestPoints[formTestPoints.length - 1];
    const nextThrottle = lastPoint ? Math.min(100, lastPoint.throttlePercent + 10) : 0;
    const nextVoltage = lastPoint ? lastPoint.voltageVolts : 16.8;

    setFormTestPoints([
      ...formTestPoints,
      { throttlePercent: nextThrottle, currentAmps: 0, thrustGrams: 0, voltageVolts: nextVoltage },
    ]);
  };

  const handleRemovePointRow = (index: number) => {
    if (formTestPoints.length === 1) {
      toast.error("At least one telemetry point is required.");
      return;
    }
    setFormTestPoints(formTestPoints.filter((_, idx) => idx !== index));
  };

  // Check role clearance
  const roles = session?.user?.roles || [];
  const isAdmin = roles.includes("system_admin") || roles.includes("metadata_admin");

  const loadData = async () => {
    setLoading(true);
    try {
      // Load parts first to resolve IDs to names
      const partsRes = await fetch("/api/v1/parts?limit=500&includeArchived=true");
      if (!partsRes.ok) throw new Error("Failed to load parts registry");
      const partsBody = await partsRes.json();
      setParts(partsBody.data || []);

      // Load thrust tests
      const res = await fetch("/api/v1/thrust-tests?includeArchived=true");
      if (!res.ok) throw new Error("Failed to load thrust tests database");
      const body = await res.json();
      setTests(body.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Error reading thrust stand telemetry archives.");
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
      loadData();
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
          Access restricted. Your credentials do not hold required administrative privileges to modify thrust test indexes.
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

  // Create lookup maps
  const partsMap = new Map(parts.map((p) => [p.id, p]));
  const motorsList = parts.filter((p) => p.subCategory === "MOTOR");
  const propellersList = parts.filter((p) => p.subCategory === "PROPELLER");

  // Open modal to add or edit
  const openModal = (test: ThrustTest | null = null) => {
    if (test) {
      setEditingTest(test);
      setThrustMotorId(test.motorId);
      setThrustPropId(test.propellerId);
      setThrustCells(test.batteryCellCount.toString());
      setThrustChemistry(test.batteryChemistry);
      setThrustSource(test.sourceLabel || "");
      setIsEmpirical(test.isEmpirical);
      setFormTestPoints(test.testPoints);
    } else {
      setEditingTest(null);
      setThrustMotorId("");
      setThrustPropId("");
      setThrustCells("4");
      setThrustChemistry("LiPo");
      setThrustSource("RCBenchmark Stand Data");
      setIsEmpirical(true);
      setFormTestPoints([
        { throttlePercent: 0, currentAmps: 0, thrustGrams: 0, voltageVolts: 16.8 },
        { throttlePercent: 25, currentAmps: 5, thrustGrams: 150, voltageVolts: 16.2 },
        { throttlePercent: 50, currentAmps: 15, thrustGrams: 450, voltageVolts: 15.6 },
        { throttlePercent: 75, currentAmps: 30, thrustGrams: 850, voltageVolts: 14.8 },
        { throttlePercent: 100, currentAmps: 45, thrustGrams: 1200, voltageVolts: 14.0 },
      ]);
    }
    setModalOpen(true);
  };

  // Soft delete (Archive) thrust data
  const handleArchiveTest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to archive this thrust dataset? It will be hidden from flight calculations.")) return;

    try {
      const res = await fetch(`/api/v1/thrust-tests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Archive failed");
      toast.success("Thrust test dataset archived.");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Error archiving dataset.");
    }
  };

  // Restore archived thrust data
  const handleRestoreTest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/thrust-tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) throw new Error("Restore failed");
      toast.success("Thrust dataset restored to active status.");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Error restoring dataset.");
    }
  };

  // Submit new thrust test stand points
  const handleThrustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thrustMotorId || !thrustPropId) {
      toast.error("Motor and Propeller models are required.");
      return;
    }

    if (formTestPoints.length === 0) {
      toast.error("At least one test point is required.");
      return;
    }

    // Sort by throttlePercent ascending to ensure chart linearity
    const sortedPoints = [...formTestPoints].sort((a, b) => a.throttlePercent - b.throttlePercent);

    setUploadingThrust(true);
    try {
      const url = editingTest ? `/api/v1/thrust-tests/${editingTest.id}` : "/api/v1/thrust-tests";
      const method = editingTest ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motorId: thrustMotorId,
          propellerId: thrustPropId,
          batteryCellCount: parseInt(thrustCells, 10),
          batteryChemistry: thrustChemistry,
          testPoints: sortedPoints,
          isEmpirical: isEmpirical,
          sourceLabel: thrustSource || null,
        }),
      });

      if (!res.ok) throw new Error(editingTest ? "Update failed." : "Upload failed.");
      toast.success(editingTest ? "Thrust stand dataset updated." : "Empirical thrust stand data synchronized.");
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error processing thrust stand upload.");
    } finally {
      setUploadingThrust(false);
    }
  };

  // Bulk import multiple datasets via JSON
  const handleBulkJsonImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkJsonText.trim()) return;
    setImportingBulkJson(true);

    try {
      const parsed = JSON.parse(bulkJsonText.trim());
      let testsToImport: any[] = [];
      if (Array.isArray(parsed)) {
        testsToImport = parsed;
      } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.tests)) {
        testsToImport = parsed.tests;
      } else {
        throw new Error("JSON must be a thrust tests array or an object containing a 'tests' array.");
      }

      for (const t of testsToImport) {
        if (!t.motorId || !t.propellerId || t.batteryCellCount === undefined || !t.batteryChemistry || !t.testPoints) {
          throw new Error("Invalid dataset: missing required fields (motorId, propellerId, batteryCellCount, batteryChemistry, testPoints).");
        }
        t.batteryCellCount = parseInt(t.batteryCellCount, 10);
        t.isEmpirical = t.isEmpirical !== undefined ? !!t.isEmpirical : true;
        if (!Array.isArray(t.testPoints)) {
          throw new Error("testPoints must be an array.");
        }
      }

      const res = await fetch("/api/v1/thrust-tests/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tests: testsToImport }),
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error?.message || "Bulk import failed.");
      }

      const body = await res.json();
      toast.success(body.data?.message || "Thrust datasets imported successfully.");
      setBulkJsonText("");
      setBulkJsonModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "JSON parse/validation error.");
    } finally {
      setImportingBulkJson(false);
    }
  };

  // Filter list locally
  const filteredTests = tests.filter((t) => {
    const motor = partsMap.get(t.motorId);
    const prop = partsMap.get(t.propellerId);
    const term = search.toLowerCase();

    const motorName = motor ? `${motor.manufacturer} ${motor.name} ${motor.model}`.toLowerCase() : "";
    const propName = prop ? `${prop.manufacturer} ${prop.name} ${prop.model}`.toLowerCase() : "";
    const sourceLabel = t.sourceLabel ? t.sourceLabel.toLowerCase() : "";

    return (
      motorName.includes(term) ||
      propName.includes(term) ||
      sourceLabel.includes(term) ||
      t.batteryChemistry.toLowerCase().includes(term)
    );
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
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-355 transition cursor-pointer flex items-center gap-1.5"
        >
          <Cpu className="w-3.5 h-3.5" />
          Parts Registry
        </button>
        <button
          onClick={() => router.push("/admin/thrust-data")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-cyan-500 text-white transition cursor-pointer flex items-center gap-1.5"
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

      {/* Grid panels */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block px-1">
            Empirical Thrust Measurements database
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkJsonModalOpen(true)}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Bulk Import JSON
            </button>
            <button
              onClick={() => openModal(null)}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Thrust Data
            </button>
          </div>
        </div>

        {/* Local Search bar */}
        <div className="flex gap-3 items-center bg-slate-900/10 p-3.5 border border-slate-900 rounded-xl">
          <input
            type="text"
            placeholder="Search by motor, prop, chemistry, or stand label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs text-white placeholder-slate-600"
          />
        </div>

        {/* Thrust Table */}
        <div className="border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950/80">
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Motor Spec</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Propeller Spec</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Power Class</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Points Count</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Source Stand Label</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Status</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest select-none">
                    No matching thrust test stand entries in archives
                  </td>
                </tr>
              ) : (
                filteredTests.map((test) => {
                  const motor = partsMap.get(test.motorId);
                  const prop = partsMap.get(test.propellerId);

                  return (
                    <tr
                      key={test.id}
                      className={`border-b border-slate-900 hover:bg-slate-900/10 transition ${
                        test.isArchived ? "opacity-45" : ""
                      }`}
                    >
                      <td className="p-3.5 font-semibold">
                        <div className="text-[10px] text-slate-500 uppercase font-black">
                          {motor ? motor.manufacturer : "Unknown"}
                        </div>
                        <div className="text-white text-xs truncate max-w-[150px] mt-0.5">
                          {motor ? `${motor.name} ${motor.model}` : "ID: " + test.motorId}
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold">
                        <div className="text-[10px] text-slate-500 uppercase font-black">
                          {prop ? prop.manufacturer : "Unknown"}
                        </div>
                        <div className="text-white text-xs truncate max-w-[150px] mt-0.5">
                          {prop ? `${prop.name} ${prop.model}` : "ID: " + test.propellerId}
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-300">
                        {test.batteryCellCount}S {test.batteryChemistry}
                      </td>
                      <td className="p-3.5 text-center font-bold text-cyan-400">
                        {test.testPoints?.length || 0} pts
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[10px]">
                        {test.sourceLabel || "RCBenchmark Raw Output"}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            test.isArchived
                              ? "bg-rose-950/40 text-rose-400 border-rose-800/40"
                              : "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                          }`}
                        >
                          {test.isArchived ? "Archived" : "Active"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openModal(test)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-900 transition cursor-pointer"
                            title="Edit dataset specs"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {test.isArchived ? (
                            <button
                              onClick={(e) => handleRestoreTest(test.id, e)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-900 transition cursor-pointer"
                              title="Restore dataset"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleArchiveTest(test.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-900 transition cursor-pointer"
                              title="Archive dataset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl relative glow-cyan flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                {editingTest ? "Configure Thrust Stand Data" : "Upload Thrust Stand Points"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
              >
                <span className="text-lg">×</span>
              </button>
            </div>

            <form onSubmit={handleThrustSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Motor *</label>
                  <select
                    required
                    value={thrustMotorId}
                    onChange={(e) => setThrustMotorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-slate-350 cursor-pointer"
                  >
                    <option value="">Choose Motor Model...</option>
                    {motorsList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.manufacturer} - {m.name} ({m.model})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Propeller *</label>
                  <select
                    required
                    value={thrustPropId}
                    onChange={(e) => setThrustPropId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-slate-350 cursor-pointer"
                  >
                    <option value="">Choose Propeller...</option>
                    {propellersList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.manufacturer} - {p.name} ({p.model})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Battery Cell Count *</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={thrustCells}
                    onChange={(e) => setThrustCells(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Chemistry *</label>
                  <select
                    value={thrustChemistry}
                    onChange={(e) => setThrustChemistry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-slate-350"
                  >
                    <option value="LiPo">LiPo</option>
                    <option value="LiHv">LiHv</option>
                    <option value="LiIon">LiIon</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Source Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RCBenchmark Stand Data V2"
                    value={thrustSource}
                    onChange={(e) => setThrustSource(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-white"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4 pt-1.5">
                  <input
                    type="checkbox"
                    id="isEmpirical"
                    checked={isEmpirical}
                    onChange={(e) => setIsEmpirical(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 bg-slate-950 border-slate-800 rounded"
                  />
                  <label htmlFor="isEmpirical" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                    Is Empirical (Tested stand data)
                  </label>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                    Thrust Telemetry Points *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setJsonImportOpen(true)}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3 text-cyan-400" />
                      Import JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPointRow}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition cursor-pointer"
                    >
                      + Add Point Row
                    </button>
                  </div>
                </div>

                <div className="border border-slate-900 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse bg-slate-950/40">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/80 font-bold uppercase text-[9px] text-slate-500 tracking-wider">
                        <th className="p-2 text-center">Throttle %</th>
                        <th className="p-2 text-center">Current (A)</th>
                        <th className="p-2 text-center">Thrust (g)</th>
                        <th className="p-2 text-center">Voltage (V)</th>
                        <th className="p-2 text-center w-12">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formTestPoints.map((pt, idx) => (
                        <tr key={idx} className="border-b border-slate-900/40 hover:bg-slate-900/10 transition">
                          <td className="p-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              required
                              value={pt.throttlePercent}
                              onChange={(e) => handleUpdatePoint(idx, "throttlePercent", parseFloat(e.target.value))}
                              className="w-full text-center px-1 py-1 bg-slate-950/80 border border-slate-850 rounded focus:border-cyan-500 outline-none font-medium text-white text-[11px]"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={pt.currentAmps}
                              onChange={(e) => handleUpdatePoint(idx, "currentAmps", parseFloat(e.target.value))}
                              className="w-full text-center px-1 py-1 bg-slate-950/80 border border-slate-850 rounded focus:border-cyan-500 outline-none font-medium text-white text-[11px]"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              required
                              value={pt.thrustGrams}
                              onChange={(e) => handleUpdatePoint(idx, "thrustGrams", parseFloat(e.target.value))}
                              className="w-full text-center px-1 py-1 bg-slate-950/80 border border-slate-850 rounded focus:border-cyan-500 outline-none font-medium text-white text-[11px]"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={pt.voltageVolts}
                              onChange={(e) => handleUpdatePoint(idx, "voltageVolts", parseFloat(e.target.value))}
                              className="w-full text-center px-1 py-1 bg-slate-950/80 border border-slate-850 rounded focus:border-cyan-500 outline-none font-medium text-white text-[11px]"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePointRow(idx)}
                              className="p-1 text-slate-500 hover:text-rose-450 hover:bg-slate-900 transition rounded cursor-pointer flex items-center justify-center mx-auto"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  disabled={uploadingThrust}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  {uploadingThrust ? "Saving..." : (editingTest ? "Save Changes" : "Sync Stand Data")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* JSON Telemetry Import Sub-Modal */}
      {jsonImportOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-955/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 glow-cyan">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Import Telemetry JSON</h3>
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
              Paste a JSON array of telemetry points. Expected format:
              <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded font-mono mx-1">[{"{ throttlePercent, currentAmps, thrustGrams, voltageVolts }"}]</code>
            </p>
            <textarea
              rows={6}
              value={jsonInputText}
              onChange={(e) => setJsonInputText(e.target.value)}
              placeholder={`[\n  { "throttlePercent": 25, "currentAmps": 5.2, "thrustGrams": 180, "voltageVolts": 15.2 },\n  { "throttlePercent": 50, "currentAmps": 15.6, "thrustGrams": 420, "voltageVolts": 14.8 }\n]`}
              className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-white font-mono placeholder-slate-700 focus:border-cyan-505 focus:ring-1 focus:ring-cyan-505"
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setJsonImportOpen(false)}
                className="px-3.5 py-2 border border-slate-850 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl hover:border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsedData = JSON.parse(jsonInputText.trim());
                    if (!Array.isArray(parsedData)) {
                      throw new Error("JSON must be a telemetry points array.");
                    }
                    const parsed = parsedData.map((pt: any) => {
                      const throttlePercent = pt.throttlePercent !== undefined ? pt.throttlePercent : (pt.throttle !== undefined ? pt.throttle : pt.throttle_percent);
                      const currentAmps = pt.currentAmps !== undefined ? pt.currentAmps : (pt.current !== undefined ? pt.current : pt.current_amps);
                      const thrustGrams = pt.thrustGrams !== undefined ? pt.thrustGrams : (pt.thrust !== undefined ? pt.thrust : pt.thrust_grams);
                      const voltageVolts = pt.voltageVolts !== undefined ? pt.voltageVolts : (pt.voltage !== undefined ? pt.voltage : pt.voltage_volts);
                      
                      if (throttlePercent === undefined || currentAmps === undefined || thrustGrams === undefined || voltageVolts === undefined) {
                        throw new Error("Invalid format. Expected keys: throttlePercent, currentAmps, thrustGrams, voltageVolts");
                      }
                      return {
                        throttlePercent: parseFloat(throttlePercent),
                        currentAmps: parseFloat(currentAmps),
                        thrustGrams: parseFloat(thrustGrams),
                        voltageVolts: parseFloat(voltageVolts),
                        rpm: pt.rpm ? parseInt(pt.rpm, 10) : undefined,
                      };
                    });
                    if (parsed.length === 0) throw new Error("No telemetry data found.");
                    setFormTestPoints(parsed);
                    setJsonInputText("");
                    setJsonImportOpen(false);
                    toast.success("Telemetry points parsed and loaded into the grid.");
                  } catch (errVal: any) {
                    toast.error(errVal.message || "Failed to parse JSON inputs.");
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-955 font-black text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Load Points
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Bulk Importer Modal (For importing multiple datasets) */}
      {bulkJsonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl relative glow-cyan flex flex-col">
            <div className="p-4 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <Upload className="w-4.5 h-4.5 text-cyan-400" />
                Bulk Import Thrust JSON
              </h2>
              <button
                onClick={() => setBulkJsonModalOpen(false)}
                className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
              >
                <span className="text-lg">×</span>
              </button>
            </div>

            <form onSubmit={handleBulkJsonImport} className="p-5 space-y-4 text-xs text-slate-200">
              <div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  Paste a JSON array of tests or a JSON object with a <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded font-mono mx-1">tests</code> array containing thrust test stand telemetry definitions.
                </p>
              </div>

              <div>
                <textarea
                  rows={8}
                  value={bulkJsonText}
                  onChange={(e) => setBulkJsonText(e.target.value)}
                  placeholder={`[\n  {\n    "motorId": "motor-uuid",\n    "propellerId": "prop-uuid",\n    "batteryCellCount": 4,\n    "batteryChemistry": "LiPo",\n    "sourceLabel": "Benchmark Stand",\n    "isEmpirical": true,\n    "testPoints": [\n      { "throttlePercent": 25, "currentAmps": 5.2, "thrustGrams": 180, "voltageVolts": 15.2 }\n    ]\n  }\n]`}
                  className="w-full px-3 py-2 bg-slate-955/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs text-white placeholder-slate-650 font-mono"
                />
              </div>

              <div className="border-t border-slate-855 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBulkJsonModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importingBulkJson || !bulkJsonText.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-955 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  {importingBulkJson ? "Importing..." : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Import Telemetry
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
