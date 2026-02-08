"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Chip,
  Button,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";

interface Asignacion {
  id: number;
  fecha_asignacion: string;
  cantidad_registros: number;
  estado: string;
  registros_con_tel1: number;
  puede_descargar: boolean;
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

  const handleDownload = async (id: number) => {
    window.open(`/api/asignaciones/${id}/excel`, "_blank");
  };

  const columns: GridColDef[] = [
    {
      field: "id",
      headerName: "Lote",
      width: 80,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "fecha_asignacion",
      headerName: "Fecha",
      width: 130,
      valueFormatter: (value: string) => {
        return new Date(value).toLocaleDateString("es-MX");
      },
    },
    {
      field: "cantidad_registros",
      headerName: "Registros",
      width: 110,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "progreso",
      headerName: "Progreso Tel.",
      width: 200,
      renderCell: (params) => {
        const row = params.row as Asignacion;
        const pct =
          row.cantidad_registros > 0
            ? (row.registros_con_tel1 / row.cantidad_registros) * 100
            : 0;
        return (
          <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
              color={pct === 100 ? "success" : "primary"}
            />
            <Typography variant="caption" sx={{ minWidth: 45 }}>
              {row.registros_con_tel1}/{row.cantidad_registros}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "estado",
      headerName: "Estado",
      width: 120,
      renderCell: (params) => {
        const colorMap: Record<string, "primary" | "success" | "error"> = {
          activa: "primary",
          completada: "success",
          cancelada: "error",
        };
        return (
          <Chip
            label={params.value}
            color={colorMap[params.value as string] || "default"}
            size="small"
            variant="outlined"
          />
        );
      },
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 200,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as Asignacion;
        return (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => router.push(`/promotor/asignaciones/${row.id}`)}
            >
              Ver
            </Button>
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<DownloadIcon />}
              disabled={!row.puede_descargar}
              onClick={() => handleDownload(row.id)}
              title={
                row.puede_descargar
                  ? "Descargar Excel"
                  : "Completa todos los telefonos para descargar"
              }
            >
              Excel
            </Button>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Mis Asignaciones
      </Typography>

      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid
          rows={asignaciones}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" },
          }}
        />
      </Box>
    </Box>
  );
}
