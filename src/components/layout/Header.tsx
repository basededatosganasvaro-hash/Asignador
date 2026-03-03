"use client";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DRAWER_COLLAPSED } from "./Sidebar";

const rolLabels: Record<string, { label: string; color: "purple" | "blue" | "green" | "amber" | "orange" | "slate" }> = {
  admin: { label: "Admin", color: "purple" },
  gerente_regional: { label: "Gerente Regional", color: "orange" },
  gerente_sucursal: { label: "Gerente Sucursal", color: "blue" },
  supervisor: { label: "Supervisor", color: "blue" },
  promotor: { label: "Promotor", color: "green" },
  gestor_operaciones: { label: "Operaciones", color: "amber" },
  comercial: { label: "Comercial", color: "slate" },
  direccion: { label: "Dirección", color: "slate" },
};

export default function Header() {
  const { data: session } = useSession();
  const rol = session?.user?.rol || "";
  const rolInfo = rolLabels[rol] || { label: rol, color: "slate" as const };

  return (
    <header
      className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-slate-800/60 px-8 py-3"
      style={{ marginLeft: DRAWER_COLLAPSED }}
    >
      <div className="flex items-center justify-end gap-4">
        <Badge color={rolInfo.color}>{rolInfo.label}</Badge>
        <span className="text-sm text-slate-400">
          {session?.user?.nombre || session?.user?.name}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400
                     hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800/50"
        >
          <LogOut className="w-4 h-4" />
          Salir
        </button>
      </div>
    </header>
  );
}
