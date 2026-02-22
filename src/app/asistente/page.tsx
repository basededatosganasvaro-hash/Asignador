"use client";
import { Typography, Box } from "@mui/material";
import ChatPanel from "@/components/asistente/ChatPanel";

export default function AsistentePage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Asistente IA
      </Typography>
      <ChatPanel />
    </Box>
  );
}
