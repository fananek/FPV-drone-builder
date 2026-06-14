"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, ShieldAlert, Trash2, Calendar, FileText, Globe, Star } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Aggregate stats states
  const [totalBuilds, setTotalBuilds] = useState(0);
  const [publicBuilds, setPublicBuilds] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  // User DB profile state
  const [dbProfile, setDbProfile] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // Deletion confirm modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      // Load builds to calculate aggregate statistics
      setLoadingStats(true);
      
      // Load user profile details
      fetch("/api/v1/users/me")
        .then((res) => res.json())
        .then((body) => {
          if (body.data) {
            setDbProfile(body.data);
          }
        })
        .catch((err) => console.error("Error loading user profile: ", err));

      fetch("/api/v1/builds")
        .then((res) => res.json())
        .then((body) => {
          if (body.data) {
            const buildsList = body.data;
            setTotalBuilds(buildsList.length);
            setPublicBuilds(buildsList.filter((b: any) => b.isPublic).length);
            setTotalRatings(buildsList.reduce((sum: number, b: any) => sum + (b.ratingCount || 0), 0));
          }
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to compile hangar profile stats.");
        })
        .finally(() => {
          setLoadingStats(false);
        });
    }
  }, [status, router]);

  const handleSelfVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: true }),
      });
      if (!res.ok) throw new Error("Verification failed");
      const body = await res.json();
      if (body.data) {
        setDbProfile(body.data);
        toast.success("Coordinates successfully verified. Safe flying!");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify coordinates.");
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/users/me", { method: "DELETE" });
      if (!res.ok) throw new Error("Deconstruction failed");

      toast.success("Pilot account decommissioned. Terminating link...");
      signOut({ callbackUrl: "/" });
    } catch (err) {
      console.error(err);
      toast.error("Error deleting account.");
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  if (status === "loading" || loadingStats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest">Retrieving pilot profile...</span>
      </div>
    );
  }

  if (!session) return null;

  const rolesList = dbProfile?.roles || session.user.roles || [];
  const subscriptionLevel = dbProfile?.subscriptionStatus || "free";
  const isVerified = dbProfile ? !!dbProfile.emailVerified : false;
  const isEmailUser = dbProfile?.needsVerification !== undefined;

  return (
    <div className="min-h-screen p-6 select-none max-w-2xl mx-auto flex flex-col gap-6 relative">
      {/* Header */}
      <div className="border-b border-slate-900 pb-5">
        <h1 className="text-xl font-black tracking-wider uppercase text-white flex items-center gap-2">
          <User className="w-5 h-5 text-cyan-400" />
          Pilot Credentials
        </h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
          Verify security clearance levels and hangar metrics
        </p>
      </div>

      {/* Profile Info Card */}
      <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-2xl flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-cyan-500/10">
            {session.user.name ? session.user.name[0].toUpperCase() : "P"}
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase">{session.user.name || "Telemetry User"}</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{session.user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-900/60 pt-4 text-xs font-medium">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Link established: {rolesList.includes("anonymous") ? "Anonymous Session" : "Sync Pilot"}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Globe className="w-4 h-4 text-slate-500" />
            <span>Role Clearances: {rolesList.join(", ") || "anonymous"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-900/60 pt-4 text-xs font-medium">
          <div className="flex items-center gap-2 text-slate-400">
            <Globe className="w-4 h-4 text-slate-500" />
            <span className="capitalize">Subscription Tier: <strong className="text-cyan-400 uppercase text-[10px]">{subscriptionLevel}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <span>
              Hangar Status:{" "}
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                  isVerified
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                    : "bg-rose-950/40 text-rose-400 border-rose-800/40"
                }`}
              >
                {isVerified ? "Verified" : "Unverified"}
              </span>
            </span>
          </div>
        </div>

        {/* If unverified email user, show verify action */}
        {!isVerified && !rolesList.includes("anonymous") && (
          <div className="mt-2 p-3 bg-rose-950/15 border border-rose-900/20 rounded-xl flex items-center justify-between gap-3 animate-pulse">
            <div className="text-[10px] text-slate-350 leading-relaxed font-semibold">
              Your email coordinates are not synchronized. Please verify coordinates to register builds.
            </div>
            <button
              onClick={handleSelfVerify}
              disabled={verifying}
              className="px-3 py-1.5 bg-rose-900/30 hover:bg-rose-900/60 border border-rose-800/40 hover:border-rose-700 text-rose-350 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center shrink-0"
            >
              {verifying ? "Syncing..." : "Verify (Mock)"}
            </button>
          </div>
        )}
      </div>

      {/* Hangar Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-xl flex flex-col items-center justify-center text-center">
          <FileText className="w-5 h-5 text-indigo-400 mb-1.5" />
          <span className="text-lg font-black text-white">{totalBuilds}</span>
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Total Decks</span>
        </div>

        <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-xl flex flex-col items-center justify-center text-center">
          <Globe className="w-5 h-5 text-cyan-400 mb-1.5" />
          <span className="text-lg font-black text-white">{publicBuilds}</span>
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Shared Public</span>
        </div>

        <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-xl flex flex-col items-center justify-center text-center">
          <Star className="w-5 h-5 text-amber-500 mb-1.5" />
          <span className="text-lg font-black text-white">{totalRatings}</span>
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Reviews Recd</span>
        </div>
      </div>

      {/* Account Deconstruction Section */}
      <div className="p-6 bg-rose-950/10 border border-rose-900/20 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6">
        <div className="flex-1">
          <h3 className="text-xs font-black uppercase text-rose-400 tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Danger Zone
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
            Decommission your pilot profile. This action will purge your builds, ratings, custom parts, and telemetry profiles permanently.
          </p>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2.5 bg-rose-900/30 hover:bg-rose-900/60 border border-rose-800/40 hover:border-rose-700 text-rose-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5 self-end md:self-auto shrink-0"
        >
          <Trash2 className="w-4 h-4" />
          Deconstruct Profile
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md p-6 bg-slate-900/40 backdrop-blur-xl border border-red-900/30 rounded-2xl shadow-2xl relative glow-cyan flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-red-950/60 border border-red-900/40 rounded-2xl flex items-center justify-center text-red-500 mb-4 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            
            <h2 className="text-base font-black text-white uppercase tracking-wide">Delete Account</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-2 max-w-xs">
              Are you sure you want to delete your account? This action is irreversible.
            </p>

            <div className="flex gap-3 mt-6 w-full">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-650 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/10 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <span className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
