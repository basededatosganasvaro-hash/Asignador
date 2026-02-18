"use client";
import { signOut, useSession } from "next-auth/react";
import {
  AppBar, Toolbar, Typography, Button, Box, Chip,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { DRAWER_WIDTH, DRAWER_COLLAPSED } from "./Sidebar";

interface HeaderProps {
  open: boolean;
  onToggle: () => void;
}

export default function Header({ open }: HeaderProps) {
  const { data: session } = useSession();

  const sidebarWidth = open ? DRAWER_WIDTH : DRAWER_COLLAPSED;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${sidebarWidth}px)`,
        ml: `${sidebarWidth}px`,
        transition: "width 0.25s ease, margin-left 0.25s ease",
        bgcolor: "white",
        color: "text.primary",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar>
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
