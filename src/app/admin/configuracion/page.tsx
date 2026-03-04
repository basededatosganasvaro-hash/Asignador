"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tooltip } from "@/components/ui/Tooltip";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  Save,
  HelpCircle,
  Settings,
  Clock,
  ClipboardList,
  Timer,
  Layers,
  PauseCircle,
  Shield,
  Info,
  Hourglass,
  FlaskConical,
  X,
} from "lucide-react";

interface Config {
  id: number;
  clave: string;
  valor: string;
}

interface Etapa {
  id: number;
  nombre: string;
  orden: number;
  tipo: string;
  timer_horas: number | null;
  color: string;
  activo: boolean;
}

interface Promotor {
  id: number;
  nombre: string;
  username: string;
}

// Defaults match microservice config
const WA_DEFAULTS: Record<string, number> = {
  wa_delay_min: 8000,
  wa_delay_max: 25000,
  wa_burst_min: 5,
  wa_burst_max: 12,
  wa_burst_pause_min: 120000,
  wa_burst_pause_max: 420000,
  wa_daily_limit: 180,
};

// Fields that store ms but display as seconds
const MS_FIELDS = new Set([
  "wa_delay_min",
  "wa_delay_max",
  "wa_burst_pause_min",
  "wa_burst_pause_max",
]);

function msToSeconds(key: string, val: number): number {
  return MS_FIELDS.has(key) ? Math.round(val / 1000) : val;
}

function secondsToMs(key: string, val: number): number {
  return MS_FIELDS.has(key) ? val * 1000 : val;
}

interface WaField {
  key: string;
  label: string;
  tooltip: string;
  unit: string;
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "Intervalo entre mensajes": <Timer className="w-4 h-4 text-slate-400" />,
  "Rafagas": <Layers className="w-4 h-4 text-slate-400" />,
  "Pausas entre rafagas": <PauseCircle className="w-4 h-4 text-slate-400" />,
  "Limite diario": <Shield className="w-4 h-4 text-slate-400" />,
};

const WA_FIELD_GROUPS: { title: string; fields: WaField[] }[] = [
  {
    title: "Intervalo entre mensajes",
    fields: [
      {
        key: "wa_delay_min",
        label: "Delay minimo",
        tooltip: "Tiempo minimo de espera entre mensajes. Valores bajos aumentan riesgo de ban.",
        unit: "segundos",
      },
      {
        key: "wa_delay_max",
        label: "Delay maximo",
        tooltip: "Tiempo maximo de espera entre mensajes.",
        unit: "segundos",
      },
    ],
  },
  {
    title: "Rafagas",
    fields: [
      {
        key: "wa_burst_min",
        label: "Mensajes minimos por rafaga",
        tooltip: "Minimo de mensajes enviados antes de una pausa larga.",
        unit: "mensajes",
      },
      {
        key: "wa_burst_max",
        label: "Mensajes maximos por rafaga",
        tooltip: "Maximo de mensajes enviados antes de una pausa larga.",
        unit: "mensajes",
      },
    ],
  },
  {
    title: "Pausas entre rafagas",
    fields: [
      {
        key: "wa_burst_pause_min",
        label: "Pausa minima",
        tooltip: "Pausa minima entre rafagas. Ej: 120 = 2 minutos.",
        unit: "segundos",
      },
      {
        key: "wa_burst_pause_max",
        label: "Pausa maxima",
        tooltip: "Pausa maxima entre rafagas. Ej: 420 = 7 minutos.",
        unit: "segundos",
      },
    ],
  },
  {
    title: "Limite diario",
    fields: [
      {
        key: "wa_daily_limit",
        label: "Limite diario por promotor",
        tooltip: "Maximo de mensajes por promotor por dia. Protege contra spam.",
        unit: "mensajes",
      },
    ],
  },
];

export default function ConfiguracionPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [maxRegistros, setMaxRegistros] = useState("300");
  const [horarioActivo, setHorarioActivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tiempos de permanencia (etapas AVANCE)
  const [etapasAvance, setEtapasAvance] = useState<Etapa[]>([]);
  const [timerValues, setTimerValues] = useState<Record<number, string>>({});
  const [timerSaving, setTimerSaving] = useState(false);

  // Beta testers state
  const [betaActivo, setBetaActivo] = useState(false);
  const [betaUsuarios, setBetaUsuarios] = useState<Promotor[]>([]);
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [selectedPromotor, setSelectedPromotor] = useState("");

  // WhatsApp config state -- display values (seconds for ms fields, raw for others)
  const [waValues, setWaValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [key, val] of Object.entries(WA_DEFAULTS)) {
      init[key] = String(msToSeconds(key, val));
    }
    return init;
  });
  const [waErrors, setWaErrors] = useState<Record<string, string>>({});
  const [waSaving, setWaSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/configuracion").then((res) => {
        if (!res.ok) throw new Error("Error al cargar configuracion");
        return res.json();
      }),
      fetch("/api/admin/embudo/etapas").then((res) => {
        if (!res.ok) throw new Error("Error al cargar etapas");
        return res.json();
      }),
      fetch("/api/admin/usuarios/promotores").then((res) => {
        if (!res.ok) throw new Error("Error al cargar promotores");
        return res.json();
      }),
    ])
      .then(([configData, etapasData, promotoresData]: [Config[], Etapa[], Promotor[]]) => {
        setConfigs(configData);
        setPromotores(promotoresData);

        const maxReg = configData.find((c: Config) => c.clave === "max_registros_por_dia");
        if (maxReg) setMaxRegistros(maxReg.valor);
        const horario = configData.find((c: Config) => c.clave === "horario_activo");
        if (horario) setHorarioActivo(horario.valor !== "false");

        // Load wa_* values from BD
        const newWaValues: Record<string, string> = {};
        for (const [key, defaultVal] of Object.entries(WA_DEFAULTS)) {
          const found = configData.find((c: Config) => c.clave === key);
          const rawVal = found ? Number(found.valor) : defaultVal;
          newWaValues[key] = String(msToSeconds(key, rawVal));
        }
        setWaValues(newWaValues);

        // Load etapas AVANCE con timer
        const avance = etapasData.filter((e: Etapa) => e.tipo === "AVANCE" && e.activo);
        setEtapasAvance(avance);
        const timers: Record<number, string> = {};
        for (const e of avance) {
          timers[e.id] = e.timer_horas != null ? String(e.timer_horas) : "";
        }
        setTimerValues(timers);

        // Load beta testers config
        const betaConfig = configData.find((c: Config) => c.clave === "wa_beta_activo");
        const betaUsersConfig = configData.find((c: Config) => c.clave === "wa_beta_usuarios");
        setBetaActivo(betaConfig?.valor === "true");

        if (betaUsersConfig) {
          const ids = betaUsersConfig.valor
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
          const testers = promotoresData.filter((p: Promotor) => ids.includes(p.id));
          setBetaUsuarios(testers);
        }

        setLoading(false);
      })
      .catch(() => {
        toast("Error al cargar configuracion", "error");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clave: "max_registros_por_dia",
        valor: maxRegistros,
      }),
    });

    setSaving(false);

    if (res.ok) {
      toast("Configuracion guardada", "success");
    } else {
      toast("Error al guardar", "error");
    }
  };

  // WhatsApp validation
  const validateWa = (): boolean => {
    const errors: Record<string, string> = {};
    const vals: Record<string, number> = {};

    for (const key of Object.keys(WA_DEFAULTS)) {
      const num = Number(waValues[key]);
      if (isNaN(num) || num <= 0) {
        errors[key] = "Debe ser mayor a 0";
      }
      vals[key] = num;
    }

    // Min <= Max pairs
    const pairs: [string, string, string][] = [
      ["wa_delay_min", "wa_delay_max", "Delay minimo no puede ser mayor que el maximo"],
      ["wa_burst_min", "wa_burst_max", "Burst minimo no puede ser mayor que el maximo"],
      ["wa_burst_pause_min", "wa_burst_pause_max", "Pausa minima no puede ser mayor que la maxima"],
    ];

    for (const [minKey, maxKey, msg] of pairs) {
      if (!errors[minKey] && !errors[maxKey] && vals[minKey] > vals[maxKey]) {
        errors[minKey] = msg;
        errors[maxKey] = msg;
      }
    }

    // Daily limit range
    if (!errors["wa_daily_limit"] && (vals["wa_daily_limit"] < 1 || vals["wa_daily_limit"] > 1000)) {
      errors["wa_daily_limit"] = "Debe estar entre 1 y 1000";
    }

    setWaErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleWaSave = async () => {
    if (!validateWa()) return;

    setWaSaving(true);
    let allOk = true;

    for (const [key, displayVal] of Object.entries(waValues)) {
      const storeVal = secondsToMs(key, Number(displayVal));
      const res = await fetch("/api/admin/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave: key, valor: String(storeVal) }),
      });
      if (!res.ok) allOk = false;
    }

    setWaSaving(false);
    toast(
      allOk ? "Configuracion WhatsApp guardada" : "Error al guardar algunos valores",
      allOk ? "success" : "error"
    );
  };

  // Beta testers helpers
  const saveBetaUsuarios = async (ids: number[]) => {
    const valor = ids.length > 0 ? ids.join(",") : " ";
    const res = await fetch("/api/admin/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: "wa_beta_usuarios", valor }),
    });
    return res.ok;
  };

  const handleBetaToggle = async (checked: boolean) => {
    setBetaActivo(checked);
    const res = await fetch("/api/admin/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: "wa_beta_activo", valor: String(checked) }),
    });
    if (res.ok) {
      toast(checked ? "Modo beta activado" : "Modo beta desactivado — todos tienen acceso", "success");
    } else {
      setBetaActivo(!checked);
      toast("Error al cambiar modo beta", "error");
    }
  };

  const handleAddTester = async () => {
    const id = Number(selectedPromotor);
    if (!id) return;
    const promotor = promotores.find((p) => p.id === id);
    if (!promotor || betaUsuarios.some((u) => u.id === id)) return;

    const newTesters = [...betaUsuarios, promotor];
    const ok = await saveBetaUsuarios(newTesters.map((u) => u.id));
    if (ok) {
      setBetaUsuarios(newTesters);
      setSelectedPromotor("");
      toast(`${promotor.nombre} agregado como tester`, "success");
    } else {
      toast("Error al agregar tester", "error");
    }
  };

  const handleRemoveTester = async (id: number) => {
    const newTesters = betaUsuarios.filter((u) => u.id !== id);
    const ok = await saveBetaUsuarios(newTesters.map((u) => u.id));
    if (ok) {
      setBetaUsuarios(newTesters);
      toast("Tester removido", "success");
    } else {
      toast("Error al remover tester", "error");
    }
  };

  const handleTimerSave = async () => {
    setTimerSaving(true);
    let allOk = true;

    for (const etapa of etapasAvance) {
      const val = timerValues[etapa.id];
      const numVal = val === "" ? null : Number(val);
      if (numVal !== null && (isNaN(numVal) || numVal <= 0)) {
        toast(`"${etapa.nombre}": debe ser un numero positivo`, "error");
        setTimerSaving(false);
        return;
      }
      const res = await fetch(`/api/admin/embudo/etapas/${etapa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timer_horas: numVal }),
      });
      if (!res.ok) allOk = false;
    }

    setTimerSaving(false);
    toast(
      allOk ? "Tiempos de permanencia guardados" : "Error al guardar algunos tiempos",
      allOk ? "success" : "error"
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header de pagina */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
          <Settings className="w-7 h-7 text-slate-950" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Configuracion del Sistema
          </h1>
          <span className="text-sm text-slate-400">
            Administra los parametros operativos del sistema
          </span>
        </div>
      </div>

      {/* Grid 2×2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Card Horario Operativo */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600" />
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            Horario Operativo
          </h2>
          <Tooltip content="Controla la ventana horaria en que los promotores pueden acceder al sistema">
            <HelpCircle className="w-4 h-4 text-slate-600 cursor-help" />
          </Tooltip>
        </div>
        <span className="text-sm text-slate-400 block mb-4 ml-8">
          Controla si el sistema aplica la restriccion de horario para promotores (08:55 - 19:15 L-V).
        </span>
        <div className="ml-8">
          <Tooltip content="Cuando esta desactivado, los promotores pueden acceder en cualquier horario">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <div className="relative inline-flex">
                <input
                  type="checkbox"
                  checked={horarioActivo}
                  onChange={async (e) => {
                    const nuevoValor = e.target.checked;
                    setHorarioActivo(nuevoValor);
                    const res = await fetch("/api/admin/configuracion", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ clave: "horario_activo", valor: String(nuevoValor) }),
                    });
                    if (res.ok) {
                      toast(nuevoValor ? "Horario activado" : "Horario desactivado", "success");
                    } else {
                      setHorarioActivo(!nuevoValor);
                      toast("Error al cambiar horario", "error");
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-checked:bg-amber-500 rounded-full transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
              </div>
              <span className="text-sm text-slate-300">
                {horarioActivo ? "Horario activo" : "Horario desactivado (acceso libre)"}
              </span>
            </label>
          </Tooltip>
        </div>
      </div>

      {/* Card Asignaciones */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500 to-green-600" />
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            Asignaciones
          </h2>
          <Tooltip content="Configura los limites de asignacion de registros para promotores">
            <HelpCircle className="w-4 h-4 text-slate-600 cursor-help" />
          </Tooltip>
        </div>
        <span className="text-sm text-slate-400 block mb-4 ml-8">
          Define cuantos registros puede solicitar cada promotor por dia.
        </span>
        <div className="ml-8">
          <Tooltip content="Controla cuantos registros puede solicitar cada promotor en un dia">
            <div>
              <Input
                label="Maximo de registros por dia por promotor"
                type="number"
                value={maxRegistros}
                onChange={(e) => setMaxRegistros(e.target.value)}
                helperText="Cantidad maxima de registros que un promotor puede solicitar en un dia"
                min={1}
                max={10000}
              />
            </div>
          </Tooltip>
          <Button
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            loading={saving}
            onClick={handleSave}
            className="mt-4 !bg-green-600 hover:!bg-green-500 !shadow-green-600/20"
          >
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Card Tiempos de Permanencia */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="flex items-center gap-3 mb-2">
          <Hourglass className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            Tiempos de Permanencia
          </h2>
          <Tooltip content="Tiempo maximo que una oportunidad puede permanecer en cada etapa de avance antes de ser devuelta al pool">
            <HelpCircle className="w-4 h-4 text-slate-600 cursor-help" />
          </Tooltip>
        </div>
        <span className="text-sm text-slate-400 block mb-4 ml-8">
          Define cuantas horas puede permanecer una oportunidad en cada etapa de avance.
        </span>
        <div className="ml-8 flex flex-col gap-3">
          {etapasAvance.map((etapa) => (
            <div key={etapa.id} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: etapa.color }}
              />
              <label className="text-sm text-slate-300 w-40 flex-shrink-0">
                {etapa.nombre}
              </label>
              <input
                type="number"
                value={timerValues[etapa.id] ?? ""}
                onChange={(e) =>
                  setTimerValues((prev) => ({ ...prev, [etapa.id]: e.target.value }))
                }
                placeholder="Sin limite"
                min={1}
                className="w-24 px-3 py-1.5 bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all"
              />
              <span className="text-xs text-slate-500">horas</span>
            </div>
          ))}
          {etapasAvance.length === 0 && (
            <span className="text-sm text-slate-500">No hay etapas de avance configuradas</span>
          )}
        </div>
        {etapasAvance.length > 0 && (
          <div className="ml-8 mt-4">
            <Button
              variant="primary"
              icon={<Save className="w-4 h-4" />}
              loading={timerSaving}
              onClick={handleTimerSave}
              className="!bg-amber-600 hover:!bg-amber-500 !shadow-amber-600/20"
            >
              Guardar Cambios
            </Button>
          </div>
        )}
      </div>

      {/* Card WhatsApp Masivo */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />
        <div className="flex items-center gap-3 mb-2">
          {/* WhatsApp custom SVG icon */}
          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <h2 className="text-lg font-semibold text-slate-100">
            Configuracion de Envio Masivo WhatsApp
          </h2>
          <Tooltip content="Parametros anti-spam que regulan la velocidad y volumen de envio de mensajes">
            <HelpCircle className="w-4 h-4 text-slate-600 cursor-help" />
          </Tooltip>
        </div>
        <span className="text-sm text-slate-400 block mb-4 ml-8">
          Parametros anti-spam para el envio masivo de mensajes.
        </span>

        <div className="ml-8 mb-5">
          <Alert variant="info" icon={<Info className="w-4 h-4" />}>
            Los cambios aplican a partir de la siguiente campana
          </Alert>
        </div>

        <div className="ml-8 flex flex-col gap-4">
          {WA_FIELD_GROUPS.map((group) => (
            <div key={group.title} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
              <div className="flex items-center gap-2 mb-3">
                {GROUP_ICONS[group.title]}
                <span className="text-sm font-medium text-slate-400">
                  {group.title}
                </span>
              </div>
              <div className="flex gap-3 flex-wrap">
                {group.fields.map((field) => (
                  <div
                    key={field.key}
                    className={group.fields.length === 1 ? "flex-1 basis-full" : "flex-1 basis-[calc(50%-6px)]"}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <label className="block text-sm font-medium text-slate-300">
                        {field.label}
                      </label>
                      <Tooltip content={field.tooltip}>
                        <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-help" />
                      </Tooltip>
                    </div>
                    <input
                      type="number"
                      value={waValues[field.key]}
                      onChange={(e) => {
                        setWaValues((prev) => ({ ...prev, [field.key]: e.target.value }));
                        setWaErrors((prev) => {
                          const next = { ...prev };
                          delete next[field.key];
                          return next;
                        });
                      }}
                      min={1}
                      className={`
                        w-full px-3 py-2 bg-slate-800/50 border text-slate-200
                        placeholder-slate-600 rounded-lg text-sm
                        focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60
                        outline-none transition-all
                        ${waErrors[field.key] ? "border-red-500/60" : "border-slate-700"}
                      `.trim()}
                    />
                    {waErrors[field.key] ? (
                      <p className="mt-1 text-xs text-red-400">{waErrors[field.key]}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-600">{field.unit}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="ml-8 mt-5">
          <Tooltip content="Guarda todos los parametros anti-spam">
            <Button
              variant="primary"
              icon={<Save className="w-4 h-4" />}
              loading={waSaving}
              onClick={handleWaSave}
              className="!bg-emerald-600 hover:!bg-emerald-500 !shadow-emerald-600/20"
            >
              Guardar Cambios
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Card Beta Testers — WhatsApp Masivo */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-purple-400" />
        <div className="flex items-center gap-3 mb-2">
          <FlaskConical className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            Beta Testers — WhatsApp Masivo
          </h2>
          <Tooltip content="Controla que promotores pueden acceder a WhatsApp Masivo durante la fase de pruebas">
            <HelpCircle className="w-4 h-4 text-slate-600 cursor-help" />
          </Tooltip>
        </div>
        <span className="text-sm text-slate-400 block mb-4 ml-8">
          Cuando el modo beta esta activo, solo los promotores seleccionados pueden usar WhatsApp Masivo.
        </span>

        {/* Toggle beta */}
        <div className="ml-8 mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <div className="relative inline-flex">
              <input
                type="checkbox"
                checked={betaActivo}
                onChange={(e) => handleBetaToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-700 peer-checked:bg-purple-500 rounded-full transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm text-slate-300">
              {betaActivo ? "Modo beta activo — acceso restringido" : "Modo beta desactivado — todos tienen acceso"}
            </span>
          </label>
        </div>

        {/* Testers list (only when beta active) */}
        {betaActivo && (
          <div className="ml-8">
            {/* Add tester */}
            <div className="flex items-center gap-2 mb-4">
              <select
                value={selectedPromotor}
                onChange={(e) => setSelectedPromotor(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/60 outline-none transition-all"
              >
                <option value="">Seleccionar promotor...</option>
                {promotores
                  .filter((p) => !betaUsuarios.some((u) => u.id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (@{p.username})
                    </option>
                  ))}
              </select>
              <Button
                variant="primary"
                onClick={handleAddTester}
                disabled={!selectedPromotor}
                className="!bg-purple-600 hover:!bg-purple-500 !shadow-purple-600/20"
              >
                Agregar
              </Button>
            </div>

            {/* Testers list */}
            {betaUsuarios.length === 0 ? (
              <span className="text-sm text-slate-500">No hay testers seleccionados. Todos los promotores estan bloqueados.</span>
            ) : (
              <div className="flex flex-col gap-2">
                {betaUsuarios.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/40"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm font-semibold text-purple-300">
                      {user.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-200 block truncate">{user.nombre}</span>
                      <span className="text-xs text-slate-500">@{user.username}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveTester(user.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                      title="Remover tester"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      </div>{/* end grid */}
    </div>
  );
}
