"use client";

import { Box, Typography, Button, Alert } from "@mui/material";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", mt: 8, gap: 2 }}>
      <Alert severity="error" sx={{ maxWidth: 500 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Ocurrio un error al cargar la pagina
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {error.message || "Error inesperado. Intenta recargar la pagina."}
        </Typography>
      </Alert>
      <Button variant="contained" onClick={reset}>
        Reintentar
      </Button>
    </Box>
  );
}
