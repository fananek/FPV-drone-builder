"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Settings, ArrowLeft, Trash2, Edit, EyeOff, Globe, Lock, Search, Cpu, Zap, Hammer, Users, RotateCw } from "lucide-react";
import { toast } from "sonner";

interface Build {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  name: string;
  description: string | null;
  isPublic: boolean;
  tags: string[];
  customPayloadWeightGrams: number;
  clonedFromBuildId: string | null;
  averageRating: number | null;
  ratingCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}

export default function AdminBuildsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // Check role clearance: System Admin or Moderator
  const roles = session?.user?.roles || [];
  const isAuthorized = roles.includes("system_admin") || roles.includes("moderator");

  const loadBuilds = async (includeDeleted: boolean = showDeleted) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/builds?all=true&includeDeleted=${includeDeleted}`);
      if (!res.ok) throw new Error("Failed to load builds archive");
      const body = await res.json();
      setBuilds(body.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Error reading platform builds registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && isAuthorized) {
      loadBuilds(showDeleted);
    }
  }, [status, isAuthorized, router, showDeleted]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest">Opening Secure Core...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 bg-rose-950/60 border border-rose-900/40 rounded-2xl flex items-center justify-center text-rose-500 mb-4">
          <EyeOff className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2">Security Clearance Denied</h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Access restricted. Only System Admins and Moderators hold permissions to audit and edit other users' builds.
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

  // Delete Build
  const handleDeleteBuild = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete build "${name}"? Once confirmed, it will be soft-deleted and can be recovered within 30 days.`)) return;

    try {
      const res = await fetch(`/api/v1/builds/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Build soft-deleted. It can be recovered within 30 days.");
      loadBuilds(showDeleted);
    } catch (err) {
      console.error(err);
      toast.error("Error deleting build from platform database.");
    }
  };

  // Recover build (Admin override)
  const handleRecoverBuild = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/builds/${id}/recover`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to recover build.");
      }
      toast.success("Build successfully recovered and restored.");
      loadBuilds(showDeleted);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error recovering build.");
    }
  };

  // Hard Delete Build (Admin override)
  const handleHardDeleteBuild = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently purge "${name}" from the database? This action is completely irreversible and will cascade to all ratings and components.`)) return;

    try {
      const res = await fetch(`/api/v1/builds/${id}?hard=true`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Build permanently purged.");
      loadBuilds(showDeleted);
    } catch (err) {
      console.error(err);
      toast.error("Error permanently deleting build.");
    }
  };

  // Filter list locally
  const filteredBuilds = builds.filter((b) => {
    const term = search.toLowerCase();
    const tagsString = b.tags ? b.tags.join(" ") : "";
    const authorString = b.userId || b.anonymousSessionId || "anonymous";
    const userNameStr = b.userName || "";
    const userEmailStr = b.userEmail || "";

    return (
      b.name.toLowerCase().includes(term) ||
      (b.description && b.description.toLowerCase().includes(term)) ||
      tagsString.toLowerCase().includes(term) ||
      authorString.toLowerCase().includes(term) ||
      userNameStr.toLowerCase().includes(term) ||
      userEmailStr.toLowerCase().includes(term)
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
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-350 transition cursor-pointer flex items-center gap-1.5"
        >
          <Cpu className="w-3.5 h-3.5" />
          Parts Registry
        </button>
        <button
          onClick={() => router.push("/admin/thrust-data")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-355 transition cursor-pointer flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          Thrust Test Stand
        </button>
        <button
          onClick={() => router.push("/admin/builds")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-cyan-500 text-white transition cursor-pointer flex items-center gap-1.5"
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

      <div className="space-y-4">
        <div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block px-1">
            Build configurations registry (All Platform Builds)
          </span>
        </div>

        {/* Local Search bar */}
        <div className="flex gap-3 items-center bg-slate-900/10 p-3.5 border border-slate-900 rounded-xl">
          <input
            type="text"
            placeholder="Search builds by name, author ID, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs text-white placeholder-slate-600"
          />
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-white transition bg-slate-950/60 px-3.5 py-2.5 border border-slate-800 rounded-xl shrink-0">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 rounded border-slate-850 bg-slate-950 cursor-pointer"
            />
            Show Deleted Builds
          </label>
        </div>

        {/* Builds Table */}
        <div className="border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950/80">
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Build Name</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Pilot Identity</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Visibility</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Rating</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Hangar Tags</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Last Update</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuilds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest select-none">
                    No matching builds found in register
                  </td>
                </tr>
              ) : (
                filteredBuilds.map((build) => {
                  const author = build.userId
                    ? `User: ${build.userId}`
                    : build.anonymousSessionId
                    ? `Anon: ${build.anonymousSessionId.substring(0, 8)}...`
                    : "No owner";

                  return (
                    <tr
                      key={build.id}
                      className="border-b border-slate-900 hover:bg-slate-900/10 transition"
                    >
                      <td className="p-3.5 font-semibold">
                        <div className="text-white text-xs font-bold truncate max-w-[150px]">
                          {build.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">
                          {build.description || "No description provided."}
                        </div>
                      </td>
                      <td className="p-3.5 font-medium">
                        {build.userId ? (
                          <div>
                            {build.userName && (
                              <div className="text-white text-xs font-bold">
                                {build.userName}
                              </div>
                            )}
                            {build.userEmail && (
                              <div className="text-[10px] text-slate-400 font-sans">
                                {build.userEmail}
                              </div>
                            )}
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                              User ID: {build.userId}
                            </div>
                          </div>
                        ) : build.anonymousSessionId ? (
                          <div>
                            <div className="text-white text-xs font-bold">
                              Anonymous Session
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                              Session ID: {build.anonymousSessionId.substring(0, 8)}...
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-500 text-xs font-bold">
                            No owner
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex justify-center">
                          {build.deletedAt ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-rose-950/40 text-rose-450 border-rose-800/40 flex items-center gap-1">
                              Deleted
                            </span>
                          ) : build.isPublic ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-cyan-950/40 text-cyan-400 border-cyan-800/40 flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-slate-950/60 text-slate-500 border-slate-850 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-semibold text-amber-500">
                        {build.averageRating ? `${build.averageRating}★` : "—"}{" "}
                        <span className="text-[9px] text-slate-500 font-medium">({build.ratingCount})</span>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {build.tags && build.tags.length > 0 ? (
                            build.tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1 py-0.5 bg-slate-900/40 border border-slate-800 rounded text-[9px] font-semibold text-slate-400"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-center text-slate-400 text-[10px]">
                        {new Date(build.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {build.deletedAt ? (
                            <>
                              <button
                                onClick={() => handleRecoverBuild(build.id)}
                                className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center gap-1"
                                title="Undelete/Recover Build"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                                Recover
                              </button>
                              <button
                                onClick={() => handleHardDeleteBuild(build.id, build.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-450 rounded hover:bg-slate-900 transition cursor-pointer"
                                title="Delete Permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => router.push(`/dashboard?id=${build.id}`)}
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-900 transition cursor-pointer"
                                title="Edit Build"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBuild(build.id, build.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-450 rounded hover:bg-slate-900 transition cursor-pointer"
                                title="Delete Build"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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
    </div>
  );
}
