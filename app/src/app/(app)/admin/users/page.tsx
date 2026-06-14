"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Settings, ArrowLeft, Trash2, Edit, EyeOff, Shield, CheckCircle, AlertCircle, Calendar, UserCheck, Cpu, Zap, Hammer, Users } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  emailVerified: string | null;
  image: string | null;
  roles: string[];
  subscriptionStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal edit state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [formSubscription, setFormSubscription] = useState("free");
  const [formVerified, setFormVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check role clearance: Only System Admin has access to manage users
  const roles = session?.user?.roles || [];
  const isSystemAdmin = roles.includes("system_admin");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/users");
      if (!res.ok) throw new Error("Failed to load platform pilots directory.");
      const body = await res.json();
      setUsersList(body.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Error reading platform users register.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && isSystemAdmin) {
      loadUsers();
    }
  }, [status, isSystemAdmin, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest">Opening Secure Core...</span>
      </div>
    );
  }

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 bg-rose-950/60 border border-rose-900/40 rounded-2xl flex items-center justify-center text-rose-500 mb-4">
          <EyeOff className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2">Security Clearance Denied</h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Access restricted. Only System Admins hold credentials to view or modify security clearances of other pilots.
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

  // Open user edit modal
  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormRoles(user.roles);
    setFormSubscription(user.subscriptionStatus);
    setFormVerified(!!user.emailVerified);
    setEditModalOpen(true);
  };

  // Submit User profile changes
  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/v1/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: formRoles,
          subscriptionStatus: formSubscription,
          emailVerified: formVerified,
        }),
      });

      if (!res.ok) throw new Error("Update failed");
      toast.success(`Security configurations synced for ${editingUser.name || editingUser.email}`);
      setEditModalOpen(false);
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error("Error updating pilot clearances.");
    } finally {
      setSaving(false);
    }
  };

  // Decommission User
  const handleDeleteUser = async (id: string, email: string) => {
    if (session?.user?.id === id) {
      toast.error("You cannot self-terminate from the admin deck.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to decommission account "${email}"? This will permanently purge their builds, reviews, and custom parts.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Account deletion failed");
      toast.success("Pilot account decommissioned.");
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error("Error purging account.");
    }
  };

  // Toggle role in form state
  const handleRoleToggle = (role: string) => {
    if (formRoles.includes(role)) {
      // Don't let them clear all roles
      if (formRoles.length === 1) {
        toast.error("A pilot must possess at least one security clearance role.");
        return;
      }
      setFormRoles(formRoles.filter((r) => r !== role));
    } else {
      setFormRoles([...formRoles, role]);
    }
  };

  // Filter list locally
  const filteredUsers = usersList.filter((u) => {
    const term = search.toLowerCase();
    const nameStr = u.name ? u.name.toLowerCase() : "";
    const emailStr = u.email.toLowerCase();
    const rolesStr = u.roles.join(" ").toLowerCase();
    const subscriptionStr = u.subscriptionStatus.toLowerCase();

    return (
      nameStr.includes(term) ||
      emailStr.includes(term) ||
      rolesStr.includes(term) ||
      subscriptionStr.includes(term)
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
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-350 transition cursor-pointer flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          Thrust Test Stand
        </button>
        <button
          onClick={() => router.push("/admin/builds")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-355 transition cursor-pointer flex items-center gap-1.5"
        >
          <Hammer className="w-3.5 h-3.5" />
          Builds Registry
        </button>
        <button
          onClick={() => router.push("/admin/users")}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 border-cyan-500 text-white transition cursor-pointer flex items-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          User Management
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block px-1">
            Registered Pilot Directory (System Administration)
          </span>
        </div>

        {/* Local Search bar */}
        <div className="flex gap-3 items-center bg-slate-900/10 p-3.5 border border-slate-900 rounded-xl">
          <input
            type="text"
            placeholder="Search pilots by call sign, email, clearance, or subscription..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-xs text-white placeholder-slate-600"
          />
        </div>

        {/* Users Table */}
        <div className="border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950/80">
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Pilot Identity</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider">Security Clearances</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Subscription</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Verification</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Linked Date</th>
                <th className="p-3.5 font-bold uppercase text-slate-500 tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest select-none">
                    No registered pilots matched the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-slate-900 hover:bg-slate-900/10 transition"
                    >
                      <td className="p-3.5 font-semibold flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-slate-800 flex items-center justify-center font-black text-xs text-cyan-400">
                          {user.name ? user.name[0].toUpperCase() : "P"}
                        </div>
                        <div>
                          <div className="text-white text-xs font-bold truncate max-w-[150px]">
                            {user.name || "Telemetry Pilot"}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5">
                            {user.email}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                            ID: {user.id}
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {user.roles.map((r, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border flex items-center gap-0.5 ${
                                r === "system_admin"
                                  ? "bg-rose-950/40 text-rose-400 border-rose-800/40"
                                  : r === "moderator"
                                  ? "bg-amber-950/40 text-amber-400 border-amber-800/40"
                                  : r === "metadata_admin"
                                  ? "bg-violet-950/40 text-violet-400 border-violet-800/40"
                                  : "bg-slate-900 text-slate-400 border-slate-800"
                              }`}
                            >
                              <Shield className="w-2 h-2" />
                              {r.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            user.subscriptionStatus === "pro" || user.subscriptionStatus === "premium"
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                              : user.subscriptionStatus === "enterprise"
                              ? "bg-cyan-950/40 text-cyan-400 border-cyan-800/40"
                              : "bg-slate-900 text-slate-500 border-slate-800"
                          }`}
                        >
                          {user.subscriptionStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex justify-center">
                          {user.emailVerified ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-emerald-950/40 text-emerald-400 border-emerald-850 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> Verified
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-rose-950/40 text-rose-400 border-rose-850 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> Unverified
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-3.5 text-center text-slate-400 text-[10px] font-medium">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-900 transition cursor-pointer"
                            title="Edit Permissions & Subscription"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={session?.user?.id === user.id}
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className={`p-1.5 rounded transition cursor-pointer ${
                              session?.user?.id === user.id
                                ? "text-slate-700 cursor-not-allowed"
                                : "text-slate-400 hover:text-rose-400 hover:bg-slate-900"
                            }`}
                            title="Decommission Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Edit User Clearance Modal */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl relative glow-cyan flex flex-col">
            <div className="p-4 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <UserCheck className="w-4.5 h-4.5 text-cyan-400" />
                Configure clearances: {editingUser.name || editingUser.email}
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
              >
                <span className="text-lg">×</span>
              </button>
            </div>

            <form onSubmit={handleUserUpdate} className="p-5 space-y-5 text-xs text-slate-200">
              {/* Roles Clearances */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">
                  Clearance Level Roles
                </label>
                <div className="space-y-2 bg-slate-950/40 p-3.5 border border-slate-900 rounded-xl">
                  {["registered_user", "moderator", "metadata_admin", "system_admin"].map((role) => {
                    const isChecked = formRoles.includes(role);
                    return (
                      <div key={role} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`role-${role}`}
                          checked={isChecked}
                          onChange={() => handleRoleToggle(role)}
                          className="w-4 h-4 accent-cyan-500 bg-slate-950 border-slate-800 rounded cursor-pointer"
                        />
                        <label
                          htmlFor={`role-${role}`}
                          className="font-semibold text-slate-350 cursor-pointer capitalize select-none"
                        >
                          {role.replace("_", " ")}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Subscription Status */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">
                  Pilot Subscription status
                </label>
                <select
                  value={formSubscription}
                  onChange={(e) => setFormSubscription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-xs text-slate-300 cursor-pointer"
                >
                  <option value="free">Free Tier</option>
                  <option value="pro">Pro Tier</option>
                  <option value="premium">Premium Tier</option>
                  <option value="enterprise">Enterprise Core</option>
                </select>
              </div>

              {/* Email Verification */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">
                  Email Verification Gate
                </label>
                <div className="flex items-center gap-2.5 bg-slate-950/40 p-3.5 border border-slate-900 rounded-xl">
                  <input
                    type="checkbox"
                    id="email-verified"
                    checked={formVerified}
                    onChange={(e) => setFormVerified(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 bg-slate-950 border-slate-800 rounded cursor-pointer"
                  />
                  <label
                    htmlFor="email-verified"
                    className="font-semibold text-slate-300 cursor-pointer select-none"
                  >
                    Mark Pilot Email as Verified
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-850 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  {saving ? "Syncing..." : "Save Config"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
