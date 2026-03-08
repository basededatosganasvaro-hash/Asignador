"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Search, Copy, ClipboardCheck, AlertTriangle } from "lucide-react";

interface ClienteResult {
  id: number;
  nss: string | null;
  nombres: string | null;
  a_paterno: string | null;
  a_materno: string | null;
  curp: string | null;
  rfc: string | null;
  tel_1: string | null;
  tel_2: string | null;
  tel_3: string | null;
  tel_4: string | null;
  tel_5: string | null;
  convenio: string | null;
  dependencia: string | null;
  estado: string | null;
  municipio: string | null;
  capacidad: string | null;
  oferta: string | null;
  edad: string | null;
  genero: string | null;
  tipo_pension: string | null;
  estatus: string | null;
}

interface Cupo {
  limite: number;
  usadas: number;
  restantes: number;
}

const MOTIVOS = [
  { value: "calificacion", label: "Calificacion" },
  { value: "tramite", label: "Tramite" },
  { value: "prospeccion", label: "Prospeccion" },
  { value: "validacion_datos", label: "Validacion de datos" },
  { value: "solicitud_pantalla", label: "Solicitud de pantalla" },
  { value: "solicitud_capacidad", label: "Solicitud de capacidad" },
];

const TIPOS = [
  { value: "CURP", label: "CURP" },
  { value: "RFC", label: "RFC" },
  { value: "TELEFONO", label: "Telefono" },
];

export default function BusquedaClientesPanel() {
  const { toast } = useToast();
  const [tipo, setTipo] = useState("CURP");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cupo, setCupo] = useState<Cupo | null>(null);
  const [resultados, setResultados] = useState<ClienteResult[] | null>(null);
  const [busquedaId, setBusquedaId] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/busquedas-clientes/cupo")
      .then((r) => r.json())
      .then((data) => setCupo(data))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!valor.trim()) {
      toast("Ingresa un valor de busqueda", "error");
      return;
    }
    if (!motivo) {
      toast("Selecciona un motivo de busqueda", "error");
      return;
    }
    if (cupo && cupo.restantes <= 0) {
      toast("Has alcanzado el limite de busquedas por hoy", "error");
      return;
    }

    setLoading(true);
    setResultados(null);
    setBusquedaId(null);

    try {
      const res = await fetch("/api/busquedas-clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, valor: valor.trim(), motivo }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Error al buscar", "error");
        if (data.cupo) setCupo(data.cupo);
        setLoading(false);
        return;
      }

      setResultados(data.resultados);
      setBusquedaId(data.busqueda_id);
      setCupo(data.cupo);

      if (data.resultados.length === 0) {
        toast("No se encontraron resultados", "info");
      }
    } catch {
      toast("Error de conexion", "error");
    }
    setLoading(false);
  };

  const logCopy = async (clienteId: number, campo: string) => {
    if (!busquedaId) return;
    try {
      await fetch("/api/busquedas-clientes/copiar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busqueda_id: busquedaId, cliente_id: clienteId, campo }),
      });
    } catch {
      // Silent — no bloquear UX por log
    }
  };

  const copyToClipboard = async (text: string, clienteId: number, campo: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(`${clienteId}-${campo}`);
      setTimeout(() => setCopiedField(null), 2000);
      logCopy(clienteId, campo);
      toast("Copiado al portapapeles", "success");
    } catch {
      toast("No se pudo copiar", "error");
    }
  };

  const copyAll = async (cliente: ClienteResult) => {
    const nombre = [cliente.nombres, cliente.a_paterno, cliente.a_materno].filter(Boolean).join(" ");
    const lines = [
      `NSS: ${cliente.nss || "-"}`,
      `Nombre: ${nombre || "-"}`,
      `CURP: ${cliente.curp || "-"}`,
      `RFC: ${cliente.rfc || "-"}`,
      `Tel 1: ${cliente.tel_1 || "-"}`,
      cliente.tel_2 ? `Tel 2: ${cliente.tel_2}` : null,
      cliente.tel_3 ? `Tel 3: ${cliente.tel_3}` : null,
      `Convenio: ${cliente.convenio || "-"}`,
      `Dependencia: ${cliente.dependencia || "-"}`,
      `Estado: ${cliente.estado || "-"}`,
      `Municipio: ${cliente.municipio || "-"}`,
      `Capacidad: ${cliente.capacidad || "-"}`,
      `Oferta: ${cliente.oferta || "-"}`,
      `Edad: ${cliente.edad || "-"}`,
      `Estatus: ${cliente.estatus || "-"}`,
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopiedField(`${cliente.id}-todos`);
      setTimeout(() => setCopiedField(null), 2000);
      logCopy(cliente.id, "todos");
      toast("Todos los datos copiados", "success");
    } catch {
      toast("No se pudo copiar", "error");
    }
  };

  const CopyBtn = ({ text, clienteId, campo }: { text: string; clienteId: number; campo: string }) => {
    if (!text || text === "-") return null;
    const isCopied = copiedField === `${clienteId}-${campo}`;
    return (
      <button
        onClick={() => copyToClipboard(text, clienteId, campo)}
        className="ml-1.5 p-0.5 rounded hover:bg-slate-700/50 text-slate-600 hover:text-slate-300 transition-colors inline-flex items-center"
        title="Copiar"
      >
        {isCopied ? <ClipboardCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center">
          <Search className="w-7 h-7 text-slate-950" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Busqueda de Clientes
          </h1>
          <span className="text-sm text-slate-400">
            Consulta informacion de clientes por CURP, RFC o telefono
          </span>
        </div>
        {cupo && (
          <div className="ml-auto">
            <span className={`text-sm font-medium px-3 py-1.5 rounded-full border ${
              cupo.restantes > 10
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : cupo.restantes > 0
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-red-500/10 text-red-400 border-red-500/30"
            }`}>
              {cupo.restantes}/{cupo.limite} busquedas restantes
            </span>
          </div>
        )}
      </div>

      {/* Formulario */}
      <div className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden mb-5">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-cyan-600" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo de busqueda</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 outline-none transition-all"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Valor */}
          <div>
            <Input
              label="Valor a buscar"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={tipo === "CURP" ? "CURP del cliente" : tipo === "RFC" ? "RFC del cliente" : "Numero de telefono"}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 outline-none transition-all"
            >
              <option value="">Selecciona motivo...</option>
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Boton */}
          <Button
            variant="primary"
            icon={<Search className="w-4 h-4" />}
            loading={loading}
            onClick={handleSearch}
            disabled={!valor.trim() || !motivo || (cupo?.restantes === 0)}
            className="!bg-cyan-600 hover:!bg-cyan-500 !shadow-cyan-600/20"
          >
            Buscar
          </Button>
        </div>
      </div>

      {/* Resultados */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {resultados !== null && !loading && resultados.length === 0 && (
        <div className="bg-surface rounded-xl border border-slate-800/60 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No se encontraron resultados para esta busqueda</p>
        </div>
      )}

      {resultados !== null && resultados.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            {resultados.length} resultado{resultados.length > 1 ? "s" : ""} encontrado{resultados.length > 1 ? "s" : ""}
          </p>

          {resultados.map((cliente) => {
            const nombre = [cliente.nombres, cliente.a_paterno, cliente.a_materno].filter(Boolean).join(" ");
            return (
              <div
                key={cliente.id}
                className="bg-surface rounded-xl border border-slate-800/60 p-5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-700 to-slate-600" />

                {/* Header del resultado */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">{nombre || "Sin nombre"}</h3>
                    <span className="text-xs text-slate-500">ID: {cliente.id} | NSS: {cliente.nss || "-"}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copiedField === `${cliente.id}-todos` ? <ClipboardCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    onClick={() => copyAll(cliente)}
                  >
                    Copiar todo
                  </Button>
                </div>

                {/* Grid de datos */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                  <DataField label="CURP" value={cliente.curp} clienteId={cliente.id} campo="curp" CopyBtn={CopyBtn} />
                  <DataField label="RFC" value={cliente.rfc} clienteId={cliente.id} campo="rfc" CopyBtn={CopyBtn} />
                  <DataField label="NSS" value={cliente.nss} clienteId={cliente.id} campo="nss" CopyBtn={CopyBtn} />
                  <DataField label="Telefono 1" value={cliente.tel_1} clienteId={cliente.id} campo="tel_1" CopyBtn={CopyBtn} />
                  {cliente.tel_2 && <DataField label="Telefono 2" value={cliente.tel_2} clienteId={cliente.id} campo="tel_2" CopyBtn={CopyBtn} />}
                  {cliente.tel_3 && <DataField label="Telefono 3" value={cliente.tel_3} clienteId={cliente.id} campo="tel_3" CopyBtn={CopyBtn} />}
                  <DataField label="Convenio" value={cliente.convenio} clienteId={cliente.id} campo="convenio" CopyBtn={CopyBtn} />
                  <DataField label="Dependencia" value={cliente.dependencia} clienteId={cliente.id} campo="dependencia" CopyBtn={CopyBtn} />
                  <DataField label="Estado" value={cliente.estado} clienteId={cliente.id} campo="estado" CopyBtn={CopyBtn} />
                  <DataField label="Municipio" value={cliente.municipio} clienteId={cliente.id} campo="municipio" CopyBtn={CopyBtn} />
                  <DataField label="Capacidad" value={cliente.capacidad} clienteId={cliente.id} campo="capacidad" CopyBtn={CopyBtn} />
                  <DataField label="Oferta" value={cliente.oferta} clienteId={cliente.id} campo="oferta" CopyBtn={CopyBtn} />
                  <DataField label="Edad" value={cliente.edad} clienteId={cliente.id} campo="edad" CopyBtn={CopyBtn} />
                  <DataField label="Genero" value={cliente.genero} clienteId={cliente.id} campo="genero" CopyBtn={CopyBtn} />
                  <DataField label="Tipo Pension" value={cliente.tipo_pension} clienteId={cliente.id} campo="tipo_pension" CopyBtn={CopyBtn} />
                  <DataField label="Estatus" value={cliente.estatus} clienteId={cliente.id} campo="estatus" CopyBtn={CopyBtn} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DataField({
  label,
  value,
  clienteId,
  campo,
  CopyBtn,
}: {
  label: string;
  value: string | null;
  clienteId: number;
  campo: string;
  CopyBtn: React.FC<{ text: string; clienteId: number; campo: string }>;
}) {
  const displayValue = value || "-";
  return (
    <div>
      <span className="text-xs text-slate-500 block">{label}</span>
      <span className="text-sm text-slate-200 inline-flex items-center">
        {displayValue}
        <CopyBtn text={displayValue} clienteId={clienteId} campo={campo} />
      </span>
    </div>
  );
}
