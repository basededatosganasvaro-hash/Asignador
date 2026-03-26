"use client";
import { useEffect, useState, useRef } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { FileUp, Download, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";

const ORIGENES = [
  { value: "CAMBACEO", label: "Cambaceo" },
  { value: "REFERIDO", label: "Referido" },
  { value: "REDES_SOCIALES", label: "Redes sociales" },
  { value: "MMP_PROSPECCION", label: "MMP Prospeccion" },
  { value: "CCC", label: "CCC" },
  { value: "EXCEL", label: "Excel" },
  { value: "OTRO", label: "Otro" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  embedded?: boolean;
}

interface Convenio {
  id: number;
  nombre: string;
}

function ConvenioAutocomplete({
  convenios,
  value,
  onChange,
}: {
  convenios: Convenio[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [showList, setShowList] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = convenios.filter((c) =>
    c.nombre.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-slate-400 mb-1">Convenio *</label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        placeholder="Buscar convenio..."
        className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 outline-none transition-all"
        required
      />
      {showList && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
          {filtered.map((c) => (
            <li
              key={c.id}
              onClick={() => {
                onChange(c.nombre);
                setQuery(c.nombre);
                setShowList(false);
              }}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                value === c.nombre
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              {c.nombre}
            </li>
          ))}
        </ul>
      )}
      {showList && query && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-500">
          Sin resultados
        </div>
      )}
    </div>
  );
}

export default function ImportCaptacionDialog({ open, onClose, onSuccess, embedded = false }: Props) {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [origen, setOrigen] = useState("");
  const [convenio, setConvenio] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetch("/api/captaciones/convenios")
        .then((r) => r.json())
        .then(setConvenios)
        .catch(() => {});
    }
  }, [open]);

  const handleClose = () => {
    setOrigen("");
    setConvenio("");
    setFile(null);
    setResult(null);
    setError("");
    onClose();
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/api/captaciones/template";
    link.download = "template_captaciones.xlsx";
    link.click();
  };

  const handleUpload = async () => {
    if (!file || !origen || !convenio) return;

    setUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("origen_captacion", origen);
    formData.append("convenio", convenio);

    try {
      const res = await fetch("/api/captaciones/importar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al importar");
        if (data.errors) setResult({ created: 0, errors: data.errors });
      } else {
        setResult(data);
        if (data.created > 0) {
          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      }
    } catch {
      setError("Error de conexion");
    } finally {
      setUploading(false);
    }
  };

  const content = (
    <div className={`flex flex-col gap-5 ${embedded ? "" : "mt-2"}`}>
      {/* Paso 1: Descargar template */}
      <div className="p-4 border-2 border-dashed border-amber-500/40 rounded-xl bg-amber-500/5 text-center">
        <h4 className="text-sm font-bold text-slate-200 mb-1">
          Paso 1: Descarga el template
        </h4>
        <p className="text-xs text-slate-400 mb-3">
          Llena el archivo Excel con los datos de tus prospectos y luego subelo aqui
        </p>
        <Button
          variant="primary"
          icon={<Download className="w-4 h-4" />}
          onClick={handleDownloadTemplate}
        >
          Descargar Template Excel
        </Button>
      </div>

      {/* Divider with label */}
      <div className="relative">
        <div className="h-px bg-slate-800/40" />
        <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-elevated px-3 text-xs text-slate-500 font-semibold">
          Paso 2: Configura la importacion
        </span>
      </div>

      <Select
        label="Origen de captacion *"
        value={origen}
        onChange={(e) => setOrigen(e.target.value)}
        options={ORIGENES}
        placeholder="Seleccionar origen"
        required
      />

      <ConvenioAutocomplete
        convenios={convenios}
        value={convenio}
        onChange={setConvenio}
      />

      {/* Divider with label */}
      <div className="relative">
        <div className="h-px bg-slate-800/40" />
        <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-elevated px-3 text-xs text-slate-500 font-semibold">
          Paso 3: Sube tu archivo
        </span>
      </div>

      {/* File upload zone */}
      <div>
        <label
          className={`
            flex items-center justify-center gap-2 w-full py-4 rounded-lg text-sm cursor-pointer
            transition-colors border-2
            ${file
              ? "border-solid border-green-500/40 bg-green-500/5 text-green-400 font-semibold"
              : "border-dashed border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
            }
          `}
        >
          {file ? <FileSpreadsheet className="w-5 h-5" /> : <FileUp className="w-5 h-5" />}
          {file ? file.name : "Seleccionar archivo Excel (.xlsx)"}
          <input
            type="file"
            className="hidden"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResult(null);
              setError("");
            }}
          />
        </label>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <div className="flex flex-col gap-2">
          {result.created > 0 && (
            <Alert variant="success" icon={<CheckCircle className="w-4 h-4" />}>
              {result.created} cliente{result.created !== 1 ? "s" : ""} importado{result.created !== 1 ? "s" : ""} exitosamente
            </Alert>
          )}
          {result.errors.length > 0 && (
            <Alert variant="warning" icon={<AlertCircle className="w-4 h-4" />}>
              <p className="text-sm font-semibold mb-1">
                {result.errors.length} fila{result.errors.length !== 1 ? "s" : ""} con errores:
              </p>
              <div className="max-h-[120px] overflow-auto">
                {result.errors.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-xs">
                    Fila {e.row}: {e.message}
                  </p>
                ))}
                {result.errors.length > 10 && (
                  <p className="text-xs text-slate-500">
                    ...y {result.errors.length - 10} mas
                  </p>
                )}
              </div>
            </Alert>
          )}
        </div>
      )}

      {embedded && (
        <div className="flex justify-end gap-2">
          <Button variant="danger" onClick={handleClose}>
            Cancelar
          </Button>
          {!result?.created && (
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={uploading || !file || !origen || !convenio}
              loading={uploading}
              icon={!uploading ? <FileUp className="w-4 h-4" /> : undefined}
            >
              {uploading ? "Importando..." : "Importar"}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg">
      <DialogHeader onClose={handleClose}>
        <div className="flex items-center gap-2">
          <FileUp className="w-5 h-5 text-amber-400" />
          <div>
            <span>Importar Clientes Capturados</span>
            <p className="text-sm text-slate-400 font-normal mt-0.5">
              Sube un archivo Excel (.xlsx) con los datos de los prospectos
            </p>
          </div>
        </div>
      </DialogHeader>

      <DialogBody>{content}</DialogBody>

      <DialogFooter>
        <Button variant="danger" onClick={handleClose}>
          {result?.created ? "Cerrar" : "Cancelar"}
        </Button>
        {!result?.created && (
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={uploading || !file || !origen || !convenio}
            loading={uploading}
            icon={!uploading ? <FileUp className="w-4 h-4" /> : undefined}
          >
            {uploading ? "Importando..." : "Importar"}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
