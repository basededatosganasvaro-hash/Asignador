"use client";
import { Fragment, ReactNode } from "react";
import { Dialog as HeadlessDialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

function Dialog({ open, onClose, children, maxWidth = "lg", className = "" }: DialogProps) {
  return (
    <Transition show={open} as={Fragment}>
      <HeadlessDialog onClose={onClose} className="relative z-[90]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              className={`
                bg-elevated rounded-2xl border border-slate-700/60
                shadow-2xl shadow-black/50 w-full ${maxWidthClasses[maxWidth]}
                relative max-h-[85vh] overflow-y-auto
                ${className}
              `.trim()}
            >
              {children}
            </DialogPanel>
          </TransitionChild>
        </div>
      </HeadlessDialog>
    </Transition>
  );
}

interface DialogHeaderProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

function DialogHeader({ children, onClose, className = "" }: DialogHeaderProps) {
  return (
    <div
      className={`sticky top-0 bg-elevated border-b border-slate-800/40 px-6 py-4 flex justify-between items-center rounded-t-2xl z-10 ${className}`}
    >
      <DialogTitle as="h3" className="text-lg font-semibold text-slate-100">
        {children}
      </DialogTitle>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800/50"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

function DialogBody({ children, className = "" }: DialogBodyProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

function DialogFooter({ children, className = "" }: DialogFooterProps) {
  return (
    <div
      className={`sticky bottom-0 bg-surface border-t border-slate-800/40 px-6 py-3 flex justify-end gap-2 rounded-b-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export { Dialog, DialogHeader, DialogBody, DialogFooter };
export type { DialogProps };
