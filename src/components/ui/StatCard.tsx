"use client";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: "amber" | "blue" | "green" | "red" | "purple" | "teal" | "orange" | "slate";
  className?: string;
}

const colorMap: Record<string, { bg: string; text: string; ring: string; gradient: string }> = {
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/20", gradient: "from-amber-500 to-amber-600" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", ring: "ring-blue-500/20", gradient: "from-blue-500 to-blue-600" },
  green: { bg: "bg-green-500/10", text: "text-green-400", ring: "ring-green-500/20", gradient: "from-green-500 to-green-600" },
  red: { bg: "bg-red-500/10", text: "text-red-400", ring: "ring-red-500/20", gradient: "from-red-500 to-red-600" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", ring: "ring-purple-500/20", gradient: "from-purple-500 to-purple-600" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-400", ring: "ring-teal-500/20", gradient: "from-teal-500 to-teal-600" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", ring: "ring-orange-500/20", gradient: "from-orange-500 to-orange-600" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-400", ring: "ring-slate-500/20", gradient: "from-slate-500 to-slate-600" },
};

export default function StatCard({ title, value, subtitle, icon, color = "amber", className = "" }: StatCardProps) {
  const c = colorMap[color] || colorMap.amber;

  return (
    <div
      className={`bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden card-glow ${className}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${c.gradient}`} />
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          <p className="font-display text-3xl font-extrabold text-slate-100 mt-1">
            {value}
          </p>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <span
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg} ${c.text} ring-1 ${c.ring}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

export type { StatCardProps };
