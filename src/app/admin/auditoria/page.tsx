"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { ShieldAlert, Download, ChevronLeft, ChevronRight, RefreshCcw, Search, Filter, AlertTriangle, User } from "lucide-react";

interface AuditRow {
  id: string | number;
  usuario_id: number | null;
  username: string | null;
  rol: string | null;
  accion: string;
  recurso_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Kpis {
  total: number;
  usuariosUnicos: number;
  porAccion: { accion: string; total: number }[];
  sospechosos: { usuario_id: number; username: string | null; eventos: number }[];
}

const ACCIONES: { value: string; label: string }[] = [
  { value: "login", label: "Login" },
  { value: "login_fallido", label: "Login fallido" },
  { value: "view_oportunidad", label: "Ver oportunidad" },
  { value: "view_cliente", label: "Ver cliente" },
  { value: "view_lote", label: "Ver lote" },
  { value: "view_auditoria", label: "Ver auditoría" },
  { value: "solicitar_asignacion", label: "Solicitar asignación" },
  { value: "liberar_lote", label: "Liberar lote" },
  { value: "calificar_cliente", label: "Calificar cliente" },
  { value: "editar_cliente", label: "Editar cliente" },
  { value: "export_excel", label: "Export Excel" },
  { value: "reasignar_cliente", label: "Reasignar cliente" },
  { value: "crear_usuario", label: "Crear usuario" },
  { value: "editar_usuario", label: "Editar usuario" },
  { value: "eliminar_usuario", label: "Eliminar usuario" },
];

function accionColor(accion: string): "green" | "red" | "amber" | "blue" | "slate" {
  if (accion === "login_fallido") return "red";
  if (accion === "login") return "green";
  if (accion.startsWith("view_")) return "slate";
  if (accion === "export_excel") return "amber";
  if (accion.startsWith("editar_") || accion.startsWith("eliminar_") || accion.startsWith("reasignar")) return "amber";
  return "blue";
}

function defaultDesde(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}
function defaultHasta(): string {
  return new Date().toISOString().split("T")[0];
}

export default function AuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [filtros, setFiltros] = useState({
    search: "",
    accion: "",
    usuario_id: "",
    desde: defaultDesde(),
    hasta: defaultHasta(),
    recurso_id: "",
  });
  const [detalle, setDetalle] = useState<AuditRow | null>(null);
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (filtros.search) p.set("search", filtros.search);
    if (filtros.accion) p.set("accion", filtros.accion);
    if (filtros.usuario_id) p.set("usuario_id", filtros.usuario_id);
    if (filtros.desde) p.set("desde", filtros.desde);
    if (filtros.hasta) p.set("hasta", filtros.hasta);
    if (filtros.recurso_id) p.set("recurso_id", filtros.recurso_id);
    return p.toString();
  }, [page, filtros]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, kpiRes] = await Promise.all([
        fetch(`/api/admin/auditoria?${qs}`),
        fetch(`/api/admin/auditoria/kpis?desde=${filtros.desde}&hasta=${filtros.hasta}`),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setRows(data.items);
        setTotal(data.total);
      } else {
        toast("Error al cargar auditoría", "error");
      }
      if (kpiRes.ok) setKpis(await kpiRes.json());
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setLoading(false);
    }
  }, [qs, filtros.desde, filtros.hasta, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    const p = new URLSearchParams();
    if (filtros.accion) p.set("accion", filtros.accion);
    if (filtros.usuario_id) p.set("usuario_id", filtros.usuario_id);
    if (filtros.desde) p.set("desde", filtros.desde);
    if (filtros.hasta) p.set("hasta", filtros.hasta);
    window.location.href = `/api/admin/auditoria/export?${p.toString()}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
          <h1 className="font-display text-xl font-bold text-slate-100">Auditoría</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={fetchData} disabled={loading}>
            <RefreshCcw className="w-4 h-4" /> Actualizar
          </Button>
          <Button variant="primary" onClick={handleExport}>
            <Download className="w-4 h-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          label="Total eventos"
          value={kpis?.total ?? "—"}
          sub={`${filtros.desde} → ${filtros.hasta}`}
        />
        <KpiCard
          label="Usuarios únicos"
          value={kpis?.usuariosUnicos ?? "—"}
          color="text-blue-400"
        />
        <KpiCard
          label="Acción top"
          value={kpis?.porAccion[0]?.accion ?? "—"}
          sub={kpis?.porAccion[0] ? `${kpis.porAccion[0].total} eventos` : ""}
          color="text-emerald-400"
        />
        <KpiCard
          label="Alertas"
          value={kpis?.sospechosos.length ?? 0}
          sub={(kpis?.sospechosos.length ?? 0) > 0 ? "Picos >100/hora" : "Sin alertas"}
          color={(kpis?.sospechosos.length ?? 0) > 0 ? "text-red-400" : "text-slate-400"}
        />
      </div>

      {/* Alertas destacadas */}
      {kpis && kpis.sospechosos.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-sm font-semibold text-red-300">Actividad sospechosa en el rango</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {kpis.sospechosos.map((s, i) => (
              <Link
                key={i}
                href={`/admin/auditoria/usuario/${s.usuario_id}`}
                className="px-3 py-1 rounded-md text-xs bg-red-500/15 border border-red-500/30 text-red-200 hover:bg-red-500/25"
              >
                {s.username ?? `Usuario ${s.usuario_id}`} — {s.eventos} vistas/hora
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-3 text-slate-400 text-sm">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Buscar username, recurso, acción..."
              value={filtros.search}
              onChange={(e) => { setPage(1); setFiltros((f) => ({ ...f, search: e.target.value })); }}
            />
          </div>
          <Select
            value={filtros.accion}
            onChange={(e) => { setPage(1); setFiltros((f) => ({ ...f, accion: e.target.value })); }}
            options={ACCIONES}
            placeholder="Todas las acciones"
          />
          <Input
            type="date"
            value={filtros.desde}
            onChange={(e) => { setPage(1); setFiltros((f) => ({ ...f, desde: e.target.value })); }}
          />
          <Input
            type="date"
            value={filtros.hasta}
            onChange={(e) => { setPage(1); setFiltros((f) => ({ ...f, hasta: e.target.value })); }}
          />
          <Input
            placeholder="Recurso ID"
            value={filtros.recurso_id}
            onChange={(e) => { setPage(1); setFiltros((f) => ({ ...f, recurso_id: e.target.value })); }}
          />
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-slate-500">Sin eventos en el rango.</div>
      ) : (
        <div className="overflow-x-auto border border-slate-800/60 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Fecha/hora</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Rol</th>
                <th className="px-3 py-2 text-left">Acción</th>
                <th className="px-3 py-2 text-left">Recurso</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-t border-slate-800/40 hover:bg-slate-900/30">
                  <td className="px-3 py-2 font-mono text-xs text-slate-300">
                    {new Date(r.created_at).toLocaleString("es-MX")}
                  </td>
                  <td className="px-3 py-2">
                    {r.usuario_id ? (
                      <Link href={`/admin/auditoria/usuario/${r.usuario_id}`} className="text-amber-400 hover:underline flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {r.username ?? `#${r.usuario_id}`}
                      </Link>
                    ) : (
                      <span className="text-slate-500">{r.username ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{r.rol ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge color={accionColor(r.accion)}>{r.accion}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-300">{r.recurso_id ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.ip ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setDetalle(r)} className="text-xs text-blue-400 hover:underline">
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate-400">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total.toLocaleString()}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-1.5">Página {page} / {totalPages}</span>
            <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de detalle */}
      {detalle && (
        <Dialog open onClose={() => setDetalle(null)} maxWidth="lg">
          <DialogHeader onClose={() => setDetalle(null)}>Detalle del evento</DialogHeader>
          <DialogBody>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Field label="ID" value={String(detalle.id)} mono />
              <Field label="Fecha/hora" value={new Date(detalle.created_at).toLocaleString("es-MX")} />
              <Field label="Usuario" value={detalle.username ? `${detalle.username} (#${detalle.usuario_id})` : "—"} />
              <Field label="Rol" value={detalle.rol ?? "—"} />
              <Field label="Acción" value={detalle.accion} />
              <Field label="Recurso ID" value={detalle.recurso_id ?? "—"} mono />
              <Field label="IP" value={detalle.ip ?? "—"} mono />
              <Field label="User-Agent" value={detalle.user_agent ?? "—"} mono small />
            </dl>
            {detalle.metadata && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Metadata</p>
                <pre className="bg-slate-900/60 border border-slate-800/60 rounded p-3 text-xs overflow-auto text-slate-200">
                  {JSON.stringify(detalle.metadata, null, 2)}
                </pre>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetalle(null)}>Cerrar</Button>
            {detalle.recurso_id && (
              <Link href={`/admin/auditoria/cliente/${detalle.recurso_id}`}>
                <Button variant="primary">Ver historial del recurso</Button>
              </Link>
            )}
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color = "text-slate-100" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Field({ label, value, mono = false, small = false }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className={`${mono ? "font-mono" : ""} ${small ? "text-xs" : ""} text-slate-200 break-all`}>{value}</dd>
    </div>
  );
}
