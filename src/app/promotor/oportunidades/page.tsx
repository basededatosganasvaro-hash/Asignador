"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Chip, CircularProgress, Alert, Stack,
  MenuItem, Select, FormControl, InputLabel, Switch,
  FormControlLabel, IconButton, Tooltip, Collapse, Button,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FilterListIcon from "@mui/icons-material/FilterList";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";

interface Oportunidad {
  id: number;
  cliente_id: number | null;
  nombres: string;
  convenio: string;
  estado: string;
  municipio: string;
  tipo_cliente: string;
  tel_1: string | null;
  etapa: { id: number; nombre: string; tipo: string; color: string } | null;
  timer_vence: string | null;
  origen: string;
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

const FILTROS_VACIOS = {
  etapaTipo: "",
  tipoCliente: "",
  convenio: "",
  estado: "",
  municipio: "",
  soloConTel: false,
};

export default function OportunidadesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Oportunidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [showFiltros, setShowFiltros] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/oportunidades");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFiltro = (key: keyof typeof FILTROS_VACIOS, value: string | boolean) =>
    setFiltros((p) => ({ ...p, [key]: value }));

  // Opciones únicas derivadas de los datos cargados
  const opts = useMemo(() => ({
    etapaTipos: Array.from(new Set(rows.map((r) => r.etapa?.tipo).filter(Boolean))) as string[],
    tiposCliente: Array.from(new Set(rows.map((r) => r.tipo_cliente).filter((v) => v && v !== "—"))).sort(),
    convenios: Array.from(new Set(rows.map((r) => r.convenio).filter((v) => v && v !== "—"))).sort(),
    estados: Array.from(new Set(rows.map((r) => r.estado).filter((v) => v && v !== "—"))).sort(),
    municipios: Array.from(
      new Set(
        rows
          .filter((r) => !filtros.estado || r.estado === filtros.estado)
          .map((r) => r.municipio)
          .filter((v) => v && v !== "—")
      )
    ).sort(),
  }), [rows, filtros.estado]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filtros.etapaTipo && r.etapa?.tipo !== filtros.etapaTipo) return false;
      if (filtros.tipoCliente && r.tipo_cliente !== filtros.tipoCliente) return false;
      if (filtros.convenio && r.convenio !== filtros.convenio) return false;
      if (filtros.estado && r.estado !== filtros.estado) return false;
      if (filtros.municipio && r.municipio !== filtros.municipio) return false;
      if (filtros.soloConTel && !r.tel_1) return false;
      return true;
    });
  }, [rows, filtros]);

  const hayFiltros = Object.values(filtros).some((v) => v !== "" && v !== false);

  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
  };

  const columns: GridColDef[] = [
    { field: "nombres", headerName: "Cliente", flex: 1.5 },
    { field: "tipo_cliente", headerName: "Tipo", flex: 0.8 },
    { field: "convenio", headerName: "Convenio", flex: 1 },
    { field: "estado", headerName: "Estado", width: 110 },
    { field: "municipio", headerName: "Municipio", width: 130 },
    {
      field: "tel_1", headerName: "Teléfono", width: 130,
      renderCell: (p) => p.value
        ? <Typography variant="body2">{p.value}</Typography>
        : <Typography variant="body2" color="text.disabled">Sin tel.</Typography>,
    },
    {
      field: "etapa", headerName: "Etapa", width: 140,
      renderCell: (p) => p.row.etapa
        ? <Chip label={p.row.etapa.nombre} size="small" sx={{ bgcolor: p.row.etapa.color, color: "white", fontWeight: 600 }} />
        : <Chip label="Sin etapa" size="small" />,
    },
    {
      field: "timer_vence", headerName: "Timer", width: 110,
      renderCell: (p) => <TimerCell timer_vence={p.row.timer_vence} />,
    },
  ];

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Mis Oportunidades</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} de {rows.length}
          </Typography>
          {hayFiltros && (
            <Button size="small" onClick={limpiarFiltros} startIcon={<FilterListOffIcon />}>
              Limpiar
            </Button>
          )}
          <Tooltip title="Filtros">
            <IconButton onClick={() => setShowFiltros((p) => !p)} color={showFiltros ? "primary" : "default"}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {rows.length === 0 && (
        <Alert severity="info">No tienes oportunidades activas. Solicita una asignación desde el Dashboard.</Alert>
      )}

      {rows.length > 0 && (
        <>
          {/* Chips etapa tipo — siempre visibles */}
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
            <Chip
              label="Todas"
              onClick={() => setFiltro("etapaTipo", "")}
              variant={filtros.etapaTipo === "" ? "filled" : "outlined"}
              color="primary"
              size="small"
            />
            {opts.etapaTipos.map((t) => (
              <Chip
                key={t}
                label={t}
                onClick={() => setFiltro("etapaTipo", t)}
                variant={filtros.etapaTipo === t ? "filled" : "outlined"}
                size="small"
              />
            ))}
          </Stack>

          {/* Panel de filtros avanzados */}
          <Collapse in={showFiltros}>
            <Box
              sx={{
                display: "flex", flexWrap: "wrap", gap: 1.5, mb: 2,
                p: 2, bgcolor: "grey.50", borderRadius: 2,
              }}
            >
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel shrink>Tipo de cliente</InputLabel>
                <Select
                  value={filtros.tipoCliente}
                  label="Tipo de cliente"
                  notched
                  displayEmpty
                  onChange={(e) => setFiltro("tipoCliente", e.target.value)}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {opts.tiposCliente.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel shrink>Convenio</InputLabel>
                <Select
                  value={filtros.convenio}
                  label="Convenio"
                  notched
                  displayEmpty
                  onChange={(e) => setFiltro("convenio", e.target.value)}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {opts.convenios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel shrink>Estado</InputLabel>
                <Select
                  value={filtros.estado}
                  label="Estado"
                  notched
                  displayEmpty
                  onChange={(e) => {
                    setFiltro("estado", e.target.value);
                    setFiltro("municipio", ""); // reset municipio al cambiar estado
                  }}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {opts.estados.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel shrink>Municipio</InputLabel>
                <Select
                  value={filtros.municipio}
                  label="Municipio"
                  notched
                  displayEmpty
                  onChange={(e) => setFiltro("municipio", e.target.value)}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {opts.municipios.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={filtros.soloConTel}
                    onChange={(e) => setFiltro("soloConTel", e.target.checked)}
                    size="small"
                  />
                }
                label="Solo con teléfono"
                sx={{ ml: 0.5 }}
              />
            </Box>
          </Collapse>

          <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
            <DataGrid
              rows={filtered}
              columns={columns}
              pageSizeOptions={[25, 50, 100]}
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
