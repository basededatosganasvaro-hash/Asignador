"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ColumnDef, RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { Eye, Phone, ArrowLeft, UserPlus, ClipboardList, Megaphone, RefreshCw, ChevronDown, AlertTriangle, FlaskConical, Search, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { buildWhatsAppUrl, formatPhoneForWA, WA_MENSAJES_DEFAULT } from "@/lib/whatsapp";
import CaptacionModal from "@/components/CaptacionModal";
import SolicitarAsignacionDialog from "@/components/SolicitarAsignacionDialog";
import CampanaCrearDialog from "@/components/CampanaCrearDialog";
import { useWhatsAppBeta } from "@/hooks/useWhatsAppBeta";
import { DataTable, createSelectionColumn } from "@/components/ui/DataTable";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tooltip } from "@/components/ui/Tooltip";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider, useToast } from "@/components/ui/Toast";

// ════════════════════════════════════════════
// INLINE SVG ICONS
// ════════════════════════════════════════════

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

// ════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════

interface Oportunidad {
  id: number;
  cliente_id: number | null;
  nombres: string;
  convenio: string;
  estado: string;
  municipio: string;
  tipo_cliente: string;
  tel_1: string | null;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  origen: string;
  num_operacion: string | null;
  created_at: string;
  // All other client fields (dynamic)
  [key: string]: unknown;
}

interface Transicion {
  id: number;
  nombre_accion: string;
  requiere_nota: boolean;
  devuelve_al_pool: boolean;
  etapa_destino: { id: number; nombre: string; color: string; tipo: string } | null;
}

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  tipo: string;
  color: string;
  transiciones_origen: Transicion[];
}

interface OportunidadDetalle {
  id: number;
  cliente_id: number;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  activo: boolean;
  num_operacion: string | null;
  cliente: Record<string, string | null | undefined>;
  transiciones: Transicion[];
  historial: HistorialEntry[];
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

type FiltroCard = "capturados" | "capacidades" | string; // "capturados", "capacidades" o nombre de etapa


// Columnas que no se pueden ocultar
const LOCKED_COLUMNS = ["nombres", "convenio", "tel_1", "etapa"];

// Todas las columnas extras de la tabla clientes (ocultas por defecto)
const CLIENTE_EXTRA_COLUMNS: { field: string; headerName: string; width?: number }[] = [
  // Identificacion
  { field: "nss", headerName: "NSS", width: 130 },
  { field: "a_paterno", headerName: "Ap. Paterno", width: 130 },
  { field: "a_materno", headerName: "Ap. Materno", width: 130 },
  { field: "curp", headerName: "CURP", width: 180 },
  { field: "rfc", headerName: "RFC", width: 140 },
  // Datos personales
  { field: "edad", headerName: "Edad", width: 80 },
  { field: "genero", headerName: "Genero", width: 100 },
  { field: "tipo_pension", headerName: "Tipo Pension", width: 130 },
  { field: "mes_pension", headerName: "Mes Pension", width: 110 },
  { field: "anio_pension", headerName: "Ano Pension", width: 110 },
  // Ubicacion
  { field: "umf_delegacion", headerName: "UMF/Delegacion", width: 150 },
  { field: "calle_num", headerName: "Calle y Numero", width: 200 },
  { field: "colonia", headerName: "Colonia", width: 150 },
  { field: "domicilio_pensionados", headerName: "Domicilio Pensionados", width: 200 },
  { field: "region", headerName: "Region", width: 120 },
  { field: "municipio", headerName: "Municipio", width: 140 },
  { field: "cp", headerName: "C.P.", width: 80 },
  // Contacto
  { field: "tel_2", headerName: "Tel 2", width: 130 },
  { field: "tipo_1", headerName: "Tipo Tel 1", width: 100 },
  { field: "tipo_2", headerName: "Tipo Tel 2", width: 100 },
  { field: "tel_3", headerName: "Tel 3", width: 130 },
  { field: "tipo_3", headerName: "Tipo Tel 3", width: 100 },
  { field: "tel_4", headerName: "Tel 4", width: 130 },
  { field: "tipo_4", headerName: "Tipo Tel 4", width: 100 },
  { field: "tel_5", headerName: "Tel 5", width: 130 },
  { field: "tipo_5", headerName: "Tipo Tel 5", width: 100 },
  { field: "direccion_email", headerName: "Email", width: 200 },
  // Financieras
  { field: "creditos_actuales", headerName: "Creditos Actuales", width: 140 },
  { field: "tipo_mercado", headerName: "Tipo Mercado", width: 130 },
  { field: "tipo_cliente_original", headerName: "Tipo Cliente Original", width: 160 },
  { field: "tipo_cliente_csp", headerName: "Tipo Cliente CSP", width: 140 },
  { field: "capacidad", headerName: "Capacidad", width: 120 },
  { field: "plazo_oferta", headerName: "Plazo Oferta", width: 120 },
  { field: "oferta", headerName: "Oferta", width: 120 },
  { field: "cotizador", headerName: "Cotizador", width: 120 },
  { field: "tasa", headerName: "Tasa", width: 100 },
  { field: "cat", headerName: "CAT", width: 100 },
  { field: "financiera", headerName: "Financiera", width: 130 },
  { field: "plazo", headerName: "Plazo", width: 100 },
  { field: "monto_solicitado", headerName: "Monto Solicitado", width: 140 },
  { field: "descuento_actual", headerName: "Descuento Actual", width: 140 },
  { field: "plazo_transcurrido", headerName: "Plazo Transcurrido", width: 140 },
  { field: "plazo_restante", headerName: "Plazo Restante", width: 130 },
  { field: "cat_actual", headerName: "CAT Actual", width: 110 },
  { field: "tasa_actual", headerName: "Tasa Actual", width: 110 },
  // Cartera
  { field: "monto_comisionable", headerName: "Monto Comisionable", width: 150 },
  { field: "dependencia", headerName: "Dependencia", width: 140 },
  { field: "estatus", headerName: "Estatus", width: 120 },
  { field: "monto", headerName: "Monto", width: 120 },
  { field: "num_empleado", headerName: "Num. Empleado", width: 130 },
  // Datos laborales / educativos (FONE/SEP)
  { field: "nombre", headerName: "Nombre Completo", width: 200 },
  { field: "tipo_empleado", headerName: "Tipo Empleado", width: 140 },
  { field: "antiguedad", headerName: "Antiguedad", width: 120 },
  { field: "tipo_nomina", headerName: "Tipo Nomina", width: 130 },
  { field: "nivel_salarial", headerName: "Nivel Salarial", width: 130 },
  { field: "unidad_adm", headerName: "Unidad Adm.", width: 130 },
  { field: "nomb_unidad_adm", headerName: "Nombre Unidad Adm.", width: 180 },
  { field: "puesto", headerName: "Puesto", width: 150 },
  { field: "descuento", headerName: "Descuento", width: 120 },
  { field: "oferta_neta", headerName: "Oferta Neta", width: 130 },
  { field: "universo", headerName: "Universo", width: 120 },
  // Centro educativo
  { field: "clave_cct", headerName: "Clave CCT", width: 130 },
  { field: "centro_educativo", headerName: "Centro Educativo", width: 200 },
  { field: "localidad", headerName: "Localidad", width: 150 },
  { field: "municipio_centro_educativo", headerName: "Municipio C.E.", width: 160 },
  { field: "entidad_centro_educativo", headerName: "Entidad C.E.", width: 140 },
  { field: "cp_centro_educativo", headerName: "C.P. C.E.", width: 100 },
  // Ubicacion personal adicional
  { field: "entidad_personal", headerName: "Entidad Personal", width: 140 },
  { field: "municipio_personal", headerName: "Municipio Personal", width: 160 },
  { field: "calle", headerName: "Calle", width: 180 },
  { field: "num_ext", headerName: "Num. Ext.", width: 100 },
  { field: "num_int", headerName: "Num. Int.", width: 100 },
  // Oportunidad
  { field: "oportunidad_total", headerName: "Oportunidad Total", width: 150 },
  { field: "oportunidad_real", headerName: "Oportunidad Real", width: 150 },
  { field: "id_origen", headerName: "ID Origen", width: 120 },
];

const CARD_COLORS: Record<string, string> = {
  capturados: "#26C6DA",
  capacidades: "#4caf50",
  Asignado: "#42A5F5",
  Contactado: "#FFA726",
  Interesado: "#AB47BC",
  "Negociación": "#7E57C2",
  Venta: "#2E7D32",
};

/** Resuelve el color de una etapa: prioriza CARD_COLORS sobre el color de BD */
function resolveEtapaColor(nombre: string, dbColor?: string): string {
  return CARD_COLORS[nombre] || dbColor || "#64748b";
}

// ════════════════════════════════════════════
// CONFETTI
// ════════════════════════════════════════════

function ConfettiEffect({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      color: ["#f44336", "#e91e63", "#9c27b0", "#673ab7", "#2196f3", "#4caf50", "#ff9800", "#ffeb3b", "#00bcd4"][i % 9],
      left: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.2 + Math.random() * 2.5,
      size: 6 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 120,
    })),
  []);

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; top: -20px; }
          100% { opacity: 0; top: 110vh; }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: -20,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              borderRadius: 2,
              animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
              transform: `translateX(${p.drift}px)`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

// ════════════════════════════════════════════
// PÁGINA PRINCIPAL (wrapper con ToastProvider)
// ════════════════════════════════════════════

export default function OportunidadesPage() {
  return (
    <ToastProvider>
      <OportunidadesContent />
    </ToastProvider>
  );
}

// ════════════════════════════════════════════
// CONTENIDO PRINCIPAL
// ════════════════════════════════════════════

function OportunidadesContent() {
  const { data: session } = useSession();
  const promotorNombre = session?.user?.nombre || "su promotor";
  const { toast } = useToast();
  const [plantillas, setPlantillas] = useState<Record<string, string>>({ ...WA_MENSAJES_DEFAULT });
  const [rows, setRows] = useState<Oportunidad[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFiltro, setCardFiltro] = useState<FiltroCard>("Asignado"); // default: Asignado
  const [busqueda, setBusqueda] = useState("");
  const [observaciones, setObservaciones] = useState<Record<number, string>>({});
  const [transitioning, setTransitioning] = useState<number | null>(null);
  const [openEtapaDropdown, setOpenEtapaDropdown] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("promotor_columns");
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    // Por defecto: ocultar todas las columnas extras del cliente
    const defaults: VisibilityState = {};
    for (const col of CLIENTE_EXTRA_COLUMNS) {
      defaults[col.field] = false;
    }
    return defaults;
  });

  const handleColumnVisibilityChange = useCallback((model: VisibilityState) => {
    // Enforcar columnas obligatorias
    const enforced = { ...model };
    for (const col of LOCKED_COLUMNS) {
      enforced[col] = true;
    }
    setColumnVisibility(enforced);
    try {
      localStorage.setItem("promotor_columns", JSON.stringify(enforced));
    } catch { /* ignore */ }
  }, []);
  const router = useRouter();
  const [captacionOpen, setCaptacionOpen] = useState(false);
  const [asignacionOpen, setAsignacionOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [campanaOpen, setCampanaOpen] = useState(false);
  const [betaBlockOpen, setBetaBlockOpen] = useState(false);
  const { permitido: waBetaPermitido } = useWhatsAppBeta();

  // Modal Ver detalle
  const [verDialog, setVerDialog] = useState<{ open: boolean; loading: boolean; data: OportunidadDetalle | null }>({
    open: false, loading: false, data: null,
  });

  // Modal Ver capacidad IMSS
  const [capDialog, setCapDialog] = useState<{ open: boolean; loading: boolean; data: Record<string, unknown> | null }>({
    open: false, loading: false, data: null,
  });

  // Dialog num_operacion para Venta
  const [ventaDialog, setVentaDialog] = useState<{ open: boolean; opId: number; transId: number; numOp: string; monto: string; saving: boolean }>({
    open: false, opId: 0, transId: 0, numOp: "", monto: "", saving: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const [resOps, resEtapas, resPlantillas] = await Promise.all([
        fetch("/api/oportunidades"),
        fetch("/api/embudo/etapas"),
        fetch("/api/promotor/plantillas-whatsapp"),
      ]);
      if (!resOps.ok || !resEtapas.ok) {
        toast("Error al cargar datos", "error");
        return;
      }
      setRows(await resOps.json());
      setEtapas(await resEtapas.json());
      if (resPlantillas.ok) {
        setPlantillas(await resPlantillas.json());
      }
    } catch {
      toast("Error de conexion al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sincronizar capacidades
  const handleSyncCapacidades = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/promotor/capacidades/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const partes: string[] = [];
        if (data.sincronizados > 0) {
          partes.push(`${data.sincronizados} nueva${data.sincronizados !== 1 ? "s" : ""}`);
        }
        if (data.actualizados > 0) {
          partes.push(`${data.actualizados} actualizada${data.actualizados !== 1 ? "s" : ""}`);
        }
        let msg = partes.length > 0
          ? partes.join(", ")
          : "Todo al dia, sin cambios";
        if (data.errores) {
          msg += ` (${data.errores} con error)`;
        }
        toast(msg, data.errores ? "warning" : "success");
        if (data.sincronizados > 0 || data.actualizados > 0) fetchData();
      } else {
        toast(data.error || "Error al sincronizar", "error");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setSyncing(false);
  };


  // Mapa de transiciones por etapa_id
  const transMap = useMemo(() => {
    const map: Record<number, Transicion[]> = {};
    etapas.forEach((e) => { map[e.id] = e.transiciones_origen; });
    return map;
  }, [etapas]);

  // Solo etapas de avance + Venta (sin salidas)
  const etapasAvance = useMemo(() => etapas.filter((e) => e.tipo === "AVANCE" || (e.tipo === "FINAL" && e.nombre === "Venta")), [etapas]);

  // ─── CONTEOS para las 7 cards ───
  const conteos = useMemo(() => {
    const result: Record<string, number> = { capturados: 0, capacidades: 0 };
    etapasAvance.forEach((e) => { result[e.nombre] = 0; });
    rows.forEach((r) => {
      if (r.origen === "CAPTACION") {
        result.capturados++;
      } else if (r.origen === "CAPACIDADES" && r.etapa?.nombre === "Asignado") {
        result.capacidades++;
      } else if (r.origen !== "CAPACIDADES" && r.etapa) {
        if (result[r.etapa.nombre] !== undefined) {
          result[r.etapa.nombre]++;
        }
      } else if (r.origen === "CAPACIDADES" && r.etapa && r.etapa.nombre !== "Asignado") {
        // Capacidades que ya avanzaron: contar en su etapa normal
        if (result[r.etapa.nombre] !== undefined) {
          result[r.etapa.nombre]++;
        }
      }
    });
    return result;
  }, [rows, etapasAvance]);

  const totalOps = rows.length;

  // ─── Monto total de ventas ───
  const totalVentaMonto = useMemo(() => {
    return rows
      .filter((r) => r.etapa?.nombre === "Venta")
      .reduce((sum, r) => sum + (Number(r.monto_venta) || 0), 0);
  }, [rows]);

  // ─── ALERTA: oportunidades por vencer (<8h) ───
  const UMBRAL_ALERTA_MS = 8 * 60 * 60 * 1000; // 8 horas

  const porVencer = useMemo(() => {
    const ahora = Date.now();
    return rows.filter((r) => {
      if (!r.timer_vence) return false;
      const restante = new Date(r.timer_vence).getTime() - ahora;
      return restante > 0 && restante <= UMBRAL_ALERTA_MS;
    });
  }, [rows]);

  const porVencerIds = useMemo(() => new Set(porVencer.map((r) => r.id)), [porVencer]);

  // ─── FILTRADO por card activa ───
  const filteredByCard = useMemo(() => {
    if (cardFiltro === "capturados") {
      return rows.filter((r) => r.origen === "CAPTACION");
    } else if (cardFiltro === "capacidades") {
      return rows.filter((r) => r.origen === "CAPACIDADES" && r.etapa?.nombre === "Asignado");
    } else if (cardFiltro) {
      return rows.filter((r) => r.origen !== "CAPTACION" && !(r.origen === "CAPACIDADES" && r.etapa?.nombre === "Asignado") && r.etapa?.nombre === cardFiltro);
    }
    return rows;
  }, [rows, cardFiltro]);

  // ─── Busqueda dentro de la etapa seleccionada ───
  const filtered = useMemo(() => {
    if (!busqueda.trim()) return filteredByCard;
    const q = busqueda.toLowerCase().trim();
    return filteredByCard.filter((r) =>
      (r.nombres && r.nombres.toLowerCase().includes(q)) ||
      (r.convenio && r.convenio.toLowerCase().includes(q)) ||
      (r.tel_1 && r.tel_1.includes(q)) ||
      (r.estado && r.estado.toLowerCase().includes(q)) ||
      (r.municipio && r.municipio.toLowerCase().includes(q))
    );
  }, [filteredByCard, busqueda]);

  // ─── Cambiar etapa inline ───
  const handleTransicion = async (opId: number, transicionId: number) => {
    const trans = etapas.flatMap((e) => e.transiciones_origen).find((t) => t.id === transicionId);
    if (!trans) return;

    if (trans.etapa_destino?.tipo === "FINAL" && trans.etapa_destino?.nombre === "Venta") {
      setVentaDialog({ open: true, opId, transId: transicionId, numOp: "", monto: "", saving: false });
      return;
    }

    await executeTransicion(opId, transicionId);
  };

  const executeTransicion = async (opId: number, transicionId: number, numOperacion?: string, monto?: string) => {
    setTransitioning(opId);
    try {
      const res = await fetch(`/api/oportunidades/${opId}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transicion_id: transicionId,
          nota: observaciones[opId] || undefined,
          num_operacion: numOperacion || undefined,
          monto: monto ? parseFloat(monto) : undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.confetti) {
          setConfetti(true);
          toast("Venta registrada!", "success");
        } else if (result.devuelta_al_pool) {
          toast("Cliente devuelto al pool", "success");
        } else if (result.enviada_a_bandeja) {
          toast("Enviado a bandeja de supervisor", "success");
        } else {
          toast("Etapa actualizada", "success");
        }
        setObservaciones((p) => { const next = { ...p }; delete next[opId]; return next; });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({ error: "Error al cambiar etapa" }));
        toast(err.error || "Error al cambiar etapa", "error");
      }
    } catch {
      toast("Error de conexion al cambiar etapa", "error");
    } finally {
      setTransitioning(null);
    }
  };

  const handleVentaConfirm = async () => {
    setVentaDialog((p) => ({ ...p, saving: true }));
    await executeTransicion(ventaDialog.opId, ventaDialog.transId, ventaDialog.numOp, ventaDialog.monto);
    setVentaDialog({ open: false, opId: 0, transId: 0, numOp: "", monto: "", saving: false });
  };

  // ─── Modal Ver detalle ───
  const openVerDialog = async (opId: number) => {
    setVerDialog({ open: true, loading: true, data: null });
    const res = await fetch(`/api/oportunidades/${opId}`);
    if (res.ok) {
      setVerDialog({ open: true, loading: false, data: await res.json() });
    } else {
      setVerDialog({ open: false, loading: false, data: null });
      toast("Error al cargar detalle", "error");
    }
  };

  // ─── Modal Ver capacidad IMSS ───
  const openCapDialog = (row: Oportunidad) => {
    setCapDialog({ open: true, loading: true, data: null });
    // datos de capacidad estan en los campos de la row (vienen de captacion.datos_json)
    const datos: Record<string, unknown> = {
      nombres: row.nombres,
      convenio: row.convenio,
      tel_1: row.tel_1,
      nss: row.nss,
      curp: row.curp,
      rfc: row.rfc,
      numero_empleado: row.num_empleado,
      imss_capacidad_actual: row.imss_capacidad_actual,
      imss_num_creditos: row.imss_num_creditos,
      imss_telefonos: row.imss_telefonos,
      respuesta: row.respuesta,
      imss_creditos_json: row.imss_creditos_json,
      fecha_solicitud: row.fecha_solicitud,
    };
    setCapDialog({ open: true, loading: false, data: datos });
  };

  // ─── Flag: hay items POOL en la vista actual ───
  const hasPoolItems = useMemo(() => filteredByCard.some((r) => r.origen === "POOL" || r.origen === "POOL_SUPERVISOR"), [filteredByCard]);

  // ─── Derive selectedIds from rowSelection ───
  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number);
  }, [rowSelection]);

  // ─── Columnas DataTable ───
  const columns: ColumnDef<Oportunidad, unknown>[] = useMemo(() => [
    createSelectionColumn<Oportunidad>(),
    {
      accessorKey: "nombres",
      header: "Cliente",
      size: 200,
      minSize: 160,
      cell: ({ row }) => (
        <div className="flex flex-col justify-center">
          <span className="text-xs font-semibold text-slate-200 truncate">{row.original.nombres}</span>
          <span className="text-[10px] text-slate-500 truncate">{row.original.tipo_cliente}</span>
        </div>
      ),
    },
    {
      accessorKey: "convenio",
      header: "Convenio",
      size: 150,
      minSize: 120,
      cell: ({ row }) => <span className="text-xs text-slate-300 truncate">{row.original.convenio}</span>,
    },
    {
      accessorKey: "estado",
      header: "Ubicacion",
      size: 150,
      cell: ({ row }) => (
        <div className="flex flex-col justify-center">
          <span className="text-xs text-slate-200 truncate">{row.original.estado}</span>
          <span className="text-[10px] text-slate-500 truncate">{row.original.municipio}</span>
        </div>
      ),
    },
    {
      accessorKey: "tel_1",
      header: "Telefono",
      size: 130,
      cell: ({ row }) => row.original.tel_1
        ? (
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-green-400" />
            <span className="text-xs text-slate-300">{row.original.tel_1}</span>
          </div>
        )
        : <span className="text-xs text-slate-600">—</span>,
    },
    {
      accessorKey: "etapa",
      header: "Etapa",
      size: 220,
      enableSorting: false,
      cell: ({ row }) => {
        const etapa = row.original.etapa;
        const esPorVencer = porVencerIds.has(row.original.id);
        if (!etapa) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700/50 text-slate-400">
              Sin etapa
            </span>
          );
        }
        const trans = transMap[etapa.id] || [];
        const isLoading = transitioning === row.original.id;

        if (isLoading) return <Spinner size="sm" />;

        const venceBadge = esPorVencer ? (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
            <AlertTriangle className="w-2.5 h-2.5" />
            Vence pronto
          </span>
        ) : null;

        if (trans.length === 0) {
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: resolveEtapaColor(etapa.nombre, etapa.color) }}
              >
                {etapa.nombre}
              </span>
              {venceBadge}
            </div>
          );
        }

        const isOpen = openEtapaDropdown === row.original.id;
        return (
          <div className="relative flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                if (isOpen) {
                  setOpenEtapaDropdown(null);
                  setDropdownPos(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                  setOpenEtapaDropdown(row.original.id);
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: resolveEtapaColor(etapa.nombre, etapa.color) }}
            >
              {etapa.nombre}
              <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && dropdownPos && createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setOpenEtapaDropdown(null); setDropdownPos(null); }} />
                <div
                  className="fixed z-50 w-52 bg-slate-900/95 backdrop-blur-sm border border-slate-700/80 rounded-lg shadow-2xl shadow-black/60 py-1.5 animate-fade-in"
                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mover a</p>
                  {trans.map((t) => {
                    const destColor = resolveEtapaColor(t.etapa_destino?.nombre || "", t.etapa_destino?.color || "#ef4444");
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setOpenEtapaDropdown(null);
                          setDropdownPos(null);
                          handleTransicion(row.original.id, t.id);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800/80 transition-colors flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: destColor }} />
                        <span style={{ color: destColor }}>{t.etapa_destino?.nombre || "Pool"}</span>
                      </button>
                    );
                  })}
                </div>
              </>,
              document.body
            )}
            {venceBadge}
          </div>
        );
      },
    },
    ...(cardFiltro === "Venta" ? [
      {
        accessorKey: "num_operacion",
        header: "No. Operacion",
        size: 150,
        cell: ({ row }: { row: { original: Oportunidad } }) => (
          <span className="text-xs font-medium text-slate-300">{row.original.num_operacion || "—"}</span>
        ),
      } as ColumnDef<Oportunidad, unknown>,
      {
        accessorKey: "monto_venta",
        header: "Monto",
        size: 130,
        cell: ({ row }: { row: { original: Oportunidad } }) => (
          <span className="text-xs font-bold text-green-500">
            {row.original.monto_venta != null
              ? Number(row.original.monto_venta).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
              : "—"}
          </span>
        ),
      } as ColumnDef<Oportunidad, unknown>,
    ] : []),
    ...(cardFiltro === "capacidades" ? [
      {
        accessorKey: "imss_capacidad_actual",
        header: "Capacidad",
        size: 110,
        cell: ({ row }: { row: { original: Oportunidad } }) => {
          const val = row.original.imss_capacidad_actual != null ? Number(row.original.imss_capacidad_actual) : null;
          return (
            <span className={`text-xs font-semibold ${val != null && val < 0 ? "text-red-400" : "text-green-400"}`}>
              {val != null ? `$${val.toLocaleString("es-MX")}` : "—"}
            </span>
          );
        },
      } as ColumnDef<Oportunidad, unknown>,
      {
        accessorKey: "imss_num_creditos",
        header: "Creditos",
        size: 90,
        cell: ({ row }: { row: { original: Oportunidad } }) => (
          <span className="text-xs text-slate-300">{(row.original.imss_num_creditos as string | number | null) ?? "—"}</span>
        ),
      } as ColumnDef<Oportunidad, unknown>,
    ] : []),
    ...(hasPoolItems ? [
      {
        id: "cap_actualizada_pool",
        header: "Cap. Actualizada",
        size: 140,
        accessorFn: (row: Oportunidad) => {
          // POOL_SUPERVISOR usa campos sup_, POOL usa campos normales
          return row.origen === "POOL_SUPERVISOR"
            ? (row.sup_capacidad_actualizada as string | null)
            : (row.capacidad_actualizada as string | null);
        },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue() as string | null;
          if (!val) return <span className="text-xs text-slate-600">—</span>;
          const num = parseFloat(val);
          return (
            <span className="text-xs font-semibold text-amber-400">
              ${isNaN(num) ? val : num.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          );
        },
      } as ColumnDef<Oportunidad, unknown>,
      {
        accessorKey: "filiacion",
        header: "Filiación",
        size: 120,
        cell: ({ row }: { row: { original: Oportunidad } }) => (
          <span className="text-xs text-slate-300">{(row.original.filiacion as string | null) ?? "—"}</span>
        ),
      } as ColumnDef<Oportunidad, unknown>,
      {
        id: "est_laboral_pool",
        header: "Est. Laboral",
        size: 110,
        accessorFn: (row: Oportunidad) => {
          return row.origen === "POOL_SUPERVISOR"
            ? (row.sup_estatus_laboral as string | null)
            : (row.estatus_laboral as string | null);
        },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue() as string | null;
          return <span className={`text-xs ${val === "Estable" ? "text-green-400" : val === "No estable" ? "text-red-400" : "text-slate-600"}`}>{val ?? "—"}</span>;
        },
      } as ColumnDef<Oportunidad, unknown>,
    ] : []),
    // All client extra columns (hidden by default)
    ...CLIENTE_EXTRA_COLUMNS.map((col) => ({
      accessorKey: col.field,
      header: col.headerName,
      size: col.width || 120,
      cell: ({ row }: { row: { original: Oportunidad } }) => (
        <span className="text-xs text-slate-300 truncate">{(row.original[col.field] as string | null) ?? "—"}</span>
      ),
    } as ColumnDef<Oportunidad, unknown>)),
    {
      accessorKey: "wa_estado",
      header: "WA",
      size: 110,
      enableSorting: false,
      cell: ({ row }) => {
        const estado = row.original.wa_estado as string | null;
        const waManual = row.original.wa_manual_at as string | null;
        if (!estado && !waManual) return <span className="text-[10px] text-slate-600">—</span>;
        const colorMap: Record<string, string> = {
          PENDIENTE: "#9e9e9e", ENVIANDO: "#ff9800", ENVIADO: "#2196f3",
          ENTREGADO: "#4caf50", LEIDO: "#00bcd4", FALLIDO: "#f44336",
        };
        return (
          <div className="flex flex-col gap-0.5">
            {waManual && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: "#25D366" }}
              >
                Manual
              </span>
            )}
            {estado && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: colorMap[estado] || "#9e9e9e" }}
              >
                {estado}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "__obs",
      header: "Observaciones",
      size: 200,
      minSize: 150,
      enableSorting: false,
      cell: ({ row }) => (
        <input
          type="text"
          placeholder="Nota opcional..."
          className="w-full bg-transparent border-none outline-none text-xs text-slate-300 placeholder-slate-600 py-0.5"
          value={observaciones[row.original.id] || ""}
          onChange={(e) => setObservaciones((prev) => ({ ...prev, [row.original.id]: e.target.value }))}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      id: "__acciones",
      header: "",
      size: cardFiltro === "capacidades" ? 160 : 130,
      enableSorting: false,
      cell: ({ row }) => {
        const etapaNombre = row.original.origen === "CAPTACION" ? "Capturados" : (row.original.etapa?.nombre || "Asignado");
        const waUrl = buildWhatsAppUrl(row.original.tel_1 || "", row.original.nombres || "", etapaNombre, promotorNombre, plantillas);
        return (
          <div className="flex items-center gap-1">
            <Tooltip content="Ver detalle">
              <button
                className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                onClick={(e) => { e.stopPropagation(); openVerDialog(row.original.id); }}
              >
                <Eye className="w-4 h-4" />
              </button>
            </Tooltip>
            {cardFiltro === "capacidades" && (
              <Tooltip content="Ver datos IMSS">
                <button
                  className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                  onClick={(e) => { e.stopPropagation(); openCapDialog(row.original); }}
                >
                  <ClipboardList className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip content={waUrl ? "Enviar WhatsApp" : "Sin telefono"}>
              <button
                className={`p-1.5 rounded-lg transition-colors ${waUrl ? "text-[#25D366] hover:bg-green-500/10" : "text-slate-600 cursor-not-allowed"}`}
                disabled={!waUrl}
                onClick={(e) => {
                  e.stopPropagation();
                  if (waUrl) {
                    window.open(waUrl, "_blank");
                    fetch(`/api/oportunidades/${row.original.id}/wa-manual`, { method: "POST" })
                      .then(() => {
                        setRows((prev) => prev.map((r) =>
                          r.id === row.original.id ? { ...r, wa_manual_at: new Date().toISOString() } : r
                        ));
                      })
                      .catch(() => {});
                  }
                }}
              >
                <WhatsAppIcon className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content={row.original.curp || row.original.nss ? "Copiar datos Telegram" : "Sin CURP ni NSS"}>
              <button
                className={`p-1.5 rounded-lg transition-colors ${row.original.curp || row.original.nss ? "text-[#0088cc] hover:bg-blue-500/10" : "text-slate-600 cursor-not-allowed"}`}
                disabled={!row.original.curp && !row.original.nss}
                onClick={(e) => {
                  e.stopPropagation();
                  const cadena = `${row.original.nombres || ""}, ${row.original.curp || ""}, ${row.original.nss || ""}`;
                  navigator.clipboard.writeText(cadena).then(() => {
                    toast("Copiado al portapapeles", "success");
                  });
                }}
              >
                <TelegramIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [transMap, transitioning, observaciones, cardFiltro, hasPoolItems, promotorNombre, plantillas, openEtapaDropdown, dropdownPos, porVencerIds]);

  // Destinatarios para la campana: filas seleccionadas con telefono
  const destinatariosSeleccionados = useMemo(() => {
    const selectedSet = new Set(selectedIds.map(Number));
    return rows
      .filter((r) => selectedSet.has(r.id) && r.tel_1)
      .map((r) => ({
        oportunidad_id: r.id,
        numero_destino: formatPhoneForWA(r.tel_1 as string),
        nombre_cliente: r.nombres,
      }));
  }, [rows, selectedIds]);

  // Mensaje inicial sugerido segun la etapa activa
  const mensajeInicial = useMemo(() => {
    if (!cardFiltro) return plantillas["Asignado"] || "";
    return plantillas[cardFiltro === "capturados" ? "Capturados" : cardFiltro] || plantillas["Asignado"] || "";
  }, [cardFiltro, plantillas]);

  if (loading) return (
    <div className="flex justify-center mt-20"><Spinner size="lg" /></div>
  );

  // ─── Cards para el pipeline ───
  const cardItems: { key: FiltroCard; label: string; color: string }[] = [
    { key: "capacidades", label: "Capacidades", color: CARD_COLORS.capacidades },
    { key: "capturados", label: "Capturados", color: CARD_COLORS.capturados },
    ...etapasAvance.map((e) => ({ key: e.nombre as FiltroCard, label: e.nombre, color: CARD_COLORS[e.nombre] || e.color })),
  ];

  return (
    <div className="flex flex-col">
      {confetti && <ConfettiEffect onDone={() => setConfetti(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Mi Asignacion</h1>
          <p className="text-sm text-slate-500">Gestiona tus oportunidades activas</p>
        </div>
        <div className="flex gap-2">
          <Tooltip content="Actualizar Capacidades">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCapacidades}
              disabled={syncing}
              className="border-green-500/30 text-green-400 hover:bg-green-500/10 min-w-[40px] px-2"
            >
              {syncing ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setCaptacionOpen(true)}
          >
            Captar Cliente
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<ClipboardList className="w-4 h-4" />}
            onClick={() => setAsignacionOpen(true)}
          >
            Solicitar Asignacion
          </Button>
        </div>
      </div>

      {/* ═══════ 7 CARDS PIPELINE ═══════ */}
      <div
        className="flex gap-3 mb-3 overflow-x-auto pt-1 pb-2 shrink-0 scrollbar-thin"
      >
        {cardItems.map((item) => {
          const count = conteos[item.key] || 0;
          const isSelected = cardFiltro === item.key;
          const pct = totalOps > 0 ? Math.round((count / totalOps) * 100) : 0;

          return (
            <div
              key={item.key}
              onClick={() => { if (!isSelected) { setCardFiltro(item.key); setBusqueda(""); } }}
              className="px-4 py-3 cursor-pointer min-w-[120px] flex-1 rounded-xl text-center border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                backgroundColor: isSelected ? item.color : "var(--color-surface, #1e293b)",
                color: isSelected ? "white" : "var(--color-text-primary, #e2e8f0)",
                borderColor: isSelected ? item.color : count > 0 ? item.color : "rgba(100,116,139,0.2)",
                boxShadow: isSelected ? `0 4px 14px ${item.color}40` : undefined,
              }}
            >
              <div className="flex items-center gap-1 justify-center mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.8)" : item.color }}
                />
                <span
                  className="text-[10px] font-semibold whitespace-nowrap"
                  style={{ color: isSelected ? "rgba(255,255,255,0.9)" : "var(--color-text-secondary, #94a3b8)" }}
                >
                  {item.label}
                </span>
              </div>
              <p
                className="text-3xl font-extrabold leading-tight"
                style={{ color: isSelected ? "white" : item.color }}
              >
                {count}
              </p>
              {item.key === "Venta" && totalVentaMonto > 0 && (
                <span
                  className="text-[10px] font-bold block mt-0.5"
                  style={{ color: isSelected ? "rgba(255,255,255,0.9)" : item.color }}
                >
                  {totalVentaMonto.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
                </span>
              )}
              {/* Progress bar */}
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : "rgba(100,116,139,0.15)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: isSelected ? "white" : item.color }}
                />
              </div>
              <span
                className="text-[9px]"
                style={{ color: isSelected ? "rgba(255,255,255,0.8)" : "var(--color-text-disabled, #475569)" }}
              >
                {pct}% del total
              </span>
            </div>
          );
        })}
      </div>

      {/* ═══════ ALERTA POR VENCER ═══════ */}
      {porVencer.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 shrink-0 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">
            <strong>{porVencer.length}</strong> {porVencer.length === 1 ? "registro vence" : "registros vencen"} en las proximas 8 horas.
            {" "}Gestionalos para no perderlos.
          </span>
        </div>
      )}

      {/* ═══════ FILTROS + GRID ═══════ */}
      <div className="bg-surface rounded-xl border border-slate-800/60 overflow-hidden flex flex-col">
        {/* Barra superior: busqueda + acciones */}
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/30 border-b border-slate-800/40 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, convenio, telefono..."
              className="w-full pl-8 pr-8 py-1.5 bg-slate-800/50 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs text-slate-500 shrink-0">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>

          {selectedIds.length > 0 && (
            <Button
              size="sm"
              icon={<Megaphone className="w-4 h-4" />}
              onClick={() => waBetaPermitido ? setCampanaOpen(true) : setBetaBlockOpen(true)}
              className="!bg-[#25D366] !text-white hover:!bg-[#1da851] !shadow-lg !shadow-green-500/20"
            >
              WhatsApp Masivo ({selectedIds.length})
            </Button>
          )}
        </div>

        {/* DataTable */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p>Sin oportunidades en esta vista</p>
          </div>
        ) : (
          <DataTable
            data={filtered}
            columns={columns}
            pageSize={25}
            pageSizeOptions={[25, 50, 100]}
            enableRowSelection={true}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={handleColumnVisibilityChange}
            getRowId={(row) => String(row.id)}
            className="border-0 rounded-none"
          />
        )}
      </div>

      {/* ═══════ DIALOG: NUM OPERACION (VENTA) ═══════ */}
      <Dialog open={ventaDialog.open} onClose={() => setVentaDialog((p) => ({ ...p, open: false }))} maxWidth="sm">
        <DialogHeader onClose={() => setVentaDialog((p) => ({ ...p, open: false }))}>
          <div>
            <span className="text-lg font-bold text-slate-100">Registrar Venta</span>
            <p className="text-sm text-slate-400 mt-0.5">Completa los datos para registrar la venta</p>
          </div>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input
              autoFocus
              label="Numero de operacion"
              value={ventaDialog.numOp}
              onChange={(e) => setVentaDialog((p) => ({ ...p, numOp: e.target.value }))}
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Monto de la venta (MXN)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-sm text-slate-500">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={ventaDialog.monto}
                  onChange={(e) => setVentaDialog((p) => ({ ...p, monto: e.target.value }))}
                  required
                  className="w-full pl-7 pr-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="danger" size="sm" onClick={() => setVentaDialog((p) => ({ ...p, open: false }))}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleVentaConfirm}
            disabled={ventaDialog.saving || !ventaDialog.numOp.trim() || !ventaDialog.monto}
            loading={ventaDialog.saving}
            className="bg-green-600 hover:bg-green-500 shadow-green-600/20"
          >
            Registrar Venta
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ═══════ DIALOG: VER DETALLE ═══════ */}
      <Dialog
        open={verDialog.open}
        onClose={() => setVerDialog({ open: false, loading: false, data: null })}
        maxWidth="2xl"
      >
        <DialogHeader onClose={() => setVerDialog({ open: false, loading: false, data: null })}>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg font-bold text-slate-100 flex-1">Detalle del Cliente</span>
            {verDialog.data?.etapa && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: resolveEtapaColor(verDialog.data.etapa.nombre, verDialog.data.etapa.color) }}
              >
                {verDialog.data.etapa.nombre}
              </span>
            )}
          </div>
        </DialogHeader>
        <DialogBody>
          {verDialog.loading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : verDialog.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Informacion del cliente */}
              <div className="bg-surface rounded-xl border border-slate-800/60 p-5">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Informacion del cliente
                </h4>
                <div className="space-y-2.5">
                  <DetailRow label="Nombre" value={verDialog.data.cliente.nombres} />
                  <DetailRow label="Convenio" value={verDialog.data.cliente.convenio} />
                  <DetailRow label="Estado" value={verDialog.data.cliente.estado} />
                  <DetailRow label="Municipio" value={verDialog.data.cliente.municipio} />
                  <DetailRow label="Oferta" value={verDialog.data.cliente.oferta} />
                  <div className="h-px bg-slate-800/40 my-3" />
                  <DetailRow label="Tel 1" value={verDialog.data.cliente.tel_1} />
                  <DetailRow label="Tel 2" value={verDialog.data.cliente.tel_2} />
                  <DetailRow label="CURP" value={verDialog.data.cliente.curp} />
                  <DetailRow label="RFC" value={verDialog.data.cliente.rfc} />
                  <DetailRow label="NSS" value={verDialog.data.cliente.nss} />
                  <DetailRow label="Num. Empleado" value={verDialog.data.cliente.num_empleado} />
                  {verDialog.data.num_operacion && (
                    <>
                      <div className="h-px bg-slate-800/40 my-3" />
                      <DetailRow label="No. Operacion" value={verDialog.data.num_operacion} />
                    </>
                  )}
                </div>
              </div>

              {/* Historial */}
              <div className="bg-surface rounded-xl border border-slate-800/60 p-5">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Historial
                </h4>
                {verDialog.data.historial.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin historial aun.</p>
                ) : (
                  <div className="space-y-3">
                    {verDialog.data.historial.map((entry) => (
                      <div key={entry.id} className="flex gap-3 items-start">
                        <span
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: resolveEtapaColor(entry.etapa_nueva?.nombre || "", entry.etapa_nueva?.color || "#64748b") }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-1 items-center flex-wrap">
                            {entry.etapa_anterior && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                                style={{ backgroundColor: resolveEtapaColor(entry.etapa_anterior.nombre, entry.etapa_anterior.color) }}
                              >
                                {entry.etapa_anterior.nombre}
                              </span>
                            )}
                            {entry.etapa_anterior && entry.etapa_nueva && (
                              <span className="text-xs text-slate-500">→</span>
                            )}
                            {entry.etapa_nueva && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                                style={{ backgroundColor: resolveEtapaColor(entry.etapa_nueva.nombre, entry.etapa_nueva.color) }}
                              >
                                {entry.etapa_nueva.nombre}
                              </span>
                            )}
                          </div>
                          {entry.nota && <p className="text-xs text-slate-300 mt-0.5">{entry.nota}</p>}
                          <p className="text-[10px] text-slate-500">
                            {entry.usuario.nombre} · {new Date(entry.created_at).toLocaleString("es-MX")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => setVerDialog({ open: false, loading: false, data: null })}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ═══════ DIALOG: VER DATOS IMSS (CAPACIDADES) ═══════ */}
      <Dialog
        open={capDialog.open}
        onClose={() => setCapDialog({ open: false, loading: false, data: null })}
        maxWidth="lg"
      >
        <DialogHeader onClose={() => setCapDialog({ open: false, loading: false, data: null })}>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg font-bold text-slate-100 flex-1">Datos IMSS</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white bg-green-600">
              Capacidades
            </span>
          </div>
        </DialogHeader>
        <DialogBody>
          {capDialog.loading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : capDialog.data ? (
            <div className="space-y-4">
              {/* Datos del Cliente */}
              <div className="bg-surface rounded-xl border border-slate-800/60 p-5">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Datos del Cliente
                </h4>
                <div className="space-y-2">
                  <DetailRow label="Nombre" value={String(capDialog.data.nombres || "—")} />
                  <DetailRow label="Convenio" value={String(capDialog.data.convenio || "—")} />
                  <DetailRow label="Telefono" value={String(capDialog.data.tel_1 || capDialog.data.imss_telefonos || "—")} />
                  <DetailRow label="NSS" value={String(capDialog.data.nss || "—")} />
                  <DetailRow label="CURP" value={String(capDialog.data.curp || "—")} />
                  <DetailRow label="RFC" value={String(capDialog.data.rfc || "—")} />
                  <DetailRow label="No. Empleado" value={String(capDialog.data.numero_empleado || "—")} />
                </div>
              </div>

              {/* Informacion IMSS */}
              <div className="bg-surface rounded-xl border border-green-500/30 p-5">
                <h4 className="text-[11px] font-semibold text-green-400 uppercase tracking-widest mb-3">
                  Informacion IMSS
                </h4>
                <div className="space-y-2">
                  <DetailRow label="Capacidad Actual" value={
                    capDialog.data.imss_capacidad_actual != null
                      ? `$${Number(capDialog.data.imss_capacidad_actual).toLocaleString("es-MX")}`
                      : "—"
                  } />
                  <DetailRow label="Num. Creditos" value={String(capDialog.data.imss_num_creditos ?? "—")} />
                  <DetailRow label="Telefonos IMSS" value={String(capDialog.data.imss_telefonos || "—")} />
                  {capDialog.data.fecha_solicitud ? (
                    <DetailRow label="Fecha Solicitud" value={new Date(String(capDialog.data.fecha_solicitud)).toLocaleString("es-MX")} />
                  ) : null}
                </div>
                {capDialog.data.respuesta ? (
                  <>
                    <div className="h-px bg-slate-800/40 my-3" />
                    <h5 className="text-[11px] font-semibold text-slate-500 mb-2">
                      RESPUESTA COMPLETA
                    </h5>
                    <div className="p-3 bg-slate-800/50 rounded-lg max-h-[200px] overflow-auto">
                      <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-mono">
                        {String(capDialog.data.respuesta)}
                      </pre>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => setCapDialog({ open: false, loading: false, data: null })}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ═══════ MODALS ═══════ */}
      <CaptacionModal
        open={captacionOpen}
        onClose={() => setCaptacionOpen(false)}
        onSuccess={(opId) => {
          setCaptacionOpen(false);
          fetchData();
          toast("Cliente captado exitosamente", "success");
        }}
      />

      <SolicitarAsignacionDialog
        open={asignacionOpen}
        onClose={() => setAsignacionOpen(false)}
        onSuccess={() => {
          setAsignacionOpen(false);
          fetchData();
          toast("Asignacion completada", "success");
        }}
      />

      <CampanaCrearDialog
        open={campanaOpen}
        onClose={() => setCampanaOpen(false)}
        onSuccess={() => {
          setCampanaOpen(false);
          setRowSelection({});
          toast("Campana creada exitosamente", "success");
        }}
        destinatarios={destinatariosSeleccionados}
        mensajeInicial={mensajeInicial}
      />

      {/* Dialog beta block WhatsApp Masivo */}
      <Dialog open={betaBlockOpen} onClose={() => setBetaBlockOpen(false)} maxWidth="sm">
        <DialogBody>
          <div className="text-center py-4">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <WhatsAppIcon className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="absolute -top-2 -right-2 bg-purple-500 rounded-full p-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">
              WhatsApp Masivo en Fase de Pruebas
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Esta funcionalidad se encuentra en periodo de pruebas con un grupo
              seleccionado de promotores. Pronto estara disponible para todos.
            </p>
            <p className="text-xs text-slate-500 mt-4">
              Si necesitas acceso, contacta a tu supervisor o administrador.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetaBlockOpen(false)}
              className="mt-5"
            >
              Entendido
            </Button>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-[13px] font-medium text-slate-200">{value || "—"}</span>
    </div>
  );
}
