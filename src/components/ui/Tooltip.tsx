"use client";
import { useState, ReactNode, useRef } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShow(true), 200);
      }}
      onMouseLeave={() => {
        clearTimeout(timeoutRef.current);
        setShow(false);
      }}
    >
      {children}
      {show && (
        <div
          className={`
            absolute z-50 px-2.5 py-1.5 text-xs font-medium
            bg-slate-900 text-slate-200 rounded-lg border border-slate-700
            shadow-lg shadow-black/30 whitespace-nowrap pointer-events-none
            animate-fade-in
            ${positionClasses[position]}
          `.trim()}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export { Tooltip };
export type { TooltipProps };
