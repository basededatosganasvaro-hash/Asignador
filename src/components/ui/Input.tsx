"use client";
import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, fullWidth = true, className = "", ...props }, ref) => {
    return (
      <div className={fullWidth ? "w-full" : ""}>
        {label && (
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="w-4 h-4 text-slate-600">{icon}</span>
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full px-3 py-2 bg-slate-800/50 border text-slate-200
              placeholder-slate-600 rounded-lg text-sm
              focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60
              outline-none transition-all
              ${icon ? "pl-10" : ""}
              ${error ? "border-red-500/60" : "border-slate-700"}
              ${className}
            `.trim()}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-600">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
export type { InputProps };
