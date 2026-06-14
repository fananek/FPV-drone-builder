"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { useSession } from "next-auth/react";
import { AlertTriangle } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: session, status } = useSession();
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/v1/users/me")
        .then((res) => res.json())
        .then((body) => {
          if (body.data?.needsVerification) {
            setNeedsVerification(true);
          } else {
            setNeedsVerification(false);
          }
        })
        .catch((err) => console.error("Error checking verification: ", err));
    } else {
      setNeedsVerification(false);
    }
  }, [status]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Email Verification Banner */}
        {needsVerification && (
          <div className="bg-rose-950/60 backdrop-blur-md border-b border-rose-900/35 px-4 py-2.5 text-xs text-rose-300 flex items-center justify-between gap-3 z-30 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-450 shrink-0 animate-bounce" />
              <span>
                <strong>Pilot Alert:</strong> Your email address is unverified. Verify your hangar coordinates to enable build saves and design uploads.
              </span>
            </div>
            <a
              href="/profile"
              className="px-2.5 py-1 bg-rose-900/30 hover:bg-rose-900/60 border border-rose-800/40 text-[10px] font-black uppercase tracking-wider rounded text-rose-300 hover:text-white transition shrink-0 cursor-pointer"
            >
              Verify Hangar
            </a>
          </div>
        )}

        {/* Background Ambient Glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-cyan-900/5 rounded-full blur-[120px] pointer-events-none z-0" />
        
        {/* Content Children */}
        <main className="flex-1 overflow-y-auto relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
