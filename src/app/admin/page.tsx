"use client";
import { useEffect, useState } from "react";
import { Box, Typography, Grid, CircularProgress } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIcon from "@mui/icons-material/Assignment";
import StorageIcon from "@mui/icons-material/Storage";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StatCard from "@/components/ui/StatCard";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

interface DashboardData {
  totalClientes: number;
  clientesAsignados: number;
  clientesDisponibles: number;
  totalPromotores: number;
  asignacionesHoy: number;
  asignacionesPorPromotor: {
    id: number;
    nombre: string;
    total_asignaciones: number;
    total_registros: number;
  }[];
}

const columns: GridColDef[] = [
  { field: "nombre", headerName: "Promotor", flex: 1 },
  { field: "total_asignaciones", headerName: "Asignaciones", width: 130, align: "center", headerAlign: "center" },
  { field: "total_registros", headerName: "Registros Totales", width: 150, align: "center", headerAlign: "center" },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Clientes"
            value={data?.totalClientes.toLocaleString() ?? 0}
            icon={<StorageIcon />}
            color="#1565c0"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Asignados"
            value={data?.clientesAsignados.toLocaleString() ?? 0}
            icon={<AssignmentIcon />}
            color="#2e7d32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Disponibles"
            value={data?.clientesDisponibles.toLocaleString() ?? 0}
            icon={<CheckCircleIcon />}
            color="#ed6c02"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Promotores Activos"
            value={data?.totalPromotores ?? 0}
            icon={<PeopleIcon />}
            color="#9c27b0"
          />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2 }}>
        Resumen por Promotor
      </Typography>
      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid
          rows={data?.asignacionesPorPromotor ?? []}
          columns={columns}
          pageSizeOptions={[10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: "#f5f5f5",
            },
          }}
        />
      </Box>
    </Box>
  );
}
