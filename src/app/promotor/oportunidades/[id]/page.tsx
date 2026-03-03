"use client";
import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, MessageCircle, Smartphone, Clock, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Divider } from "@/components/ui/Divider";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface Transicion {
  id: number;
  nombre_accion: string;
  requiere_nota: boolean;
  requiere_supervisor: boolean;
  devuelve_al_pool: boolean;
  etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
}

interface HistorialEntry {
  id: number;
  tipo: string;
  canal: string | null;
  nota: string | null;
  created_at: string;
  usuario: { id: number; nombre: string; rol: string };
  etapa_anterior: { id: number; nombre: string; color: string } | null;
  etapa_nueva: { id: number; nombre: string; color: string } | null;
}

interface OportunidadDetalle {
  id: number;
  cliente_id: number;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  activo: boolean;
  cliente: {
    nombres: string;
    tel_1?: string | null;
    tel_2?: string | null;
    curp?: string | null;
    rfc?: string | null;
    num_empleado?: string | null;
    convenio?: string | null;
    estado?: string | null;
    municipio?: string | null;
    oferta?: string | null;
  };
  transiciones: Transicion[];
  historial: HistorialEntry[];
}

const CANAL_ICONS: Record<string, React.ReactNode> = {
  LLAMADA: <Phone className="w-4 h-4" />,
  WHATSAPP: <WhatsAppIcon className="w-4 h-4" />,
  SMS: <Smartphone className="w-4 h-4" />,
};

function Confetti({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
      <Card className="p-8 text-center max-w-[360px]">
        <Trophy className="w-16 h-16 text-yellow-400 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-100 mt-4">Venta registrada!</h2>
        <p className="text-slate-500 mt-2">Felicitaciones, la venta fue guardada exitosamente.</p>
        <Button variant="primary" fullWidth className="mt-6" onClick={onClose}>Continuar</Button>
      </Card>
    </div>
  );
}

export default function OportunidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<OportunidadDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const { toast } = useToast();

  // Dialog estado
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransicion, setSelectedTransicion] = useState<Transicion | null>(null);
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");
  const [numOperacion, setNumOperacion] = useState("");
  const [saving, setSaving] = useState(false);

  // Edicion de datos de contacto
  const [editTel, setEditTel] = useState("");
  const [editTelOpen, setEditTelOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/oportunidades/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenTransicion = (t: Transicion) => {
    setSelectedTransicion(t);
    setCanal("");
    setNota("");
    setNumOperacion("");
    setDialogOpen(true);
  };

  const handleExecuteTransicion = async () => {
    if (!selectedTransicion) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/oportunidades/${id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transicion_id: selectedTransicion.id,
          canal: canal || undefined,
          nota: nota || undefined,
          num_operacion: numOperacion || undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setDialogOpen(false);
        if (result.confetti) {
          setConfetti(true);
        } else if (result.devuelta_al_pool) {
          toast("Oportunidad devuelta al pool", "success");
          setTimeout(() => router.push("/promotor/oportunidades"), 1500);
        } else {
          toast("Etapa actualizada", "success");
          fetchData();
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Error al ejecutar" }));
        toast(err.error || "Error al ejecutar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditTel = async () => {
    try {
      const res = await fetch(`/api/clientes/${data!.cliente_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tel_1: editTel }),
      });
      if (res.ok) {
        setEditTelOpen(false);
        toast("Telefono actualizado", "success");
        fetchData();
      } else {
        const err = await res.json().catch(() => ({ error: "Error al guardar" }));
        toast(err.error || "Error al guardar telefono", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
  };

  if (loading) return <div className="flex justify-center mt-16"><Spinner /></div>;
  if (!data) return <Alert variant="error">No se encontro la oportunidad</Alert>;

  const esVenta = selectedTransicion?.etapa_destino?.tipo === "FINAL" && selectedTransicion?.etapa_destino?.nombre === "Venta";
  const timerVencido = data.timer_vence && new Date(data.timer_vence) < new Date();

  return (
    <div>
      {confetti && <Confetti onClose={() => { setConfetti(false); router.push("/promotor/oportunidades"); }} />}

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/promotor/oportunidades")}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-100">Oportunidad #{data.id}</h1>
        {data.etapa && (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: data.etapa.color }}
          >
            {data.etapa.nombre}
          </span>
        )}
        {timerVencido && <Badge color="red">Timer vencido</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card datos del cliente */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Datos del Cliente</h2>
          <div className="flex flex-col gap-3">
            <Row label="Nombre" value={data.cliente.nombres} />
            <Row label="Convenio" value={data.cliente.convenio} />
            <Row label="Estado / Municipio" value={`${data.cliente.estado ?? "—"} / ${data.cliente.municipio ?? "—"}`} />
            <Row label="Oferta" value={data.cliente.oferta} />
            <Divider />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Tel 1</p>
                <p className="text-sm text-slate-200">{data.cliente.tel_1 ?? <em className="text-slate-600">Sin telefono</em>}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setEditTel(data.cliente.tel_1 ?? ""); setEditTelOpen(true); }}>Editar</Button>
            </div>
            <Row label="CURP" value={data.cliente.curp} />
            <Row label="RFC" value={data.cliente.rfc} />
            <Row label="Num. Empleado" value={data.cliente.num_empleado} />
          </div>
        </Card>

        {/* Card acciones del embudo */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">Acciones</h2>
          {data.timer_vence && (
            <div className={`flex items-center gap-1 mb-4 ${timerVencido ? "text-red-400" : "text-slate-500"}`}>
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                {timerVencido ? "Timer vencido" : `Vence: ${new Date(data.timer_vence).toLocaleString("es-MX")}`}
              </span>
            </div>
          )}
          {data.activo && data.transiciones.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.transiciones.map((t) => (
                <button
                  key={t.id}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                    t.devuelve_al_pool
                      ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                      : t.etapa_destino?.tipo === "FINAL"
                        ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                        : "border-slate-700 text-slate-300 hover:bg-surface-hover"
                  }`}
                  onClick={() => handleOpenTransicion(t)}
                >
                  <span>{t.nombre_accion}</span>
                  {t.etapa_destino && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: t.etapa_destino.color }}
                    >
                      {t.etapa_destino.nombre}
                    </span>
                  )}
                  {t.devuelve_al_pool && <Badge color="slate">Pool</Badge>}
                </button>
              ))}
            </div>
          ) : (
            <Alert variant="info" className="mt-2">
              {!data.activo ? "Esta oportunidad ya no esta activa." : "No hay acciones disponibles para esta etapa."}
            </Alert>
          )}
        </Card>

        {/* Historial */}
        <div className="md:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Historial</h2>
            {data.historial.length === 0 ? (
              <p className="text-slate-500">Sin historial aun.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.historial.map((entry) => (
                  <div key={entry.id} className="flex gap-3 items-start">
                    <div className="text-slate-500 mt-0.5">{entry.canal ? CANAL_ICONS[entry.canal] : null}</div>
                    <div className="flex-1">
                      <div className="flex gap-2 items-center flex-wrap">
                        {entry.etapa_anterior && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: entry.etapa_anterior.color }}
                          >
                            {entry.etapa_anterior.nombre}
                          </span>
                        )}
                        {entry.etapa_anterior && entry.etapa_nueva && <span className="text-xs text-slate-600">-&gt;</span>}
                        {entry.etapa_nueva && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: entry.etapa_nueva.color }}
                          >
                            {entry.etapa_nueva.nombre}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">{entry.tipo}</span>
                      </div>
                      {entry.nota && <p className="text-sm text-slate-300 mt-1">{entry.nota}</p>}
                      <p className="text-xs text-slate-500">
                        {entry.usuario.nombre} · {new Date(entry.created_at).toLocaleString("es-MX")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Dialog ejecutar transicion */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {selectedTransicion?.nombre_accion}
        </DialogHeader>
        <DialogBody>
          {selectedTransicion?.etapa_destino && (
            <div className="mb-4">
              <p className="text-sm text-slate-500">
                Pasara a:{" "}
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white ml-1"
                  style={{ backgroundColor: selectedTransicion.etapa_destino.color }}
                >
                  {selectedTransicion.etapa_destino.nombre}
                </span>
              </p>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Select
              label="Canal de contacto"
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              options={[
                { value: "LLAMADA", label: "Llamada" },
                { value: "WHATSAPP", label: "WhatsApp" },
                { value: "SMS", label: "SMS" },
              ]}
              placeholder="Sin canal"
            />
            {selectedTransicion?.requiere_nota && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nota (requerida)</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all resize-none"
                  rows={3}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  required
                />
              </div>
            )}
            {esVenta && (
              <Input
                label="Numero de operacion"
                value={numOperacion}
                onChange={(e) => setNumOperacion(e.target.value)}
                required
              />
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="danger" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant={selectedTransicion?.devuelve_al_pool ? "danger" : "primary"}
            onClick={handleExecuteTransicion}
            loading={saving}
            disabled={saving || (selectedTransicion?.requiere_nota && !nota.trim()) || (esVenta && !numOperacion.trim())}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog editar telefono */}
      <Dialog open={editTelOpen} onClose={() => setEditTelOpen(false)} maxWidth="sm">
        <DialogHeader onClose={() => setEditTelOpen(false)}>
          Editar Telefono
        </DialogHeader>
        <DialogBody>
          <Input
            label="Tel 1"
            value={editTel}
            onChange={(e) => setEditTel(e.target.value)}
            autoFocus
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="danger" onClick={() => setEditTelOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleEditTel}>Guardar</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-200">{value ?? "—"}</p>
    </div>
  );
}
