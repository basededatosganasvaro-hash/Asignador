"use client";
import { useState, useEffect, useCallback } from "react";
import { Smartphone, HelpCircle, Unplug, Clock, Flame } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import WhatsAppQRDialog from "@/components/WhatsAppQRDialog";
import WhatsAppGuiaModal from "@/components/WhatsAppGuiaModal";
import CampanaProgreso from "@/components/CampanaProgreso";

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface WaStatus {
  estado: string;
  numero_wa: string | null;
  ultimo_uso: string | null;
  activo_en_memoria: boolean;
  warmup?: {
    enWarmup: boolean;
    primerEnvioAt: string | null;
    diasTranscurridos: number | null;
    limiteEfectivo: number;
    enviadosHoy: number;
    limiteDiarioMaduro: number;
  };
  ventana?: {
    abierta: boolean;
    horaInicio: number;
    horaFin: number;
    proximaAperturaEnMs: number;
  };
}

function formatMsToHuman(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [guiaOpen, setGuiaOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("wa_guia_vista")) setGuiaOpen(true);
  }, []);

  const handleGuiaClose = () => {
    localStorage.setItem("wa_guia_vista", "1");
    setGuiaOpen(false);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/sesion/estado");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/whatsapp/sesion/disconnect", { method: "POST" });
      await fetchStatus();
    } catch { /* ignore */ }
    setDisconnecting(false);
  };

  const isConnected = status?.estado === "CONECTADO";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-semibold text-slate-100">WhatsApp Masivo</h1>
        <Tooltip content="Estrategias anti-bloqueo">
          <button
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800/50"
            onClick={() => setGuiaOpen(true)}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Envia mensajes masivos a tus clientes desde tu WhatsApp
      </p>

      {/* Estado de conexion */}
      <Card className="mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Smartphone className={`w-10 h-10 ${isConnected ? "text-[#25D366]" : "text-slate-600"}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">WhatsApp</span>
              {isConnected ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#25D366] text-white">
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
                  {status?.estado || "Desconectado"}
                </span>
              )}
            </div>
            {isConnected && status?.numero_wa && (
              <p className="text-sm text-slate-500">
                Numero: +{status.numero_wa}
              </p>
            )}
            {status?.ultimo_uso && (
              <p className="text-xs text-slate-500">
                Ultimo uso: {new Date(status.ultimo_uso).toLocaleString("es-MX")}
              </p>
            )}
          </div>

          {isConnected ? (
            <Button
              variant="danger"
              size="sm"
              icon={<Unplug className="w-4 h-4" />}
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              Desconectar
            </Button>
          ) : (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-[#25D366] hover:bg-[#1da851]"
              onClick={() => setQrOpen(true)}
            >
              <WhatsAppIcon className="w-4 h-4" />
              Conectar WhatsApp
            </button>
          )}
        </div>
      </Card>

      {!isConnected && (
        <Alert variant="info" className="mb-6">
          Conecta tu WhatsApp para poder enviar mensajes masivos. Ve a &quot;Mi Asignacion&quot;,
          selecciona clientes y usa el boton &quot;Enviar WhatsApp Masivo&quot;.
        </Alert>
      )}

      {/* Banner warmup: periodo de calentamiento de cuenta nueva */}
      {isConnected && status?.warmup?.enWarmup && (
        <Alert variant="warning" className="mb-4" icon={<Flame className="w-4 h-4" />}>
          <div>
            <div className="font-semibold mb-1">Periodo de calentamiento</div>
            <div className="text-xs space-y-0.5">
              <div>
                Hoy: <span className="font-bold">{status.warmup.enviadosHoy}</span>
                {" / "}
                <span className="font-bold">{status.warmup.limiteEfectivo}</span>
                {" mensajes permitidos"}
              </div>
              <div className="text-amber-300/80">
                Los primeros días enviamos pocos mensajes para que WhatsApp no bloquee tu número.
                El límite sube a {status.warmup.limiteDiarioMaduro} cuando la cuenta madura (~3 días).
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Banner ventana horaria cerrada */}
      {isConnected && status?.ventana && !status.ventana.abierta && (
        <Alert variant="info" className="mb-4" icon={<Clock className="w-4 h-4" />}>
          <div>
            <div className="font-semibold mb-1">Envíos pausados fuera de horario</div>
            <div className="text-xs">
              Las campañas solo envían entre las {String(status.ventana.horaInicio).padStart(2, "0")}:00
              y las {String(status.ventana.horaFin).padStart(2, "0")}:00.
              {status.ventana.proximaAperturaEnMs > 0 && (
                <> Próxima apertura en <span className="font-bold">{formatMsToHuman(status.ventana.proximaAperturaEnMs)}</span>.</>
              )}
            </div>
          </div>
        </Alert>
      )}

      {/* Contador de envíos del día (cuenta madura) */}
      {isConnected && status?.warmup && !status.warmup.enWarmup && (
        <div className="mb-4 text-xs text-slate-500">
          Enviados hoy: <span className="text-slate-300 font-medium">{status.warmup.enviadosHoy}</span>
          {" / "}
          <span className="text-slate-300 font-medium">{status.warmup.limiteEfectivo}</span>
        </div>
      )}

      {/* Campanas activas */}
      <CampanaProgreso />

      {/* Guia anti-bloqueo */}
      <WhatsAppGuiaModal open={guiaOpen} onClose={handleGuiaClose} />

      {/* QR Dialog */}
      <WhatsAppQRDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConnected={() => { setQrOpen(false); fetchStatus(); }}
      />
    </div>
  );
}
