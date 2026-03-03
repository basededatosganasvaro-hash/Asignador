"use client";
import { forwardRef, SelectHTMLAttributes, ReactNode } from "react";

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, fullWidth = true, icon, className = "", ...props }, ref) => {
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
          <select
            ref={ref}
            className={`
              w-full px-3 py-2 bg-slate-800/50 border text-slate-200
              rounded-lg text-sm appearance-none
              focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60
              outline-none transition-all cursor-pointer
              ${icon ? "pl-10" : ""}
              ${error ? "border-red-500/60" : "border-slate-700"}
              ${className}
            `.trim()}
            {...props}
          >
            {placeholder && (
              <option value="" className="bg-elevated text-slate-400">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-elevated text-slate-200">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
export { Select };
export type { SelectProps, SelectOption };
