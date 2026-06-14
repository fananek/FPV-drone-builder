import Link from "next/link";
import { Disc, Zap, Activity, ShieldCheck, Copy, Sparkles, ArrowRight } from "lucide-react";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-slate-950 antialiased">
      {/* Abstract Glowing Backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-indigo-950/15 rounded-full blur-[160px] pointer-events-none" />

      {/* Grid Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/40 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center">
              <img src="/logo.svg" alt="FPV Builder" className="w-9 h-9 object-contain" />
            </div>
            <span className="font-extrabold text-sm tracking-widest text-white uppercase">
              FPV BUILDER
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <Link href="/gallery" className="text-slate-400 hover:text-white transition">
              Gallery
            </Link>
            <Link href="/compare" className="text-slate-400 hover:text-white transition">
              Compare Engine
            </Link>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-white font-semibold text-xs tracking-wider uppercase transition"
              >
                Go to Hangar
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs tracking-wider uppercase rounded-lg shadow-lg shadow-cyan-500/10 transition"
              >
                Sync Pilot
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center relative z-10 max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Text Content */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* AI telemetric badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/40 border border-cyan-800/40 rounded-full text-cyan-400 text-[10px] font-bold tracking-widest uppercase mb-6 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              Gemini-2.0 Telemetry Uplink Active
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
              ENGINEER THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                PERFECT FLIGHT
              </span>
            </h1>

            <p className="text-slate-400 text-base md:text-lg max-w-2xl leading-relaxed mb-8">
              Configure, simulate, and validate custom FPV quadcopters. Compute AUW, TWR, propeller tip speeds, and thermal margins in real time. Get instant feedback on mechanical compatibilities and consult our streaming AI Advisor.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-extrabold text-sm rounded-xl tracking-wider uppercase shadow-xl shadow-cyan-500/15 transition flex items-center justify-center gap-2 group cursor-pointer"
              >
                Enter Advanced Hangar
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/wizard"
                className="px-8 py-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-sm rounded-xl tracking-wider uppercase transition flex items-center justify-center gap-2 cursor-pointer"
              >
                Launch Guided Wizard
              </Link>
            </div>
          </div>
          {/* Graphical Specs Block */}
          <div className="lg:col-span-5 relative flex justify-center">
            {/* Glass panel displaying mock telemetry */}
            <div className="w-full max-w-[380px] p-6 bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl relative glow-cyan flex flex-col items-center">
              <div className="w-28 h-28 mb-6 relative flex items-center justify-center">
                <img src="/logo.svg" alt="FPV Hangar Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(6,182,212,0.35)] animate-pulse" />
              </div>
              <div className="w-full flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Telemetry Projections
                </span>
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              </div>

              <div className="w-full space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Thrust-to-Weight (TWR)</span>
                    <span className="text-cyan-400 font-bold">5.8 : 1</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                    <div className="bg-cyan-500 h-full w-[65%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Prop Tip Speed</span>
                    <span className="text-amber-500 font-bold">0.72 Mach</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                    <div className="bg-amber-500 h-full w-[72%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">All-Up Weight (AUW)</span>
                    <span className="text-slate-200 font-bold">242.5g</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900 relative">
                    <div className="bg-cyan-500 h-full w-[48%]" />
                    <div className="absolute right-[50%] top-0 w-0.5 h-full bg-rose-500/70" />
                  </div>
                  <span className="text-[9px] text-rose-400/80 mt-1 block">Sub-250g Regulatory Threshold</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Section */}
      <section className="border-t border-slate-900 bg-slate-950/80 py-16 relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-xl">
            <div className="w-10 h-10 bg-cyan-950 border border-cyan-800/40 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Simulate Physics</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Leverage empirical test stand data or physics models to project maximum thrust, flight profiles, and ESC thermals.
            </p>
          </div>

          <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-xl">
            <div className="w-10 h-10 bg-indigo-950 border border-indigo-800/40 rounded-lg flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Rule-Based Auditing</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Thirteen automatic safety checks ensure propellers fit frames, mount patterns align, and voltage constraints are honored.
            </p>
          </div>

          <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-xl">
            <div className="w-10 h-10 bg-purple-950 border border-purple-800/40 rounded-lg flex items-center justify-center mb-4">
              <Copy className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Community Matrix</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Star-rate public configurations, clone builds to your hangar with one click, or compare up to 4 builds side-by-side.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 relative z-10 bg-slate-950">
        &copy; {new Date().getFullYear()} FPV Drone Builder Hangar. All rights reserved.
      </footer>
    </div>
  );
}
