"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Chip, Button, CircularProgress, LinearProgress,
  Card, CardContent, Tooltip, IconButton, Paper,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import FolderIcon from "@mui/icons-material/Folder";
import PeopleIcon from "@mui/icons-material/People";
import PhoneIcon from "@mui/icons-material/Phone";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Asignacion {
  id: number;
  fecha: string;
  cantidad: number;
  estado: string;
  oportunidades_activas: number;
  registros_con_tel1: number;
  puede_descargar: boolean;
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1, minWidth: 140, p: 2, borderRadius: 2.5,
        border: "1px solid", borderColor: "divider",
        display: "flex", alignItems: "center", gap: 2,
      }}
    >
      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ color }}>{icon}</Box>
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>{title}</Typography>
      </Box>
    </Paper>
  );
}

export default function AsignacionesPage() {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/asignaciones")
      .then((res) => res.json())
      .then((data) => {
        setAsignaciones(data);
        setLoading(false);
      });
  }, []);

  const handleDownload = (id: number) => {
    window.open(`/api/asignaciones/${id}/excel`, "_blank");
  };

  const stats = useMemo(() => {
    const totalRegistros = asignaciones.reduce((s, a) => s + a.cantidad, 0);
    const conTelefono = asignaciones.reduce((s, a) => s + a.registros_con_tel1, 0);
    const completados = asignaciones.filter((a) => a.puede_descargar).length;
    return { totalRegistros, conTelefono, completados };
  }, [asignaciones]);

  const columns: GridColDef[] = [
    {
      field: "id", headerName: "Lote", width: 80, align: "center", headerAlign: "center",
      renderCell: (p) => (
        <Chip label={`#${p.value}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
      ),
    },
    {
      field: "fecha", headerName: "Fecha", width: 130,
      valueFormatter: (value: string) => new Date(value).toLocaleDateString("es-MX"),
    },
    {
      field: "cantidad", headerName: "Registros", width: 110, align: "center", headerAlign: "center",
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={600}>{p.value}</Typography>
      ),
    },
    {
      field: "progreso", headerName: "Progreso Tel.", width: 200,
      renderCell: (params) => {
        const row = params.row as Asignacion;
        const pct = row.cantidad > 0 ? (row.registros_con_tel1 / row.cantidad) * 100 : 0;
        return (
          <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
              color={pct === 100 ? "success" : "primary"}
            />
            <Typography variant="caption" fontWeight={600} sx={{ minWidth: 50, textAlign: "right" }}>
              {row.registros_con_tel1}/{row.cantidad}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "oportunidades_activas", headerName: "Activas", width: 100, align: "center", headerAlign: "center",
      renderCell: (p) => {
        const row = p.row as Asignacion;
        return (
          <Chip
            label={p.value}
            size="small"
            color={p.value === 0 ? "default" : "primary"}
            variant={p.value === 0 ? "outlined" : "filled"}
            sx={{ fontWeight: 600 }}
          />
        );
      },
    },
    {
      field: "actions", headerName: "", width: 120, sortable: false, align: "right", headerAlign: "right",
      renderCell: (params) => {
        const row = params.row as Asignacion;
        return (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title="Ver detalle">
              <IconButton size="small" color="primary" onClick={() => router.push(`/promotor/asignaciones/${row.id}`)}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={row.puede_descargar ? "Descargar Excel" : "Completa todos los teléfonos para descargar"}>
              <span>
                <IconButton
                  size="small"
                  color="success"
                  disabled={!row.puede_descargar}
                  onClick={() => handleDownload(row.id)}
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Mis Asignaciones</Typography>
        <Typography variant="body2" color="text.secondary">
          {asignaciones.length} lote{asignaciones.length !== 1 ? "s" : ""} asignado{asignaciones.length !== 1 ? "s" : ""}
        </Typography>
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <StatCard title="Total Lotes" value={asignaciones.length} icon={<FolderIcon />} color="#1565c0" />
        <StatCard title="Total Registros" value={stats.totalRegistros} icon={<PeopleIcon />} color="#2196f3" />
        <StatCard title="Con Teléfono" value={stats.conTelefono} icon={<PhoneIcon />} color="#4caf50" />
        <StatCard title="Listos para Excel" value={stats.completados} icon={<CheckCircleIcon />} color="#66bb6a" />
      </Box>

      {/* DataGrid */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
        {asignaciones.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <Typography>Aún no tienes asignaciones. Solicita una desde el Dashboard.</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={asignaciones}
            columns={columns}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            autoHeight
            rowHeight={52}
            sx={{
              border: "none",
              "& .MuiDataGrid-columnHeader": {
                bgcolor: "background.paper", fontSize: 11, fontWeight: 700,
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
    </Box>
  );
}
