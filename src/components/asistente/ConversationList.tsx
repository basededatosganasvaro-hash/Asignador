"use client";
import {
  Box, List, ListItemButton, ListItemText, Typography,
  IconButton, Divider, CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

interface Conversacion {
  id: number;
  titulo: string | null;
  updated_at: string;
  _count: { mensajes: number };
}

interface ConversationListProps {
  conversaciones: Conversacion[];
  activeId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}

export default function ConversationList({
  conversaciones, activeId, loading, onSelect, onNew, onDelete,
}: ConversationListProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Conversaciones
        </Typography>
        <IconButton size="small" onClick={onNew} title="Nueva conversación" color="primary">
          <AddIcon />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : conversaciones.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            Sin conversaciones aún
          </Typography>
        ) : (
          <List dense disablePadding>
            {conversaciones.map((conv) => (
              <ListItemButton
                key={conv.id}
                selected={conv.id === activeId}
                onClick={() => onSelect(conv.id)}
                sx={{
                  px: 1.5,
                  py: 1,
                  "&.Mui-selected": { bgcolor: "action.selected" },
                }}
              >
                <ListItemText
                  primary={conv.titulo || "Sin título"}
                  secondary={`${conv._count.mensajes} msgs`}
                  primaryTypographyProps={{ noWrap: true, fontSize: "0.85rem" }}
                  secondaryTypographyProps={{ fontSize: "0.7rem" }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
