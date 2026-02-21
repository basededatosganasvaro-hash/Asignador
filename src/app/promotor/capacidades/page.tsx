"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Chip, CircularProgress, Alert, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Snackbar,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Solicitud {
  id: number;
  convenio: string;
  nombre_cliente: string | null;
  nss: string | null;
  curp: string | null;
  rfc: string | null;
  numero_empleado: string | null;
  fecha_solicitud: string | null;
  imss_capacidad_actual: number | null;
  imss_num_creditos: number | null;
  imss_telefonos: string | null;
  respuesta: string | null;
}

export default function CapacidadesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Solicitud | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" as "error" | "success" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/promotor/capacidades");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al cargar");
      }
      setSolicitudes(data.solicitudes || []);
      setMensaje(data.mensaje || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar solicitudes";
      setSnackbar({ open: true, message: msg, severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: GridColDef[] = [
    {
      field: "fecha_solicitud",
      headerName: "Fecha",
      width: 140,
      valueFormatter: (value: string | null) => {
        if (!value) return "—";
        return new Date(value).toLocaleDateString("es-MX", {
          day: "2-digit", month: "short", year: "numeric",
        });
      },
    },
    { field: "convenio", headerName: "Convenio", width: 120 },
    {
      field: "nombre_cliente",
      headerName: "Cliente",
      width: 180,
      renderCell: (p) => (
        <Typography variant="body2" noWrap fontWeight={500}>
          {p.value || "—"}
        </Typography>
      ),
    },
    { field: "nss", headerName: "NSS", width: 130 },
    { field: "curp", headerName: "CURP", width: 180 },
    {
      field: "imss_capacidad_actual",
      headerName: "Capacidad",
      width: 130,
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={600} color="success.main">
          {p.value != null
            ? Number(p.value).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
            : "—"}
        </Typography>
      ),
    },
    {
      field: "imss_num_creditos",
      headerName: "Créditos",
      width: 100,
      align: "center",
      headerAlign: "center",
    },
    { field: "imss_telefonos", headerName: "Teléfonos", width: 140 },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: (p) => (
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          label={p.value || "Respondida"}
          size="small"
          color="success"
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      field: "respuesta",
      headerName: "Respuesta",
      flex: 1,
      minWidth: 200,
      renderCell: (p) => (
        <Typography variant="body2" noWrap color="text.secondary" sx={{ fontSize: 12 }}>
          {p.value ? ((p.value as string).length > 80 ? (p.value as string).substring(0, 80) + "…" : p.value) : "—"}
        </Typography>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>Capacidades Solicitadas</Typography>
        <Typography variant="body2" color="text.secondary">
          Historial de solicitudes de capacidad IMSS respondidas
        </Typography>
      </Box>

      {mensaje && (
        <Alert severity="info" sx={{ mb: 2 }}>{mensaje}</Alert>
      )}

      {/* Card resumen */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 3 }}>
        <Paper
          elevation={0}
          sx={{
            px: 3, py: 2, borderRadius: 2.5, textAlign: "center",
            bgcolor: "#4caf50", color: "white", minWidth: 160,
            border: "2px solid #4caf50",
          }}
        >
          <Typography variant="caption" fontWeight={600} sx={{ color: "rgba(255,255,255,0.85)" }}>
            Total Respondidas
          </Typography>
          <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.2 }}>
            {solicitudes.length}
          </Typography>
        </Paper>
      </Box>

      {/* DataGrid */}
      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
        {solicitudes.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <Typography>Sin solicitudes respondidas</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={solicitudes}
            columns={columns}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            disableRowSelectionOnClick
            autoHeight
            rowHeight={52}
            onRowClick={(params) => setSelectedRow(params.row as Solicitud)}
            sx={{
              border: "none",
              "& .MuiDataGrid-columnHeader": {
                bgcolor: "background.paper", fontSize: 11, fontWeight: 700,
                color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em",
              },
              "& .MuiDataGrid-row": { cursor: "pointer" },
              "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
              "& .MuiDataGrid-cell": { borderColor: "grey.100", display: "flex", alignItems: "center" },
              "& .MuiDataGrid-footerContainer": { borderColor: "grey.100" },
            }}
          />
        )}
      </Paper>

      {/* Dialog: Respuesta completa */}
      <Dialog
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {selectedRow && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
                  {selectedRow.nombre_cliente || "Solicitud"} — {selectedRow.convenio}
                </Typography>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                  label="Respondida"
                  size="small"
                  color="success"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedRow.fecha_solicitud
                  ? new Date(selectedRow.fecha_solicitud).toLocaleDateString("es-MX", {
                      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })
                  : ""}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 2 }}>
                {selectedRow.nss && <InfoChip label="NSS" value={selectedRow.nss} />}
                {selectedRow.curp && <InfoChip label="CURP" value={selectedRow.curp} />}
                {selectedRow.rfc && <InfoChip label="RFC" value={selectedRow.rfc} />}
                {selectedRow.numero_empleado && <InfoChip label="No. Empleado" value={selectedRow.numero_empleado} />}
                {selectedRow.imss_capacidad_actual != null && (
                  <InfoChip
                    label="Capacidad"
                    value={Number(selectedRow.imss_capacidad_actual).toLocaleString("es-MX", {
                      style: "currency", currency: "MXN",
                    })}
                  />
                )}
                {selectedRow.imss_num_creditos != null && (
                  <InfoChip label="Créditos" value={String(selectedRow.imss_num_creditos)} />
                )}
                {selectedRow.imss_telefonos && (
                  <InfoChip label="Teléfonos" value={selectedRow.imss_telefonos} />
                )}
              </Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
                Respuesta completa
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2, borderRadius: 2, bgcolor: "grey.50",
                  whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 13,
                  maxHeight: 400, overflow: "auto",
                }}
              >
                {selectedRow.respuesta || "Sin respuesta"}
              </Paper>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setSelectedRow(null)} variant="outlined">
                Cerrar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}
