import React from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export interface BuildWarning {
  warningCode: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestedFix?: string;
}

export interface BuildWarningsPanelProps {
  warnings: BuildWarning[];
}

export default function BuildWarningsPanel({ warnings }: BuildWarningsPanelProps) {
  if (warnings.length === 0) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-emerald-500/20 p-6 rounded-2xl flex flex-col items-center justify-center text-center select-none">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
        <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
          Build Fully Compatible
        </span>
        <span className="text-[11px] text-slate-400 max-w-[280px] mt-1 leading-normal">
          All validation checks (W-01 through W-13) passed successfully! No mounting mismatches or safety warnings detected.
        </span>
      </div>
    );
  }

  // Sort warnings: error first, then warning, then info
  const sortedWarnings = [...warnings].sort((a, b) => {
    const priority = { error: 0, warning: 1, info: 2 };
    return priority[a.severity] - priority[b.severity];
  });

  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-5 rounded-2xl flex flex-col relative select-none">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Validation Dashboard
          </span>
          <span className="text-xs font-semibold text-slate-300 mt-0.5">
            {warnings.length} Active System Alerts
          </span>
        </div>
        
        {/* Quick summary badges */}
        <div className="flex gap-1.5">
          {warnings.some((w) => w.severity === "error") && (
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md">
              Error
            </span>
          )}
          {warnings.some((w) => w.severity === "warning") && (
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md">
              Warning
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {sortedWarnings.map((warning, index) => {
          let severityStyles = {
            bg: "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/30",
            icon: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
            badge: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
          };

          if (warning.severity === "warning") {
            severityStyles = {
              bg: "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30",
              icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
              badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
            };
          } else if (warning.severity === "info") {
            severityStyles = {
              bg: "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/30",
              icon: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
              badge: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
            };
          }

          return (
            <div
              key={index}
              className={`flex flex-col p-3 rounded-xl border ${severityStyles.bg} transition-colors duration-200`}
            >
              <div className="flex items-start gap-2.5">
                {severityStyles.icon}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1 py-0.2 rounded ${severityStyles.badge}`}>
                      {warning.warningCode}
                    </span>
                    <span className="text-[11px] font-bold text-slate-200">
                      {warning.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {warning.message}
                  </p>
                </div>
              </div>

              {warning.suggestedFix && (
                <div className="mt-2 ml-6.5 pl-2.5 border-l border-slate-800 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">Suggested Fix: </span>
                  {warning.suggestedFix}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
