"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box, Typography, Chip, CircularProgress, Alert, Stack,
  MenuItem, Select, FormControl,
  IconButton, Tooltip, Button,
  Card, CardContent, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Paper, Divider, Grid,
  LinearProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams, GridRowSelectionModel, GridRowId, GridToolbarColumnsButton, GridToolbarFilterButton } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import PhoneIcon from "@mui/icons-material/Phone";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import CampaignIcon from "@mui/icons-material/Campaign";
import SyncIcon from "@mui/icons-material/Sync";
import TelegramIcon from "@mui/icons-material/Telegram";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { buildWhatsAppUrl, formatPhoneForWA, WA_MENSAJES_DEFAULT } from "@/lib/whatsapp";
import CaptacionModal from "@/components/CaptacionModal";
import SolicitarAsignacionDialog from "@/components/SolicitarAsignacionDialog";
import CampanaCrearDialog from "@/components/CampanaCrearDialog";

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
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════

export default function OportunidadesPage() {
  const { data: session } = useSession();
  const promotorNombre = session?.user?.nombre || "su promotor";
  const [plantillas, setPlantillas] = useState<Record<string, string>>({ ...WA_MENSAJES_DEFAULT });
  const [rows, setRows] = useState<Oportunidad[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFiltro, setCardFiltro] = useState<FiltroCard>("Asignado"); // default: Asignado
  const [observaciones, setObservaciones] = useState<Record<number, string>>({});
  const [transitioning, setTransitioning] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" | "warning" });
  const [confetti, setConfetti] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("promotor_columns");
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    // Por defecto: ocultar todas las columnas extras del cliente
    const defaults: Record<string, boolean> = {};
    for (const col of CLIENTE_EXTRA_COLUMNS) {
      defaults[col.field] = false;
    }
    return defaults;
  });

  const handleColumnVisibilityChange = useCallback((model: Record<string, boolean>) => {
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [campanaOpen, setCampanaOpen] = useState(false);

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
        setSnackbar({ open: true, message: "Error al cargar datos", severity: "error" });
        return;
      }
      setRows(await resOps.json());
      setEtapas(await resEtapas.json());
      if (resPlantillas.ok) {
        setPlantillas(await resPlantillas.json());
      }
    } catch {
      setSnackbar({ open: true, message: "Error de conexión al cargar datos", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sincronizar capacidades
  const handleSyncCapacidades = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/promotor/capacidades/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        let msg = data.sincronizados > 0
          ? `${data.sincronizados} capacidad${data.sincronizados !== 1 ? "es" : ""} sincronizada${data.sincronizados !== 1 ? "s" : ""}`
          : "Todo al día, sin capacidades nuevas";
        if (data.errores) {
          msg += ` (${data.errores} con error)`;
        }
        setSnackbar({ open: true, message: msg, severity: data.errores ? "warning" : "success" });
        if (data.sincronizados > 0) fetchData();
      } else {
        setSnackbar({ open: true, message: data.error || "Error al sincronizar", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Error de conexión", severity: "error" });
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

  // ─── FILTRADO por card activa ───
  const filtered = useMemo(() => {
    if (cardFiltro === "capturados") {
      return rows.filter((r) => r.origen === "CAPTACION");
    } else if (cardFiltro === "capacidades") {
      return rows.filter((r) => r.origen === "CAPACIDADES" && r.etapa?.nombre === "Asignado");
    } else if (cardFiltro) {
      return rows.filter((r) => r.origen !== "CAPTACION" && !(r.origen === "CAPACIDADES" && r.etapa?.nombre === "Asignado") && r.etapa?.nombre === cardFiltro);
    }
    return rows;
  }, [rows, cardFiltro]);

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
          setSnackbar({ open: true, message: "Venta registrada!", severity: "success" });
        } else if (result.devuelta_al_pool) {
          setSnackbar({ open: true, message: "Cliente devuelto al pool", severity: "success" });
        } else if (result.enviada_a_bandeja) {
          setSnackbar({ open: true, message: "Enviado a bandeja de supervisor", severity: "success" });
        } else {
          setSnackbar({ open: true, message: "Etapa actualizada", severity: "success" });
        }
        setObservaciones((p) => { const next = { ...p }; delete next[opId]; return next; });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({ error: "Error al cambiar etapa" }));
        setSnackbar({ open: true, message: err.error || "Error al cambiar etapa", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Error de conexión al cambiar etapa", severity: "error" });
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
      setSnackbar({ open: true, message: "Error al cargar detalle", severity: "error" });
    }
  };

  // ─── Modal Ver capacidad IMSS ───
  const openCapDialog = (row: Oportunidad) => {
    setCapDialog({ open: true, loading: true, data: null });
    // datos de capacidad están en los campos de la row (vienen de captacion.datos_json)
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

  // ─── Columnas DataGrid ───
  const columns: GridColDef[] = useMemo(() => [
    {
      field: "nombres", headerName: "Cliente", flex: 1.3, minWidth: 160,
      renderCell: (p) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: 12 }}>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10 }}>{p.row.tipo_cliente}</Typography>
        </Box>
      ),
    },
    {
      field: "convenio", headerName: "Convenio", flex: 0.9, minWidth: 120,
      renderCell: (p) => <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>{p.value}</Typography>,
    },
    {
      field: "estado", headerName: "Ubicación", width: 150,
      renderCell: (p) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10 }}>{p.row.municipio}</Typography>
        </Box>
      ),
    },
    {
      field: "tel_1", headerName: "Teléfono", width: 130,
      renderCell: (p) => p.value
        ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PhoneIcon sx={{ fontSize: 12, color: "success.main" }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>{p.value}</Typography>
          </Box>
        )
        : <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12 }}>—</Typography>,
    },
    {
      field: "etapa", headerName: "Etapa", width: 180, sortable: false,
      renderCell: (p) => {
        const etapa = p.row.etapa;
        if (!etapa) return <Chip label="Sin etapa" size="small" sx={{ height: 22 }} />;
        const trans = transMap[etapa.id] || [];
        const isLoading = transitioning === p.row.id;

        if (isLoading) return <CircularProgress size={18} />;

        if (trans.length === 0) {
          return <Chip label={etapa.nombre} size="small" sx={{ bgcolor: etapa.color, color: "white", fontWeight: 600, height: 22, fontSize: 11 }} />;
        }

        return (
          <FormControl size="small" fullWidth>
            <Select
              value=""
              displayEmpty
              renderValue={() => (
                <Chip label={etapa.nombre} size="small" sx={{ bgcolor: etapa.color, color: "white", fontWeight: 600, height: 22, fontSize: 11 }} />
              )}
              onChange={(e) => handleTransicion(p.row.id, Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              sx={{
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                "& .MuiSelect-select": { py: 0.3, pl: 0 },
              }}
            >
              {trans.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {t.etapa_destino && (
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: t.etapa_destino.color, flexShrink: 0 }} />
                    )}
                    <Box>
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: 12 }}>{t.nombre_accion}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        {t.etapa_destino ? `→ ${t.etapa_destino.nombre}` : "→ Pool"}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      },
    },
    ...(cardFiltro === "Venta" ? [
      {
        field: "num_operacion",
        headerName: "No. Operacion",
        width: 150,
        renderCell: (p: GridRenderCellParams) => (
          <Typography variant="body2" fontWeight={500} sx={{ fontSize: 12 }}>{p.value || "—"}</Typography>
        ),
      } satisfies GridColDef,
      {
        field: "monto_venta",
        headerName: "Monto",
        width: 130,
        renderCell: (p: GridRenderCellParams) => (
          <Typography variant="body2" fontWeight={700} sx={{ color: "#2E7D32", fontSize: 12 }}>
            {p.value != null
              ? Number(p.value).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
              : "—"}
          </Typography>
        ),
      } satisfies GridColDef,
    ] : []),
    ...(cardFiltro === "capacidades" ? [
      {
        field: "imss_capacidad_actual",
        headerName: "Capacidad",
        width: 110,
        renderCell: (p: GridRenderCellParams) => (
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12, color: "#4caf50" }}>
            {p.value != null ? `$${Number(p.value).toLocaleString("es-MX")}` : "—"}
          </Typography>
        ),
      } satisfies GridColDef,
      {
        field: "imss_num_creditos",
        headerName: "Créditos",
        width: 90,
        renderCell: (p: GridRenderCellParams) => (
          <Typography variant="body2" sx={{ fontSize: 12 }}>{p.value ?? "—"}</Typography>
        ),
      } satisfies GridColDef,
    ] : []),
    // All client extra columns (hidden by default)
    ...CLIENTE_EXTRA_COLUMNS.map((col) => ({
      field: col.field,
      headerName: col.headerName,
      width: col.width || 120,
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>{p.value ?? "—"}</Typography>
      ),
    } satisfies GridColDef)),
    {
      field: "wa_estado", headerName: "WA", width: 90, sortable: false,
      renderCell: (p: GridRenderCellParams) => {
        const estado = p.value as string | null;
        if (!estado) return <Typography variant="body2" color="text.disabled" sx={{ fontSize: 10 }}>—</Typography>;
        const colorMap: Record<string, string> = {
          PENDIENTE: "#9e9e9e", ENVIANDO: "#ff9800", ENVIADO: "#2196f3",
          ENTREGADO: "#4caf50", LEIDO: "#00bcd4", FALLIDO: "#f44336",
        };
        return (
          <Chip
            label={estado}
            size="small"
            sx={{ bgcolor: colorMap[estado] || "grey.500", color: "white", fontWeight: 700, fontSize: 9, height: 20 }}
          />
        );
      },
    },
    {
      field: "__obs", headerName: "Observaciones", flex: 1, minWidth: 150, sortable: false,
      renderCell: (p) => (
        <TextField
          size="small"
          variant="standard"
          placeholder="Nota opcional..."
          fullWidth
          value={observaciones[p.row.id] || ""}
          onChange={(e) => setObservaciones((prev) => ({ ...prev, [p.row.id]: e.target.value }))}
          onClick={(e) => e.stopPropagation()}
          InputProps={{ disableUnderline: true, sx: { fontSize: 12 } }}
          sx={{ "& input": { py: 0.3 } }}
        />
      ),
    },
    {
      field: "__acciones", headerName: "", width: cardFiltro === "capacidades" ? 160 : 130, sortable: false,
      renderCell: (p) => {
        const etapaNombre = p.row.origen === "CAPTACION" ? "Capturados" : (p.row.etapa?.nombre || "Asignado");
        const waUrl = buildWhatsAppUrl(p.row.tel_1 || "", p.row.nombres || "", etapaNombre, promotorNombre, plantillas);
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title="Ver detalle">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => { e.stopPropagation(); openVerDialog(p.row.id); }}
              >
                <VisibilityIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {cardFiltro === "capacidades" && (
              <Tooltip title="Ver datos IMSS">
                <IconButton
                  size="small"
                  sx={{ color: "#4caf50" }}
                  onClick={(e) => { e.stopPropagation(); openCapDialog(p.row); }}
                >
                  <AssignmentIndIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={waUrl ? "Enviar WhatsApp" : "Sin teléfono"}>
              <span>
                <IconButton
                  size="small"
                  disabled={!waUrl}
                  onClick={(e) => { e.stopPropagation(); if (waUrl) window.open(waUrl, "_blank"); }}
                  sx={{ color: waUrl ? "#25D366" : undefined }}
                >
                  <WhatsAppIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={p.row.curp || p.row.nss ? "Copiar datos Telegram" : "Sin CURP ni NSS"}>
              <span>
                <IconButton
                  size="small"
                  disabled={!p.row.curp && !p.row.nss}
                  onClick={(e) => {
                    e.stopPropagation();
                    const cadena = `${p.row.nombres || ""}, ${p.row.curp || ""}, ${p.row.nss || ""}`;
                    navigator.clipboard.writeText(cadena).then(() => {
                      setSnackbar({ open: true, message: "Copiado al portapapeles", severity: "success" });
                    });
                  }}
                  sx={{ color: p.row.curp || p.row.nss ? "#0088cc" : undefined }}
                >
                  <TelegramIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [transMap, transitioning, observaciones, cardFiltro, promotorNombre, plantillas]);

  // Destinatarios para la campaña: filas seleccionadas con teléfono
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

  // Mensaje inicial sugerido según la etapa activa
  const mensajeInicial = useMemo(() => {
    if (!cardFiltro) return plantillas["Asignado"] || "";
    return plantillas[cardFiltro === "capturados" ? "Capturados" : cardFiltro] || plantillas["Asignado"] || "";
  }, [cardFiltro, plantillas]);

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
  );

  // ─── Cards para el pipeline ───
  const cardItems: { key: FiltroCard; label: string; color: string }[] = [
    { key: "capacidades", label: "Capacidades", color: CARD_COLORS.capacidades },
    { key: "capturados", label: "Capturados", color: CARD_COLORS.capturados },
    ...etapasAvance.map((e) => ({ key: e.nombre as FiltroCard, label: e.nombre, color: CARD_COLORS[e.nombre] || e.color })),
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      {confetti && <ConfettiEffect onDone={() => setConfetti(false)} />}

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1, flexShrink: 0 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Mi Asignación</Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona tus oportunidades activas
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Actualizar Capacidades">
            <Button
              variant="outlined"
              size="small"
              onClick={handleSyncCapacidades}
              disabled={syncing}
              sx={{ textTransform: "none", fontWeight: 600, minWidth: 40, px: 1, borderColor: "#4caf50", color: "#4caf50", "&:hover": { borderColor: "#388e3c", bgcolor: "#4caf5010" } }}
            >
              {syncing ? <CircularProgress size={18} color="inherit" /> : <SyncIcon />}
            </Button>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PersonAddIcon />}
            onClick={() => setCaptacionOpen(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Captar Cliente
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AssignmentIndIcon />}
            onClick={() => setAsignacionOpen(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Solicitar Asignación
          </Button>
        </Box>
      </Box>

      {/* ═══════ 7 CARDS PIPELINE ═══════ */}
      <Box
        sx={{
          display: "flex", gap: 1.5, mb: 1.5, overflowX: "auto", pb: 0.5, flexShrink: 0,
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "grey.300", borderRadius: 2 },
        }}
      >
        {cardItems.map((item) => {
          const count = conteos[item.key] || 0;
          const isSelected = cardFiltro === item.key;
          const pct = totalOps > 0 ? Math.round((count / totalOps) * 100) : 0;

          return (
            <Paper
              key={item.key}
              elevation={isSelected ? 4 : 0}
              onClick={() => setCardFiltro(isSelected ? "" : item.key)}
              sx={{
                px: 2.5, py: 1.5, cursor: "pointer", minWidth: 120, flex: 1,
                borderRadius: 2.5, textAlign: "center",
                bgcolor: isSelected ? item.color : "background.paper",
                color: isSelected ? "white" : "text.primary",
                border: "2px solid",
                borderColor: isSelected ? item.color : count > 0 ? item.color : "grey.200",
                "&:hover": {
                  bgcolor: isSelected ? item.color : `${item.color}15`,
                  borderColor: item.color,
                  transform: "translateY(-2px)",
                  boxShadow: 3,
                },
                transition: "all 0.2s ease",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "center", mb: 0.5 }}>
                <Box sx={{
                  width: 8, height: 8, borderRadius: "50%",
                  bgcolor: isSelected ? "rgba(255,255,255,0.8)" : item.color,
                }} />
                <Typography
                  variant="caption"
                  fontWeight={600}
                  sx={{ color: isSelected ? "rgba(255,255,255,0.9)" : "text.secondary", whiteSpace: "nowrap", fontSize: 10 }}
                >
                  {item.label}
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1, color: isSelected ? "white" : item.color }}>
                {count}
              </Typography>
              {item.key === "Venta" && totalVentaMonto > 0 && (
                <Typography variant="caption" fontWeight={700} sx={{ color: isSelected ? "rgba(255,255,255,0.9)" : item.color, display: "block", mt: 0.3, fontSize: 10 }}>
                  {totalVentaMonto.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
                </Typography>
              )}
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  mt: 1, height: 4, borderRadius: 2,
                  bgcolor: isSelected ? "rgba(255,255,255,0.3)" : "grey.100",
                  "& .MuiLinearProgress-bar": { bgcolor: isSelected ? "white" : item.color, borderRadius: 2 },
                }}
              />
              <Typography variant="caption" sx={{ color: isSelected ? "rgba(255,255,255,0.8)" : "text.disabled", fontSize: 9 }}>
                {pct}% del total
              </Typography>
            </Paper>
          );
        })}
      </Box>

      {/* ═══════ FILTROS + GRID ═══════ */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Barra superior */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", px: 2.5, py: 1, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
          {cardFiltro && (
            <Chip
              label={cardFiltro === "capturados" ? "Capturados" : cardFiltro === "capacidades" ? "Capacidades" : cardFiltro}
              onDelete={() => setCardFiltro("")}
              size="small"
              sx={{
                fontWeight: 600, height: 22, fontSize: 11,
                bgcolor: CARD_COLORS[cardFiltro] || "primary.main",
                color: "white",
                "& .MuiChip-deleteIcon": { color: "rgba(255,255,255,0.7)" },
              }}
            />
          )}

          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, fontSize: 12 }}>
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </Typography>

          {selectedIds.length > 0 && (
            <Button
              size="small"
              variant="contained"
              startIcon={<CampaignIcon />}
              onClick={() => setCampanaOpen(true)}
              sx={{ textTransform: "none", fontWeight: 600, bgcolor: "#25D366", "&:hover": { bgcolor: "#1da851" }, fontSize: 12 }}
            >
              WhatsApp Masivo ({selectedIds.length})
            </Button>
          )}
        </Box>

        {/* DataGrid */}
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <Typography>Sin oportunidades en esta vista</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={filtered}
            columns={columns}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={{ type: "include" as const, ids: new Set<GridRowId>(selectedIds) }}
            onRowSelectionModelChange={(model: GridRowSelectionModel) =>
              setSelectedIds(Array.from(model.ids).map(Number))
            }
            rowHeight={40}
            columnVisibilityModel={columnVisibility}
            onColumnVisibilityModelChange={handleColumnVisibilityChange}
            slots={{
              toolbar: () => (
                <Box sx={{ display: "flex", gap: 1, px: 1, py: 0.5, borderBottom: "1px solid", borderColor: "grey.100" }}>
                  <GridToolbarColumnsButton />
                  <GridToolbarFilterButton />
                </Box>
              ),
            }}
            sx={{
              border: "none",
              fontSize: 12,
              flex: 1,
              "& .MuiDataGrid-columnHeader": {
                bgcolor: "background.paper", fontSize: 10, fontWeight: 700,
                color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em",
              },
              "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
              "& .MuiDataGrid-cell": { borderColor: "grey.100", display: "flex", alignItems: "center" },
              "& .MuiDataGrid-footerContainer": { borderColor: "grey.100" },
              "& .MuiDataGrid-columnSeparator": { color: "grey.200" },
            }}
          />
        )}
      </Card>

      {/* ═══════ DIALOG: NUM OPERACIÓN (VENTA) ═══════ */}
      <Dialog open={ventaDialog.open} onClose={() => setVentaDialog((p) => ({ ...p, open: false }))} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>Registrar Venta</Typography>
          <Typography variant="body2" color="text.secondary">Completa los datos para registrar la venta</Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Número de operación"
            value={ventaDialog.numOp}
            onChange={(e) => setVentaDialog((p) => ({ ...p, numOp: e.target.value }))}
            margin="dense"
            size="small"
            required
          />
          <TextField
            fullWidth
            label="Monto de la venta (MXN)"
            type="number"
            inputProps={{ min: 0, step: "0.01" }}
            value={ventaDialog.monto}
            onChange={(e) => setVentaDialog((p) => ({ ...p, monto: e.target.value }))}
            margin="dense"
            size="small"
            required
            InputProps={{
              startAdornment: <Typography variant="body2" sx={{ mr: 0.5, color: "text.secondary" }}>$</Typography>,
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVentaDialog((p) => ({ ...p, open: false }))} color="error" variant="outlined">Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleVentaConfirm}
            disabled={ventaDialog.saving || !ventaDialog.numOp.trim() || !ventaDialog.monto}
          >
            {ventaDialog.saving ? <CircularProgress size={20} color="inherit" /> : "Registrar Venta"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════ DIALOG: VER DETALLE ═══════ */}
      <Dialog
        open={verDialog.open}
        onClose={() => setVerDialog({ open: false, loading: false, data: null })}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Detalle del Cliente</Typography>
          {verDialog.data?.etapa && (
            <Chip label={verDialog.data.etapa.nombre} size="small" sx={{ bgcolor: verDialog.data.etapa.color, color: "white", fontWeight: 600 }} />
          )}
        </DialogTitle>
        <DialogContent>
          {verDialog.loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : verDialog.data ? (
            <Grid container spacing={3} sx={{ mt: 0 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
                      Información del cliente
                    </Typography>
                    <Stack spacing={1.2}>
                      <DetailRow label="Nombre" value={verDialog.data.cliente.nombres} />
                      <DetailRow label="Convenio" value={verDialog.data.cliente.convenio} />
                      <DetailRow label="Estado" value={verDialog.data.cliente.estado} />
                      <DetailRow label="Municipio" value={verDialog.data.cliente.municipio} />
                      <DetailRow label="Oferta" value={verDialog.data.cliente.oferta} />
                      <Divider />
                      <DetailRow label="Tel 1" value={verDialog.data.cliente.tel_1} />
                      <DetailRow label="Tel 2" value={verDialog.data.cliente.tel_2} />
                      <DetailRow label="CURP" value={verDialog.data.cliente.curp} />
                      <DetailRow label="RFC" value={verDialog.data.cliente.rfc} />
                      <DetailRow label="NSS" value={verDialog.data.cliente.nss} />
                      <DetailRow label="Num. Empleado" value={verDialog.data.cliente.num_empleado} />
                      {verDialog.data.num_operacion && (
                        <>
                          <Divider />
                          <DetailRow label="No. Operación" value={verDialog.data.num_operacion} />
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
                      Historial
                    </Typography>
                    {verDialog.data.historial.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">Sin historial aún.</Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {verDialog.data.historial.map((entry) => (
                          <Box key={entry.id} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                            <Box sx={{
                              width: 8, height: 8, borderRadius: "50%", mt: 0.8, flexShrink: 0,
                              bgcolor: entry.etapa_nueva?.color || "grey.400",
                            }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                                {entry.etapa_anterior && (
                                  <Chip label={entry.etapa_anterior.nombre} size="small"
                                    sx={{ height: 18, fontSize: 10, bgcolor: entry.etapa_anterior.color, color: "white" }} />
                                )}
                                {entry.etapa_anterior && entry.etapa_nueva && (
                                  <Typography variant="caption" color="text.secondary">→</Typography>
                                )}
                                {entry.etapa_nueva && (
                                  <Chip label={entry.etapa_nueva.nombre} size="small"
                                    sx={{ height: 18, fontSize: 10, bgcolor: entry.etapa_nueva.color, color: "white" }} />
                                )}
                              </Box>
                              {entry.nota && <Typography variant="body2" sx={{ mt: 0.3, fontSize: 12 }}>{entry.nota}</Typography>}
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                                {entry.usuario.nombre} · {new Date(entry.created_at).toLocaleString("es-MX")}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVerDialog({ open: false, loading: false, data: null })} startIcon={<ArrowBackIcon />}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════ DIALOG: VER DATOS IMSS (CAPACIDADES) ═══════ */}
      <Dialog
        open={capDialog.open}
        onClose={() => setCapDialog({ open: false, loading: false, data: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Datos IMSS</Typography>
          <Chip label="Capacidades" size="small" sx={{ bgcolor: "#4caf50", color: "white", fontWeight: 600 }} />
        </DialogTitle>
        <DialogContent>
          {capDialog.loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : capDialog.data ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
                    Datos del Cliente
                  </Typography>
                  <Stack spacing={1}>
                    <DetailRow label="Nombre" value={String(capDialog.data.nombres || "—")} />
                    <DetailRow label="Convenio" value={String(capDialog.data.convenio || "—")} />
                    <DetailRow label="Teléfono" value={String(capDialog.data.tel_1 || capDialog.data.imss_telefonos || "—")} />
                    <DetailRow label="NSS" value={String(capDialog.data.nss || "—")} />
                    <DetailRow label="CURP" value={String(capDialog.data.curp || "—")} />
                    <DetailRow label="RFC" value={String(capDialog.data.rfc || "—")} />
                    <DetailRow label="No. Empleado" value={String(capDialog.data.numero_empleado || "—")} />
                  </Stack>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "#4caf50" }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: 11, color: "#4caf50" }}>
                    Información IMSS
                  </Typography>
                  <Stack spacing={1}>
                    <DetailRow label="Capacidad Actual" value={
                      capDialog.data.imss_capacidad_actual != null
                        ? `$${Number(capDialog.data.imss_capacidad_actual).toLocaleString("es-MX")}`
                        : "—"
                    } />
                    <DetailRow label="Num. Créditos" value={String(capDialog.data.imss_num_creditos ?? "—")} />
                    <DetailRow label="Teléfonos IMSS" value={String(capDialog.data.imss_telefonos || "—")} />
                    {capDialog.data.fecha_solicitud ? (
                      <DetailRow label="Fecha Solicitud" value={new Date(String(capDialog.data.fecha_solicitud)).toLocaleString("es-MX")} />
                    ) : null}
                  </Stack>
                  {capDialog.data.respuesta ? (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontSize: 11 }}>
                        RESPUESTA COMPLETA
                      </Typography>
                      <Paper sx={{ p: 1.5, bgcolor: "grey.50", borderRadius: 1, maxHeight: 200, overflow: "auto" }}>
                        <Typography variant="body2" sx={{ fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                          {String(capDialog.data.respuesta)}
                        </Typography>
                      </Paper>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCapDialog({ open: false, loading: false, data: null })} startIcon={<ArrowBackIcon />}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════ MODALS ═══════ */}
      <CaptacionModal
        open={captacionOpen}
        onClose={() => setCaptacionOpen(false)}
        onSuccess={(opId) => {
          setCaptacionOpen(false);
          fetchData();
          setSnackbar({ open: true, message: "Cliente captado exitosamente", severity: "success" });
        }}
      />

      <SolicitarAsignacionDialog
        open={asignacionOpen}
        onClose={() => setAsignacionOpen(false)}
        onSuccess={() => {
          setAsignacionOpen(false);
          fetchData();
          setSnackbar({ open: true, message: "Asignación completada", severity: "success" });
        }}
      />

      <CampanaCrearDialog
        open={campanaOpen}
        onClose={() => setCampanaOpen(false)}
        onSuccess={() => {
          setCampanaOpen(false);
          setSelectedIds([]);
          setSnackbar({ open: true, message: "Campaña creada exitosamente", severity: "success" });
        }}
        destinatarios={destinatariosSeleccionados}
        mensajeInicial={mensajeInicial}
      />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{ fontSize: 13 }}>{value || "—"}</Typography>
    </Box>
  );
}
