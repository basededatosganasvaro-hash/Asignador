"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import AssignmentIcon from "@mui/icons-material/Assignment";

const DRAWER_WIDTH = 260;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <DashboardIcon /> },
  { label: "Usuarios", href: "/admin/usuarios", icon: <PeopleIcon /> },
  { label: "Configuracion", href: "/admin/configuracion", icon: <SettingsIcon /> },
];

const promotorNav: NavItem[] = [
  { label: "Dashboard", href: "/promotor", icon: <DashboardIcon /> },
  { label: "Mis Asignaciones", href: "/promotor/asignaciones", icon: <AssignmentIcon /> },
];

export default function Sidebar({ rol }: { rol: string }) {
  const pathname = usePathname();
  const navItems = rol === "admin" ? adminNav : promotorNav;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          bgcolor: "#1a237e",
          color: "white",
        },
      }}
    >
      <Toolbar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
          <AssignmentIcon sx={{ fontSize: 28 }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, fontSize: "1rem" }}>
            Asignaciones
          </Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <List sx={{ px: 1, pt: 1 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={isActive}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                color: "rgba(255,255,255,0.7)",
                "&.Mui-selected": {
                  bgcolor: "rgba(255,255,255,0.12)",
                  color: "white",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.16)",
                  },
                },
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
