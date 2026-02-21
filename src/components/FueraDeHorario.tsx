"use client";

import { Box, Typography, Paper } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

interface Props {
  mensaje?: string;
  horaActual?: string;
  horarioInicio?: string;
  horarioFin?: string;
}

export default function FueraDeHorario({
  mensaje,
  horaActual,
  horarioInicio = "08:55",
  horarioFin = "19:15",
}: Props) {
  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 5,
          maxWidth: 440,
          textAlign: "center",
          borderRadius: 3,
        }}
      >
        <AccessTimeIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Fuera de horario
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {mensaje || `El sistema opera de ${horarioInicio} a ${horarioFin}.`}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Lunes a Viernes
        </Typography>
        {horaActual && (
          <Typography variant="body2" color="text.disabled">
            Hora actual: {horaActual} (Hora Centro de México)
          </Typography>
        )}
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
          Puedes consultar tus registros pero no realizar operaciones.
        </Typography>
      </Paper>
    </Box>
  );
}
