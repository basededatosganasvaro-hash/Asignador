"use client";
import { signOut, useSession } from "next-auth/react";
import {
  AppBar, Toolbar, Typography, Button, Box, Chip,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { DRAWER_COLLAPSED } from "./Sidebar";

interface HeaderProps {
  onToggle: () => void;
}

export default function Header({ onToggle: _onToggle }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${DRAWER_COLLAPSED}px)`,
        ml: `${DRAWER_COLLAPSED}px`,
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
