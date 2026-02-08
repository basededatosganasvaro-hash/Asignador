"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Snackbar,
  CircularProgress,
  Card,
  CardContent,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderEditCellParams } from "@mui/x-data-grid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";

interface ClienteRow {
  id: number;
  nombres: string | null;
  tel_1: string | null;
  tel_2: string | null;
  tel_3: string | null;
  tel_4: string | null;
  tel_5: string | null;
  curp: string | null;
  rfc: string | null;
  num_empleado: string | null;
  estado: string | null;
  municipio: string | null;
  convenio: string | null;
  oferta: string | null;
}

interface AsignacionDetail {
  id: number;
  fecha_asignacion: string;
  cantidad_registros: number;
  estado: string;
  registros_con_tel1: number;
  puede_descargar: boolean;
  registros: ClienteRow[];
}

export default function AsignacionDetallePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<AsignacionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/asignaciones/${params.id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProcessRowUpdate = async (
    newRow: ClienteRow,
    oldRow: ClienteRow
  ) => {
    // Determinar que campo cambio
    const changes: Record<string, string> = {};

    if (newRow.tel_1 !== oldRow.tel_1) changes.tel_1 = newRow.tel_1 || "";
    if (newRow.num_empleado !== oldRow.num_empleado)
      changes.num_empleado = newRow.num_empleado || "";
    if (newRow.curp !== oldRow.curp) changes.curp = newRow.curp || "";
    if (newRow.rfc !== oldRow.rfc) changes.rfc = newRow.rfc || "";

    if (Object.keys(changes).length === 0) return oldRow;

    const res = await fetch(`/api/clientes/${newRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });

    if (res.ok) {
      const updated = await res.json();
      setSnackbar({ open: true, message: "Guardado", severity: "success" });

      // Actualizar conteo de tel_1
      setData((prev) => {
        if (!prev) return prev;
        const newRegistros = prev.registros.map((r) =>
          r.id === updated.id ? updated : r
        );
        const registrosConTel1 = newRegistros.filter(
          (r) => r.tel_1 && r.tel_1.trim() !== ""
        ).length;
        return {
          ...prev,
          registros: newRegistros,
          registros_con_tel1: registrosConTel1,
          puede_descargar:
            registrosConTel1 === prev.cantidad_registros &&
            prev.cantidad_registros > 0,
        };
      });

      return updated;
    } else {
      const err = await res.json();
      setSnackbar({
        open: true,
        message: err.error || "Error al guardar",
        severity: "error",
      });
      return oldRow;
    }
  };

  const handleDownload = () => {
    window.open(`/api/asignaciones/${params.id}/excel`, "_blank");
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">Asignacion no encontrada</Alert>
      </Box>
    );
  }

  const pct =
    data.cantidad_registros > 0
      ? (data.registros_con_tel1 / data.cantidad_registros) * 100
      : 0;

  const columns: GridColDef[] = [
    { field: "nombres", headerName: "Nombre", flex: 1, minWidth: 200 },
    {
      field: "tel_1",
      headerName: "Tel 1",
      width: 140,
      editable: true,
      cellClassName: (params) =>
        !params.value || params.value.trim() === "" ? "cell-empty" : "",
    },
    { field: "tel_2", headerName: "Tel 2", width: 120 },
    { field: "tel_3", headerName: "Tel 3", width: 120 },
    { field: "tel_4", headerName: "Tel 4", width: 120 },
    { field: "tel_5", headerName: "Tel 5", width: 120 },
    {
      field: "curp",
      headerName: "CURP",
      width: 180,
      editable: true,
      renderEditCell: (params: GridRenderEditCellParams) => {
        // Solo permitir edicion si esta vacio
        const originalRow = data.registros.find((r) => r.id === params.id);
        if (originalRow?.curp && originalRow.curp.trim() !== "") {
          return <Box sx={{ px: 1, color: "text.secondary" }}>{params.value}</Box>;
        }
        return undefined; // usar editor por defecto
      },
    },
    {
      field: "rfc",
      headerName: "RFC",
      width: 160,
      editable: true,
      renderEditCell: (params: GridRenderEditCellParams) => {
        const originalRow = data.registros.find((r) => r.id === params.id);
        if (originalRow?.rfc && originalRow.rfc.trim() !== "") {
          return <Box sx={{ px: 1, color: "text.secondary" }}>{params.value}</Box>;
        }
        return undefined;
      },
    },
    { field: "num_empleado", headerName: "No. Empleado", width: 130, editable: true },
    { field: "estado", headerName: "Estado", width: 140 },
    { field: "municipio", headerName: "Municipio", width: 140 },
    { field: "convenio", headerName: "Convenio", width: 200 },
    { field: "oferta", headerName: "Oferta", width: 120 },
  ];

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push("/promotor/asignaciones")}
        sx={{ mb: 2 }}
      >
        Volver a Asignaciones
      </Button>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h5">
                Lote #{data.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fecha: {new Date(data.fecha_asignacion).toLocaleDateString("es-MX")}
                {" | "}
                {data.cantidad_registros} registros
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Chip
                label={data.estado}
                color={
                  data.estado === "activa"
                    ? "primary"
                    : data.estado === "completada"
                    ? "success"
                    : "error"
                }
                variant="outlined"
              />
              <Tooltip
                title={
                  data.puede_descargar
                    ? "Descargar Excel con nombres y telefonos"
                    : `Faltan ${data.cantidad_registros - data.registros_con_tel1} telefonos por completar`
                }
              >
                <span>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<DownloadIcon />}
                    disabled={!data.puede_descargar}
                    onClick={handleDownload}
                  >
                    Descargar Excel
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Progreso de telefonos:
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {data.registros_con_tel1} / {data.cantidad_registros}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{ height: 10, borderRadius: 5 }}
              color={pct === 100 ? "success" : "primary"}
            />
          </Box>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Haz doble clic en las celdas de Tel 1, CURP (si vacio), RFC (si vacio) o No. Empleado para editar
      </Typography>

      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 2,
          "& .cell-empty": {
            bgcolor: "#fff3e0",
          },
        }}
      >
        <DataGrid
          rows={data.registros}
          columns={columns}
          processRowUpdate={handleProcessRowUpdate}
          onProcessRowUpdateError={(error) => {
            setSnackbar({
              open: true,
              message: "Error al guardar: " + error.message,
              severity: "error",
            });
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 50 } },
          }}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" },
            "& .MuiDataGrid-cell--editable": {
              cursor: "pointer",
              "&:hover": { bgcolor: "#e3f2fd" },
            },
          }}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
