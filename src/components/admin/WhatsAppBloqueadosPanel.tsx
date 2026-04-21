"use client";
import { useState, useEffect, useCallback } from "react";
import { Ban, Search, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

interface Bloqueado {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  numero: string;
  motivo: string | null;
  origen: string;
  bloqueado_at: string;
}

interface Data {
  items: Bloqueado[];
  total: number;
  porOrigen: { origen: string; count: number }[];
}

type BadgeColor = "red" | "amber" | "blue" | "purple" | "slate";

const ORIGEN_BADGE: Record<string, BadgeColor> = {
  MANUAL: "slate",
  OPT_OUT: "purple",
  NO_EXISTE: "amber",
  BOUNCE: "blue",
  BLOQUEADO: "red",
};

const ORIGENES = ["MANUAL", "OPT_OUT", "NO_EXISTE", "BOUNCE", "BLOQUEADO"];

function fmtDate(d: string) {
  return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

export default function WhatsAppBloqueadosPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtroOrigen, setFiltroOrigen] = useState("");
  const [search, setSearch] = useState("");
  const [nuevoNumero, setNuevoNumero] = useState("");
  const [nuevoMotivo, setNuevoMotivo] = useState("");
  const [agregando, setAgregando] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroOrigen) params.set("origen", filtroOrigen);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/whatsapp/bloqueados?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [filtroOrigen, search]);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDesbloquear = async (id: number) => {
    if (!confirm("¿Desbloquear este contacto? Podrá recibir campañas de nuevo.")) return;
    const res = await fetch(`/api/admin/whatsapp/bloqueados/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const handleAgregar = async () => {
    const numero = nuevoNumero.replace(/\D/g, "");
    if (numero.length < 8) return;
    setAgregando(true);
    try {
      const res = await fetch("/api/admin/whatsapp/bloqueados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero, motivo: nuevoMotivo || null }),
      });
      if (res.ok) {
        setNuevoNumero("");
        setNuevoMotivo("");
        fetchData();
      }
    } catch { /* ignore */ }
    setAgregando(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-800/60 p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Ban className="w-5 h-5 text-red-400" />
        <h2 className="text-sm font-semibold text-slate-100">Contactos bloqueados</h2>
        {data && (
          <span className="text-xs text-slate-500 ml-auto">
            {data.total} total
          </span>
        )}
      </div>

      {/* Stats por origen */}
      {data && data.porOrigen.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {data.porOrigen.map((o) => (
            <Badge key={o.origen} color={ORIGEN_BADGE[o.origen] || "slate"}>
              {o.origen}: {o.count}
            </Badge>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap mb-4">
        <div className="min-w-[200px]">
          <Input
            label="Buscar número"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="55..."
            fullWidth={false}
          />
        </div>
        <div className="min-w-[140px]">
          <Select
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
            options={ORIGENES.map((o) => ({ value: o, label: o }))}
            placeholder="Todos"
            label="Origen"
            fullWidth={false}
          />
        </div>
        <div className="flex items-end">
          <Button variant="primary" size="sm" icon={<Search className="w-4 h-4" />} onClick={fetchData}>
            Buscar
          </Button>
        </div>
      </div>

      {/* Agregar manual */}
      <div className="flex gap-3 flex-wrap mb-4 p-3 bg-slate-800/30 rounded-lg border border-slate-800/60">
        <div className="min-w-[180px]">
          <Input
            label="Bloquear número"
            value={nuevoNumero}
            onChange={(e) => setNuevoNumero(e.target.value)}
            placeholder="5512345678"
            fullWidth={false}
          />
        </div>
        <div className="min-w-[220px]">
          <Input
            label="Motivo (opcional)"
            value={nuevoMotivo}
            onChange={(e) => setNuevoMotivo(e.target.value)}
            placeholder="Opt-out, queja, etc."
            fullWidth={false}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            loading={agregando}
            onClick={handleAgregar}
          >
            Agregar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-lg border border-slate-800/60">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800/60">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Número</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Usuario</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Origen</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Motivo</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400">Fecha</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {!data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <span className="text-sm text-slate-400">Sin contactos bloqueados</span>
                  </td>
                </tr>
              ) : (
                data.items.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2 text-sm text-slate-300 font-mono">{b.numero}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {b.usuario_nombre ? b.usuario_nombre : <span className="italic">Global</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={ORIGEN_BADGE[b.origen] || "slate"}>{b.origen}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400 max-w-[220px] truncate">
                      {b.motivo || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(b.bloqueado_at)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDesbloquear(b.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Desbloquear"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
