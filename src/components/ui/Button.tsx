"use client";
import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  outlineColor?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-amber-500 text-slate-950 font-medium hover:bg-amber-400 shadow-lg shadow-amber-500/20",
  secondary:
    "bg-slate-800/50 border border-slate-700 text-slate-300 font-medium hover:bg-slate-800",
  ghost:
    "text-slate-400 border border-slate-700 hover:bg-surface-hover",
  danger:
    "bg-red-600 text-white font-medium hover:bg-red-500 shadow-lg shadow-red-600/20",
  outline:
    "border border-slate-700 text-slate-300 font-medium hover:bg-surface-hover",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-6 py-2.5 text-sm gap-2 rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconRight,
      loading = false,
      fullWidth = false,
      outlineColor,
      className = "",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const outlineClasses = outlineColor
      ? `border-${outlineColor}-500/30 text-${outlineColor}-400 hover:bg-${outlineColor}-500/10`
      : "";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? "w-full" : ""}
          ${outlineColor ? outlineClasses : ""}
          ${className}
        `.trim()}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          icon
        )}
        {children}
        {iconRight}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
