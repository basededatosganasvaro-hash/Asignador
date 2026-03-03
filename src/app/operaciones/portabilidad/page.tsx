"use client";

import { useState, useEffect, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Image, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseClient } from "@/lib/supabase";
import type { RegistroPortabilidad } from "@/types/portabilidad";

function parseEvidencias(evidencia_url: string): string[] {
  if (!evidencia_url) return [];
  try {
    const parsed = JSON.parse(evidencia_url);
    return Array.isArray(parsed) ? parsed : [evidencia_url];
  } catch {
    return evidencia_url ? [evidencia_url] : [];
  }
}

export default function PortabilidadPage() {
  const [registros, setRegistros] = useState<RegistroPortabilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Filters
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroRfc, setFiltroRfc] = useState("");
  const [filtroFolio, setFiltroFolio] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [evidenciaDialog, setEvidenciaDialog] = useState<string[] | null>(null);
  const [evidenciaIdx, setEvidenciaIdx] = useState(0);

  // Form fields
  const [formData, setFormData] = useState({
    promotor_id: "",
    rfc_cliente: "",
    nombre_cliente: "",
    folio_portabilidad: "",
  });
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [formExistingUrls, setFormExistingUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroNombre) params.set("nombre", filtroNombre);
    if (filtroRfc) params.set("rfc", filtroRfc);
    if (filtroFolio) params.set("folio", filtroFolio);
    if (filtroDesde) params.set("desde", filtroDesde);
    if (filtroHasta) params.set("hasta", filtroHasta);

    const res = await fetch(`/api/operaciones/portabilidad?${params}`);
    if (res.ok) {
      setRegistros(await res.json());
    }
    setLoading(false);
  }, [filtroNombre, filtroRfc, filtroFolio, filtroDesde, filtroHasta]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  // Realtime subscription
  useEffect(() => {
    const channel = getSupabaseClient()
      .channel("registros-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registros" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRegistros((prev) => [payload.new as RegistroPortabilidad, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRegistros((prev) =>
              prev.map((r) => (r.id === (payload.new as RegistroPortabilidad).id ? (payload.new as RegistroPortabilidad) : r))
            );
          } else if (payload.eventType === "DELETE") {
            setRegistros((prev) => prev.filter((r) => r.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      getSupabaseClient().removeChannel(channel);
    };
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ promotor_id: "", rfc_cliente: "", nombre_cliente: "", folio_portabilidad: "" });
    setFormFiles([]);
    setFormExistingUrls([]);
    setFormOpen(true);
  };

  const openEdit = (row: RegistroPortabilidad) => {
    setEditingId(row.id);
    setFormData({
      promotor_id: String(row.promotor_id),
      rfc_cliente: row.rfc_cliente,
      nombre_cliente: row.nombre_cliente,
      folio_portabilidad: row.folio_portabilidad,
    });
    setFormFiles([]);
    setFormExistingUrls(parseEvidencias(row.evidencia_url));
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);

    // Upload new files
    const uploadedUrls: string[] = [...formExistingUrls];
    for (const file of formFiles) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/operaciones/portabilidad/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        uploadedUrls.push(url);
      } else {
        toast("Error al subir archivo", "error");
        setSaving(false);
        return;
      }
    }

    const evidencia_url = uploadedUrls.length === 0
      ? ""
      : uploadedUrls.length === 1
        ? uploadedUrls[0]
        : JSON.stringify(uploadedUrls);

    const body = {
      promotor_id: Number(formData.promotor_id),
      rfc_cliente: formData.rfc_cliente.toUpperCase(),
      nombre_cliente: formData.nombre_cliente,
      folio_portabilidad: formData.folio_portabilidad,
      evidencia_url,
    };

    let res;
    if (editingId) {
      res = await fetch(`/api/operaciones/portabilidad/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/operaciones/portabilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (res.ok) {
      toast(editingId ? "Registro actualizado" : "Registro creado", "success");
      setFormOpen(false);
      fetchRegistros();
    } else {
      const err = await res.json();
      toast(err.error || "Error al guardar", "error");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/operaciones/portabilidad/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast("Registro eliminado", "success");
      fetchRegistros();
    } else {
      toast("Error al eliminar", "error");
    }
    setDeleteId(null);
  };

  const columns: ColumnDef<RegistroPortabilidad, unknown>[] = [
    { accessorKey: "nombre_cliente", header: "Nombre", minSize: 180 },
    { accessorKey: "rfc_cliente", header: "RFC", size: 150 },
    { accessorKey: "folio_portabilidad", header: "Folio", size: 150 },
    {
      accessorKey: "evidencia_url",
      header: "Evidencia",
      size: 120,
      cell: ({ getValue }) => {
        const urls = parseEvidencias(getValue() as string);
        if (urls.length === 0) return <Badge color="slate">Sin archivos</Badge>;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setEvidenciaIdx(0); setEvidenciaDialog(urls); }}
            className="cursor-pointer"
          >
            <Badge color="blue">
              <Image className="w-3 h-3" />
              {urls.length} archivo{urls.length > 1 ? "s" : ""}
            </Badge>
          </button>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Fecha",
      size: 160,
      cell: ({ getValue }) => {
        const value = getValue() as string;
        if (!value) return "";
        return new Date(value).toLocaleString("es-MX", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteId(row.original.id); }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-100">Portabilidad</h1>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Nuevo Registro
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-[180px]">
          <Input placeholder="Nombre" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} fullWidth />
        </div>
        <div className="w-[150px]">
          <Input placeholder="RFC" value={filtroRfc} onChange={(e) => setFiltroRfc(e.target.value)} fullWidth />
        </div>
        <div className="w-[150px]">
          <Input placeholder="Folio" value={filtroFolio} onChange={(e) => setFiltroFolio(e.target.value)} fullWidth />
        </div>
        <div className="w-[150px]">
          <Input type="date" placeholder="Desde" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} fullWidth />
        </div>
        <div className="w-[150px]">
          <Input type="date" placeholder="Hasta" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} fullWidth />
        </div>
        <Button variant="outline" icon={<Search className="w-4 h-4" />} onClick={fetchRegistros}>
          Buscar
        </Button>
      </div>

      {/* Table */}
      <DataTable
        data={registros}
        columns={columns}
        loading={loading}
        pageSize={25}
        pageSizeOptions={[10, 25, 50]}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md">
        <DialogHeader onClose={() => setFormOpen(false)}>
          {editingId ? "Editar Registro" : "Nuevo Registro"}
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <Input
              label="ID Promotor (Telegram)"
              type="number"
              value={formData.promotor_id}
              onChange={(e) => setFormData({ ...formData, promotor_id: e.target.value })}
              required
            />
            <Input
              label="RFC Cliente"
              value={formData.rfc_cliente}
              onChange={(e) => setFormData({ ...formData, rfc_cliente: e.target.value.toUpperCase() })}
              required
              maxLength={13}
            />
            <Input
              label="Nombre Cliente"
              value={formData.nombre_cliente}
              onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
              required
            />
            <Input
              label="Folio Portabilidad"
              value={formData.folio_portabilidad}
              onChange={(e) => setFormData({ ...formData, folio_portabilidad: e.target.value })}
              required
            />

            {/* Existing evidencias */}
            {formExistingUrls.length > 0 && (
              <div>
                <p className="text-sm text-slate-500 mb-2">
                  Evidencias existentes:
                </p>
                <div className="flex flex-wrap gap-2">
                  {formExistingUrls.map((url, i) => (
                    <Badge key={i} color="blue">
                      Archivo {i + 1}
                      <button
                        onClick={() => setFormExistingUrls(formExistingUrls.filter((_, idx) => idx !== i))}
                        className="ml-1 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* File upload */}
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-slate-700 text-slate-300 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer">
                Agregar Evidencias (JPG, PNG, MP4)
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".jpg,.jpeg,.png,.mp4"
                  onChange={(e) => {
                    if (e.target.files) {
                      setFormFiles([...formFiles, ...Array.from(e.target.files)]);
                    }
                  }}
                />
              </label>
              {formFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formFiles.map((f, i) => (
                    <Badge key={i} color="slate">
                      {f.name}
                      <button
                        onClick={() => setFormFiles(formFiles.filter((_, idx) => idx !== i))}
                        className="ml-1 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={saving || !formData.promotor_id || !formData.rfc_cliente || !formData.nombre_cliente || !formData.folio_portabilidad}
          >
            {editingId ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="sm">
        <DialogHeader onClose={() => setDeleteId(null)}>
          Confirmar eliminacion
        </DialogHeader>
        <DialogBody>
          <Alert variant="warning">
            Esta accion eliminara el registro y sus evidencias de forma permanente.
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </DialogFooter>
      </Dialog>

      {/* Evidencia Viewer — Carousel */}
      <Dialog open={!!evidenciaDialog} onClose={() => setEvidenciaDialog(null)} maxWidth="md">
        <DialogHeader onClose={() => setEvidenciaDialog(null)}>
          Evidencia {evidenciaDialog ? `${evidenciaIdx + 1} / ${evidenciaDialog.length}` : ""}
        </DialogHeader>
        <DialogBody>
          {evidenciaDialog && evidenciaDialog.length > 0 && (() => {
            const url = evidenciaDialog[evidenciaIdx];
            const isVideo = url.match(/\.mp4/i);
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEvidenciaIdx((p) => Math.max(0, p - 1))}
                  disabled={evidenciaIdx === 0}
                  className="p-2 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex-1 flex justify-center min-h-[300px]">
                  {isVideo ? (
                    <video
                      key={evidenciaIdx}
                      src={url}
                      controls
                      className="max-w-full max-h-[400px] rounded-lg"
                    />
                  ) : (
                    <img
                      key={evidenciaIdx}
                      src={url}
                      alt={`Evidencia ${evidenciaIdx + 1}`}
                      className="max-w-full max-h-[400px] object-contain rounded-lg border border-slate-700"
                    />
                  )}
                </div>

                <button
                  onClick={() => setEvidenciaIdx((p) => Math.min(evidenciaDialog.length - 1, p + 1))}
                  disabled={evidenciaIdx === evidenciaDialog.length - 1}
                  className="p-2 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            );
          })()}

          {/* Thumbnails */}
          {evidenciaDialog && evidenciaDialog.length > 1 && (
            <div className="flex gap-2 justify-center mt-4">
              {evidenciaDialog.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setEvidenciaIdx(i)}
                  className={`w-12 h-12 rounded overflow-hidden transition-all ${
                    i === evidenciaIdx
                      ? "border-2 border-amber-500 opacity-100"
                      : "border border-slate-700 opacity-60 hover:opacity-100"
                  }`}
                >
                  {url.match(/\.mp4/i) ? (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <span className="text-[10px] text-slate-500">MP4</span>
                    </div>
                  ) : (
                    <img src={url} className="w-full h-full object-cover" alt="" />
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogBody>
      </Dialog>
    </div>
  );
}
