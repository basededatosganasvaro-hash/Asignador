"use client";
import { Fragment, ReactNode } from "react";
import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  width?: string;
  side?: "left" | "right";
}

function Drawer({
  open,
  onClose,
  children,
  title,
  width = "w-[480px]",
  side = "right",
}: DrawerProps) {
  const isRight = side === "right";

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[90]">
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

        <div className="fixed inset-0 overflow-hidden">
          <div className={`absolute inset-y-0 ${isRight ? "right-0" : "left-0"} flex`}>
            <TransitionChild
              as={Fragment}
              enter="transform transition ease-out duration-300"
              enterFrom={isRight ? "translate-x-full" : "-translate-x-full"}
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-200"
              leaveFrom="translate-x-0"
              leaveTo={isRight ? "translate-x-full" : "-translate-x-full"}
            >
              <DialogPanel
                className={`${width} max-w-full bg-elevated border-l border-slate-700/60 shadow-2xl shadow-black/50 flex flex-col h-full`}
              >
                {title && (
                  <div className="px-6 py-4 border-b border-slate-800/40 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
                    <button
                      onClick={onClose}
                      className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800/50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export { Drawer };
export type { DrawerProps };
