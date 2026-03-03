"use client";
import { ReactNode } from "react";

type BadgeColor =
  | "amber"
  | "green"
  | "red"
  | "blue"
  | "purple"
  | "yellow"
  | "teal"
  | "orange"
  | "slate"
  | "emerald";

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  className?: string;
  dot?: boolean;
}

const colorClasses: Record<BadgeColor, string> = {
  amber: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
  green: "bg-green-500/15 text-green-400 ring-1 ring-green-500/30",
  red: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  blue: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  purple: "bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30",
  yellow: "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
  teal: "bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30",
  orange: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30",
  slate: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
  emerald: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
};

function Badge({ children, color = "slate", className = "", dot = false }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${colorClasses[color]}
        ${className}
      `.trim()}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
}

export { Badge, colorClasses };
export type { BadgeProps, BadgeColor };
