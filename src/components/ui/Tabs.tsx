"use client";
import { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

function Tabs({ tabs, activeTab, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800/40 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
            transition-all whitespace-nowrap
            ${
              activeTab === tab.id
                ? "font-semibold bg-surface shadow-sm text-amber-400"
                : "font-medium text-slate-500 hover:text-slate-300"
            }
          `.trim()}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`
                text-xs px-1.5 py-0.5 rounded-full
                ${activeTab === tab.id ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-500"}
              `.trim()}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export { Tabs };
export type { TabsProps, Tab };
