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
import BusinessIcon from "@mui/icons-material/Business";
import MapIcon from "@mui/icons-material/Map";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import GroupsIcon from "@mui/icons-material/Groups";
import WorkIcon from "@mui/icons-material/Work";
import FunnelIcon from "@mui/icons-material/FilterAlt";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import InboxIcon from "@mui/icons-material/Inbox";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import RuleIcon from "@mui/icons-material/Rule";

const DRAWER_WIDTH = 260;

export default function Sidebar({ rol }: { rol: string }) {
  const pathname = usePathname();

  if (rol !== "admin" && rol !== "gerente_regional" && rol !== "gerente_sucursal" && rol !== "supervisor") {
    // promotor nav
    return (
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", bgcolor: "#1a237e", color: "white" },
        }}
      >
        <Toolbar>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
            <AssignmentIcon sx={{ fontSize: 28 }} />
            <Typography variant="h6" noWrap sx={{ fontWeight: 700, fontSize: "1rem" }}>Asignaciones</Typography>
          </Box>
        </Toolbar>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
        <List sx={{ px: 1, pt: 1 }}>
          {[
            { label: "Dashboard", href: "/promotor", icon: <DashboardIcon /> },
            { label: "Mis Oportunidades", href: "/promotor/oportunidades", icon: <TrendingUpIcon /> },
            { label: "Captar cliente", href: "/promotor/captacion", icon: <PersonAddIcon /> },
            { label: "Mis Asignaciones", href: "/promotor/asignaciones", icon: <AssignmentIcon /> },
          ].map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={pathname === item.href}
              sx={navItemSx}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", bgcolor: "#1a237e", color: "white" },
      }}
    >
      <Toolbar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
          <AssignmentIcon sx={{ fontSize: 28 }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, fontSize: "1rem" }}>Asignaciones</Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <List sx={{ px: 1, pt: 1 }}>
        <NavItem label="Dashboard" href="/admin" icon={<DashboardIcon />} exact pathname={pathname} />
        <NavItem label="Bandeja" href="/admin/bandeja" icon={<InboxIcon />} pathname={pathname} />
        <NavItem label="Usuarios" href="/admin/usuarios" icon={<PeopleIcon />} exact pathname={pathname} />
        <NavItem label="Embudo" href="/admin/embudo" icon={<FunnelIcon />} exact pathname={pathname} />
        <NavItem label="Convenio Reglas" href="/admin/convenio-reglas" icon={<RuleIcon />} exact pathname={pathname} />

        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", my: 1 }} />
        <Typography sx={{ px: 1.5, py: 0.5, fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
          ORGANIZACIÓN
        </Typography>
        <NavItem label="Regiones" href="/admin/organizacion/regiones" icon={<MapIcon />} pathname={pathname} indent />
        <NavItem label="Zonas" href="/admin/organizacion/zonas" icon={<BusinessIcon />} pathname={pathname} indent />
        <NavItem label="Sucursales" href="/admin/organizacion/sucursales" icon={<LocationCityIcon />} pathname={pathname} indent />
        <NavItem label="Equipos" href="/admin/organizacion/equipos" icon={<GroupsIcon />} pathname={pathname} indent />

        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", my: 1 }} />
        <NavItem label="Planes de Trabajo" href="/admin/planes-trabajo" icon={<WorkIcon />} exact pathname={pathname} />
        <NavItem label="Configuracion" href="/admin/configuracion" icon={<SettingsIcon />} exact pathname={pathname} />

      </List>
    </Drawer>
  );
}

const navItemSx = {
  borderRadius: 1,
  mb: 0.5,
  color: "rgba(255,255,255,0.7)",
  "&.Mui-selected": {
    bgcolor: "rgba(255,255,255,0.12)",
    color: "white",
    "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
  },
  "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
};

function NavItem({
  label, href, icon, pathname, exact = false, indent = false,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  pathname: string;
  exact?: boolean;
  indent?: boolean;
}) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <ListItemButton
      component={Link}
      href={href}
      selected={isActive}
      sx={{ ...navItemSx, ...(indent ? { pl: 3 } : {}) }}
    >
      <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: indent ? "0.875rem" : undefined }} />
    </ListItemButton>
  );
}

export { DRAWER_WIDTH };
