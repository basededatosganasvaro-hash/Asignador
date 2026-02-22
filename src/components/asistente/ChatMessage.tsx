"use client";
import { Box, Typography, Paper } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";

interface ChatMessageProps {
  rol: "user" | "assistant";
  contenido: string;
  created_at?: string;
}

export default function ChatMessage({ rol, contenido, created_at }: ChatMessageProps) {
  const isUser = rol === "user";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 2,
        gap: 1,
        alignItems: "flex-start",
      }}
    >
      {!isUser && (
        <Box
          sx={{
            width: 32, height: 32, borderRadius: "50%",
            bgcolor: "primary.main", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0, mt: 0.5,
          }}
        >
          <SmartToyIcon sx={{ color: "white", fontSize: 18 }} />
        </Box>
      )}
      <Paper
        elevation={0}
        sx={{
          maxWidth: "75%",
          p: 1.5,
          bgcolor: isUser ? "primary.main" : "grey.100",
          color: isUser ? "white" : "text.primary",
          borderRadius: 2,
          borderTopRightRadius: isUser ? 4 : undefined,
          borderTopLeftRadius: !isUser ? 4 : undefined,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            "& code": {
              bgcolor: isUser ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)",
              px: 0.5, borderRadius: 0.5, fontFamily: "monospace", fontSize: "0.8rem",
            },
          }}
        >
          {contenido}
        </Typography>
        {created_at && (
          <Typography variant="caption" sx={{ opacity: 0.6, display: "block", mt: 0.5, textAlign: "right" }}>
            {new Date(created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </Typography>
        )}
      </Paper>
      {isUser && (
        <Box
          sx={{
            width: 32, height: 32, borderRadius: "50%",
            bgcolor: "grey.400", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0, mt: 0.5,
          }}
        >
          <PersonIcon sx={{ color: "white", fontSize: 18 }} />
        </Box>
      )}
    </Box>
  );
}
