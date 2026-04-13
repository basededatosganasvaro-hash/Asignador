"use client";
import { useState } from "react";
import Sidebar, { DRAWER_COLLAPSED } from "./Sidebar";
import Header from "./Header";

export default function LayoutShell({ rol, children }: { rol: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((p) => !p);

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar rol={rol} open={open} onToggle={toggle} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ marginLeft: DRAWER_COLLAPSED }}>
        <Header />
        <main className="flex-1 p-6 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
