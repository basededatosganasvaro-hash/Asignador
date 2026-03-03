"use client";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  noPadding?: boolean;
}

function Card({ children, className = "", glow = false, noPadding = false }: CardProps) {
  return (
    <div
      className={`
        bg-surface rounded-xl border border-slate-800/60
        ${noPadding ? "" : "p-5"}
        ${glow ? "card-glow" : ""}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`px-5 py-4 border-b border-slate-800/40 ${className}`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`border-t border-slate-800/40 px-5 py-3 bg-slate-900/30 flex items-center justify-end gap-2 ${className}`}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardFooter };
export type { CardProps };
