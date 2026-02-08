"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Snackbar,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PhoneIcon from "@mui/icons-material/Phone";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import StatCard from "@/components/ui/StatCard";

interface Asignacion {
  id: number;
  fecha_asignacion: string;
  cantidad_registros: number;
  estado: string;
  registros_con_tel1: number;
  puede_descargar: boolean;
}

export default function PromotorDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  useEffect(() => {
    fetch("/api/asignaciones")
      .then((res) => res.json())
      .then((data) => {
        setAsignaciones(data);
        setLoading(false);
      });
  }, []);

  const totalRegistros = asignaciones.reduce((sum, a) => sum + a.cantidad_registros, 0);
  const pendientes = asignaciones.filter(
    (a) => a.estado === "activa" && !a.puede_descargar
  ).length;

  const handleRequestAssignment = async () => {
    setDialogOpen(false);
    setRequesting(true);

    const res = await fetch("/api/asignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    setRequesting(false);

    if (res.ok) {
      const data = await res.json();
      setSnackbar({
        open: true,
        message: `Asignacion creada con ${data.cantidad_registros} registros`,
        severity: "success",
      });
      router.push(`/promotor/asignaciones/${data.id}`);
    } else {
      const data = await res.json();
      setSnackbar({
        open: true,
        message: data.error || "Error al solicitar asignacion",
        severity: "error",
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4">
            Bienvenido, {session?.user?.nombre || session?.user?.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Panel de promotor
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={requesting ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
          onClick={() => setDialogOpen(true)}
          disabled={requesting}
          sx={{ py: 1.5, px: 4 }}
        >
          Solicitar Asignacion
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="Total Asignaciones"
            value={asignaciones.length}
            icon={<AssignmentIcon />}
            color="#1565c0"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="Total Registros"
            value={totalRegistros.toLocaleString()}
            icon={<PhoneIcon />}
            color="#2e7d32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="Pendientes"
            value={pendientes}
            icon={<PendingActionsIcon />}
            color="#ed6c02"
          />
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Solicitar Asignacion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se te asignaran hasta el maximo de registros configurado. Los
            registros asignados seran exclusivamente tuyos y no podran ser
            reasignados a otro promotor.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleRequestAssignment}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
