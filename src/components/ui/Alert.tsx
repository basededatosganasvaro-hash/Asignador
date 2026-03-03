"use client";
import { ReactNode } from "react";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  onClose?: () => void;
}

const variantClasses: Record<AlertVariant, string> = {
  info: "bg-blue-500/10 border-blue-500/20 text-blue-300",
  success: "bg-green-500/10 border-green-500/20 text-green-300",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-300",
  error: "bg-red-500/10 border-red-500/20 text-red-300",
};

function Alert({ variant = "info", children, className = "", icon, onClose }: AlertProps) {
  return (
    <div
      className={`
        flex items-start gap-2 px-3 py-2 border rounded-lg text-sm
        ${variantClasses[variant]}
        ${className}
      `.trim()}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 p-0.5 hover:opacity-70 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export { Alert };
export type { AlertProps, AlertVariant };
