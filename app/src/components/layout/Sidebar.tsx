"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Disc,
  LayoutDashboard,
  PlusCircle,
  FolderHeart,
  Grid,
  GitCompare,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export default function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const roles = session?.user?.roles || [];

  const isAdmin = roles.includes("system_admin") || roles.includes("metadata_admin");

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "New Build", href: "/dashboard?new=true", icon: PlusCircle },
    { name: "Public Gallery", href: "/gallery", icon: Grid },
    { name: "Compare Engine", href: "/compare", icon: GitCompare },
    { name: "Profile", href: "/profile", icon: User },
  ];

  if (isAdmin) {
    navItems.push({ name: "Admin Portal", href: "/admin/parts", icon: Settings });
  }

  const handleSignOut = () => {
    toast.promise(signOut({ callbackUrl: "/" }), {
      loading: "Logging out and unlinking session...",
      success: "Logged out successfully. Safe flying!",
      error: "Error signing out.",
    });
  };

  return (
    <aside
      className={`bg-slate-950/80 border-r border-slate-900 flex flex-col transition-all duration-300 relative z-20 backdrop-blur-md ${collapsed ? "w-16" : "w-64"
        }`}
    >
      {/* Brand Logo Header */}
      <div className="h-16 border-b border-slate-900 flex items-center px-4 justify-between overflow-hidden">
        <Link href="/" className="flex items-center gap-2.5 outline-none">
          <div className="w-8 h-8 min-w-8 flex items-center justify-center">
            <img src="/logo.svg" alt="FPV Hangar" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <span className="font-extrabold text-xs tracking-widest text-white uppercase whitespace-nowrap">
              FPV Hangar
            </span>
          )}
        </Link>

        {/* Collapse button */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition outline-none cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3.5 top-20 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white p-1 rounded-full shadow-lg transition z-30 outline-none cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && (item.href !== "/dashboard" || pathname === "/dashboard");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition outline-none cursor-pointer ${isActive
                  ? "bg-cyan-950/40 text-cyan-400 border border-cyan-800/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/50 border border-transparent"
                }`}
            >
              <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-3 border-t border-slate-900 space-y-2">
        {!collapsed && session?.user && (
          <div className="px-3 py-2 bg-slate-900/30 rounded-lg border border-slate-900">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pilot Profile</p>
            <p className="text-xs font-semibold text-white truncate">{session.user.name || "Telemetry User"}</p>
            <p className="text-[9px] text-slate-400 truncate mt-0.5">{session.user.email}</p>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-rose-400 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-rose-950/10 transition outline-none text-left cursor-pointer"
        >
          <LogOut className="w-4.5 h-4.5 text-slate-500 shrink-0 hover:text-rose-400" />
          {!collapsed && <span>Sync Terminate</span>}
        </button>
      </div>
    </aside>
  );
}
