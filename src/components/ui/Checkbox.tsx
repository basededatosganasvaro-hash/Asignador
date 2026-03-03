"use client";
import { forwardRef, InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <label className={`inline-flex items-center gap-2 cursor-pointer select-none ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          className="
            w-4 h-4 rounded border-slate-700 bg-slate-800/50
            text-amber-500 focus:ring-amber-500/40 focus:ring-2
            cursor-pointer
          "
          {...props}
        />
        {label && (
          <span className="text-sm text-slate-300">{label}</span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
export { Checkbox };
export type { CheckboxProps };
