"use client";

interface LinearProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  color?: "auto" | "green" | "yellow" | "red" | "amber" | "blue";
}

function LinearProgress({
  value,
  max = 100,
  className = "",
  showLabel = false,
  color = "auto",
}: LinearProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  let barColor: string;
  if (color === "auto") {
    if (pct > 90) barColor = "bg-red-500";
    else if (pct > 70) barColor = "bg-yellow-500";
    else barColor = "bg-green-500";
  } else {
    barColor = `bg-${color}-500`;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 bg-slate-800/60 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-500 tabular-nums min-w-[3ch]">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

export { LinearProgress };
