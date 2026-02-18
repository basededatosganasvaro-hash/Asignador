"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Chip, CircularProgress, Stack, Alert } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

interface Oportunidad {
  id: number;
  cliente_id: number;
  nombres: string;
  convenio: string;
  estado: string;
  municipio: string;
  tel_1: string | null;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  created_at: string;
}

function TimerCell({ timer_vence }: { timer_vence: string | null }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!timer_vence) { setLabel("Sin timer"); return; }
    const update = () => {
      const diff = new Date(timer_vence).getTime() - Date.now();
      if (diff <= 0) { setLabel("Vencido"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(`${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [timer_vence]);

  const isVencido = timer_vence && new Date(timer_vence) < new Date();
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: isVencido ? "error.main" : "text.secondary" }}>
      <AccessTimeIcon sx={{ fontSize: 14 }} />
      <Typography variant="body2">{label}</Typography>
    </Box>
  );
}

export default function OportunidadesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Oportunidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/oportunidades");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tipos = Array.from(new Set(rows.map((r) => r.etapa?.tipo).filter(Boolean)));
  const filtered = filtroTipo ? rows.filter((r) => r.etapa?.tipo === filtroTipo) : rows;

  const columns: GridColDef[] = [
    { field: "nombres", headerName: "Cliente", flex: 1.5 },
    { field: "convenio", headerName: "Convenio", flex: 1 },
    {
      field: "etapa", headerName: "Etapa", width: 140,
      renderCell: (p) => p.row.etapa
        ? <Chip label={p.row.etapa.nombre} size="small" sx={{ bgcolor: p.row.etapa.color, color: "white", fontWeight: 600 }} />
        : <Chip label="Sin etapa" size="small" />,
    },
    {
      field: "timer_vence", headerName: "Timer", width: 120,
      renderCell: (p) => <TimerCell timer_vence={p.row.timer_vence} />,
    },
    {
      field: "created_at", headerName: "Asignado", width: 100,
      valueGetter: (_v: unknown, row: Oportunidad) => new Date(row.created_at).toLocaleDateString("es-MX"),
    },
  ];

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Mis Oportunidades</Typography>
        <Typography variant="body2" color="text.secondary">{rows.length} activas</Typography>
      </Box>

      {rows.length === 0 && (
        <Alert severity="info">No tienes oportunidades activas. Solicita una asignacion desde el Dashboard.</Alert>
      )}

      {rows.length > 0 && (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip label="Todas" onClick={() => setFiltroTipo(null)} variant={filtroTipo === null ? "filled" : "outlined"} color="primary" size="small" />
            {tipos.map((t) => (
              <Chip key={t} label={t} onClick={() => setFiltroTipo(t!)} variant={filtroTipo === t ? "filled" : "outlined"} size="small" />
            ))}
          </Stack>

          <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
            <DataGrid
              rows={filtered}
              columns={columns}
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              onRowClick={(p) => router.push(`/promotor/oportunidades/${p.id}`)}
              disableRowSelectionOnClick
              autoHeight
              sx={{
                border: "none",
                "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" },
                "& .MuiDataGrid-row": { cursor: "pointer" },
              }}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
