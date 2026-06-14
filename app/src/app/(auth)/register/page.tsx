"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Disc, ArrowRight, User, Mail, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message || "Registration failed. Please try again.");
        return;
      }

      toast.success("Account registered! Linking authentication systems...");

      // Automatically sign in the user
      const loginResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (loginResult?.error) {
        router.push("/login");
      } else {
        toast.success("Uplink established. Redirecting to hangar...");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans antialiased text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-2/3 w-[300px] h-[300px] bg-cyan-900/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md p-8 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center mb-3">
            <img src="/logo.svg" alt="FPV Builder" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            REGISTER PILOT
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create an FPV Drone Builder account
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <User className="w-3..5 h-3.5 text-cyan-500" />
              Pilot Call Sign / Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RotorRider"
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-sm text-white placeholder-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-cyan-500" />
              Pilot Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pilot@fpvbuilder.com"
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-sm text-white placeholder-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-500" />
              Security Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-sm text-white placeholder-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition duration-300 flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-500/10 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Confirm Hangar Coordinates
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Login link */}
        <div className="mt-8 text-center text-xs text-slate-400">
          Already have coordinates synced?{" "}
          <Link
            href="/login"
            className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4 transition"
          >
            Log In
          </Link>
        </div>
      </div>

      {/* Footer / Home Link */}
      <Link
        href="/"
        className="mt-6 text-xs text-slate-500 hover:text-slate-400 transition"
      >
        Return to Landing Pad
      </Link>
    </div>
  );
}
