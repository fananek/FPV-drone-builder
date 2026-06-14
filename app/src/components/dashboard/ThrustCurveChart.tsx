"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface ThrustCurveChartProps {
  thrustCurve: Array<{
    throttlePercent: number;
    currentAmps: number;
    thrustGrams: number;
    voltageVolts: number;
    rpm?: number;
  }>;
}

export default function ThrustCurveChart({ thrustCurve }: ThrustCurveChartProps) {
  if (!thrustCurve || thrustCurve.length === 0) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center text-center h-64 select-none">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Thrust Performance Curve
        </span>
        <span className="text-[10px] text-slate-600 max-w-[200px] leading-normal">
          No empirical thrust teststand data or motor specs available to plot thrust curve.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-5 rounded-2xl flex flex-col relative select-none h-72">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
        Thrust &amp; Current Curve
      </div>

      <div className="w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={thrustCurve}
            margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="throttlePercent"
              stroke="#64748b"
              fontSize={9}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            {/* Left Y Axis: Thrust */}
            <YAxis
              yAxisId="left"
              stroke="#06b6d4"
              fontSize={9}
              tickLine={false}
              tickFormatter={(v) => `${v}g`}
            />
            {/* Right Y Axis: Current */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#f59e0b"
              fontSize={9}
              tickLine={false}
              tickFormatter={(v) => `${v}A`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderColor: "#334155",
                borderRadius: "12px",
                fontSize: "11px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
              }}
              labelFormatter={(label) => `Throttle: ${label}%`}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={10}
              wrapperStyle={{ fontSize: "10px", paddingBottom: "10px" }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="thrustGrams"
              name="Thrust (g)"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="currentAmps"
              name="Current (A)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
