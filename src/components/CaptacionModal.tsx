"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { UserPlus, FileUp } from "lucide-react";
import ImportCaptacionDialog from "@/components/ImportCaptacionDialog";

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

interface Convenio { id: number; nombre: string; }
interface Regla { id: number; campo: string; obligatorio: boolean; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (opId: number) => void;
}

const TAB_ITEMS = [
  { id: "individual", label: "Individual", icon: <UserPlus className="w-4 h-4" /> },
  { id: "masiva", label: "Carga Masiva", icon: <FileUp className="w-4 h-4" /> },
];

export default function CaptacionModal({ open, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState("individual");
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
    if (open) {
      fetch("/api/captaciones/convenios")
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(setConvenios)
        .catch(() => setError("Error al cargar convenios"));
    }
  }, [open]);

  const resetForm = () => {
    setForm({
      origen_captacion: "",
      convenio: "",
      nombres: "",
      a_paterno: "",
      a_materno: "",
      tel_1: "",
    });
    setReglas([]);
    setError("");
    setTab("individual");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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
        setError(data.error ?? "Error al captar");
        return;
      }

      const { id } = await res.json();
      resetForm();
      onSuccess(id);
    } catch {
      setError("Error de conexion");
    } finally {
      setSaving(false);
    }
  };

  const camposBase = ["nombres", "a_paterno", "a_materno", "tel_1"];
  const camposExtra = reglas.filter((r) => !camposBase.includes(r.campo));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg">
      <DialogHeader onClose={handleClose}>
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-amber-400" />
          <span>Captar Cliente</span>
        </div>
      </DialogHeader>

      <div className="px-6 pt-2">
        <Tabs
          tabs={TAB_ITEMS}
          activeTab={tab}
          onChange={setTab}
        />
      </div>

      {tab === "individual" ? (
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="flex flex-col gap-4">
              <Select
                label="Origen de captacion *"
                value={form.origen_captacion}
                onChange={(e) => handleField("origen_captacion", e.target.value)}
                options={ORIGENES}
                placeholder="Seleccionar origen"
                required
              />

              <Select
                label="Convenio *"
                value={form.convenio}
                onChange={(e) => handleConvenioChange(e.target.value)}
                options={convenios.map((c) => ({ value: c.nombre, label: c.nombre }))}
                placeholder="Seleccionar convenio"
                required
              />

              <div className="h-px bg-slate-800/40 my-1" />

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

              {loadingReglas && <Spinner size="sm" />}

              {camposExtra.length > 0 && (
                <>
                  <div className="h-px bg-slate-800/40 my-1" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-400">
                      Campos del convenio
                    </span>
                    <Badge color="amber">{form.convenio}</Badge>
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
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="danger" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              icon={!saving ? <UserPlus className="w-4 h-4" /> : undefined}
            >
              {saving ? "Guardando..." : "Captar"}
            </Button>
          </DialogFooter>
        </form>
      ) : (
        <DialogBody>
          <ImportCaptacionDialog
            open={true}
            onClose={handleClose}
            onSuccess={() => {
              resetForm();
              onSuccess(0);
            }}
            embedded
          />
        </DialogBody>
      )}
    </Dialog>
  );
}
