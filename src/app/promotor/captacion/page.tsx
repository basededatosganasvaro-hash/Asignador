"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";
import { Button } from "@/components/ui/Button";

const ORIGENES = [
  { value: "CAMBACEO", label: "Cambaceo" },
  { value: "REFERIDO", label: "Referido" },
  { value: "REDES_SOCIALES", label: "Redes sociales" },
  { value: "MMP_PROSPECCION", label: "MMP Prospeccion" },
  { value: "CCC", label: "CCC" },
  { value: "EXCEL", label: "Excel" },
  { value: "OTRO", label: "Otro" },
];

const CAMPO_LABELS: Record<string, string> = {
  nss: "NSS",
  curp: "CURP",
  rfc: "RFC",
  num_empleado: "Numero de empleado",
  tel_2: "Telefono 2",
  estado: "Estado",
  municipio: "Municipio",
  direccion_email: "Email",
  a_paterno: "Apellido paterno",
  a_materno: "Apellido materno",
};

interface Convenio {
  id: number;
  nombre: string;
}

interface Regla {
  id: number;
  campo: string;
  obligatorio: boolean;
}

export default function CaptacionPage() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    origen_captacion: "",
    convenio: "",
    nombres: "",
    a_paterno: "",
    a_materno: "",
    tel_1: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingReglas, setLoadingReglas] = useState(false);

  useEffect(() => {
    fetch("/api/captaciones/convenios")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setConvenios)
      .catch(() => setError("Error al cargar convenios"));
  }, []);

  const handleConvenioChange = async (convenio: string) => {
    setForm((p) => ({ ...p, convenio }));
    if (!convenio) { setReglas([]); return; }
    setLoadingReglas(true);
    try {
      const res = await fetch(`/api/captaciones/reglas?convenio=${encodeURIComponent(convenio)}`);
      if (!res.ok) throw new Error();
      setReglas(await res.json());
    } catch {
      setError("Error al cargar reglas del convenio");
    } finally {
      setLoadingReglas(false);
    }
  };

  const handleField = (campo: string, valor: string) => {
    setForm((p) => ({ ...p, [campo]: valor }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.origen_captacion || !form.convenio) {
      setError("Selecciona el origen y el convenio");
      return;
    }

    const { origen_captacion, convenio, ...datosRest } = form;
    const datos = Object.fromEntries(
      Object.entries(datosRest).filter(([, v]) => v.trim() !== "")
    );

    setSaving(true);
    try {
      const res = await fetch("/api/captaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen_captacion, convenio, datos }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.oportunidad_id) {
          router.push(`/promotor/oportunidades/${data.oportunidad_id}`);
          return;
        }
        setError(data.error ?? "Error al captar");
        return;
      }

      const { id } = await res.json();
      router.push(`/promotor/oportunidades/${id}`);
    } catch {
      setError("Error de conexion");
    } finally {
      setSaving(false);
    }
  };

  // Campos extra del convenio (excluyendo los base que ya se muestran)
  const camposBase = ["nombres", "a_paterno", "a_materno", "tel_1"];
  const camposExtra = reglas.filter((r) => !camposBase.includes(r.campo));

  return (
    <div className="max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-7 h-7 text-amber-400" />
        <h1 className="text-xl font-bold text-slate-100">Captar cliente</h1>
      </div>

      <div className="bg-surface rounded-xl border border-slate-800/60 p-6">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5">

            {/* Origen y convenio */}
            <Select
              label="Origen de captacion *"
              value={form.origen_captacion}
              onChange={(e) => handleField("origen_captacion", e.target.value)}
              options={ORIGENES}
              placeholder="Seleccionar origen"
            />

            <Select
              label="Convenio *"
              value={form.convenio}
              onChange={(e) => handleConvenioChange(e.target.value)}
              options={convenios.map((c) => ({ value: c.nombre, label: c.nombre }))}
              placeholder="Seleccionar convenio"
            />

            <Divider />

            {/* Datos base del prospecto */}
            <p className="text-sm font-medium text-slate-500">Datos del prospecto</p>

            <Input
              label="Nombres *"
              value={form.nombres}
              onChange={(e) => handleField("nombres", e.target.value)}
              required
            />

            <div className="flex gap-3">
              <Input
                label="Apellido paterno"
                value={form.a_paterno}
                onChange={(e) => handleField("a_paterno", e.target.value)}
              />
              <Input
                label="Apellido materno"
                value={form.a_materno}
                onChange={(e) => handleField("a_materno", e.target.value)}
              />
            </div>

            <Input
              label="Telefono *"
              value={form.tel_1}
              onChange={(e) => handleField("tel_1", e.target.value)}
              required
            />

            {/* Campos extra por convenio */}
            {loadingReglas && <Spinner size="sm" />}

            {camposExtra.length > 0 && (
              <>
                <Divider />
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">
                    Campos del convenio
                  </p>
                  <Badge color="slate">{form.convenio}</Badge>
                </div>
                {camposExtra.map((regla) => (
                  <Input
                    key={regla.campo}
                    label={`${CAMPO_LABELS[regla.campo] ?? regla.campo}${regla.obligatorio ? " *" : ""}`}
                    required={regla.obligatorio}
                    value={form[regla.campo] ?? ""}
                    onChange={(e) => handleField(regla.campo, e.target.value)}
                  />
                ))}
              </>
            )}

            {error && <Alert variant="error">{error}</Alert>}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={saving}
              loading={saving}
              icon={!saving ? <UserPlus className="w-5 h-5" /> : undefined}
            >
              {saving ? "Guardando..." : "Captar cliente"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
