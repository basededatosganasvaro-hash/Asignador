"use client";

interface DividerProps {
  className?: string;
  label?: string;
}

function Divider({ className = "", label }: DividerProps) {
  if (label) {
    return (
      <div className={`flex items-center gap-3 my-3 ${className}`}>
        <div className="flex-1 h-px bg-slate-800/40" />
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
          {label}
        </span>
        <div className="flex-1 h-px bg-slate-800/40" />
      </div>
    );
  }

  return <div className={`h-px bg-slate-800/40 my-3 ${className}`} />;
}

export { Divider };
