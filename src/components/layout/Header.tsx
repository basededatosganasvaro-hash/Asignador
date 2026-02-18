"use client";
import { signOut, useSession } from "next-auth/react";
import {
  AppBar, Toolbar, Typography, Button, Box, Chip, IconButton,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import { DRAWER_WIDTH } from "./Sidebar";

interface HeaderProps {
  open: boolean;
  onToggle: () => void;
}

export default function Header({ open, onToggle }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: open ? `calc(100% - ${DRAWER_WIDTH}px)` : "100%",
        ml: open ? `${DRAWER_WIDTH}px` : 0,
        transition: "width 0.25s ease, margin-left 0.25s ease",
        bgcolor: "white",
        color: "text.primary",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar>
        {!open && (
          <IconButton edge="start" onClick={onToggle} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Chip
            label={session?.user?.rol === "admin" ? "Admin" : "Promotor"}
            color={session?.user?.rol === "admin" ? "error" : "primary"}
            size="small"
            variant="outlined"
          />
          <Typography variant="body2" color="text.secondary">
            {session?.user?.nombre || session?.user?.name}
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => signOut({ callbackUrl: "/login" })}
            startIcon={<LogoutIcon />}
          >
            Salir
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
