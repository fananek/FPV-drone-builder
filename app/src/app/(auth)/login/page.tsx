"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Disc, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        toast.error("Invalid credentials. Please check your email and password.");
      } else {
        toast.success("Welcome back! Uplinking flight systems...");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: "google" | "github") => {
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans antialiased text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md p-8 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center mb-3">
            <img src="/logo.svg" alt="FPV Builder" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            UPLINK SECURE
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sign in to FPV Drone Builder
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Access Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-sm text-white placeholder-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition duration-300 flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-500/10 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Initiate Link
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800/80" />
          </div>
          <span className="relative px-3 bg-slate-900/50 backdrop-blur-xl text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Or Sync Via
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleOAuthLogin("google")}
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800/60 rounded-xl text-slate-300 hover:text-white transition duration-200 text-sm cursor-pointer"
          >
            <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.3.67 4.5 1.8l2.4-2.4C17.3 1.8 14.9 1 12.24 1 6.58 1 2 5.58 2 11.24s4.58 10.24 10.24 10.24c5.79 0 10.24-4.1 10.24-10.24 0-.64-.07-1.29-.24-1.95H12.24z" />
            </svg>
            Google
          </button>
          <button
            onClick={() => handleOAuthLogin("github")}
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800/60 rounded-xl text-slate-300 hover:text-white transition duration-200 text-sm cursor-pointer"
          >
            <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
          </button>
        </div>

        {/* Register link */}
        <div className="mt-8 text-center text-xs text-slate-400">
          New pilot to the coordinates?{" "}
          <Link
            href="/register"
            className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4 transition"
          >
            Create an Account
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 bg-slate-950">
        <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold uppercase tracking-widest font-sans">Connecting secure link...</span>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
