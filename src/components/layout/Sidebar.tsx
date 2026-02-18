"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Box, Divider, IconButton, Tooltip,
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const DRAWER_WIDTH = 260;
const DRAWER_COLLAPSED = 68;

interface SidebarProps {
  rol: string;
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ rol, open, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const isPromotor = rol !== "admin" && rol !== "gerente_regional" && rol !== "gerente_sucursal" && rol !== "supervisor";

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? DRAWER_WIDTH : DRAWER_COLLAPSED,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: open ? DRAWER_WIDTH : DRAWER_COLLAPSED,
          boxSizing: "border-box",
          bgcolor: "#1a237e",
          color: "white",
          overflowX: "hidden",
          transition: "width 0.25s ease",
        },
      }}
    >
      <Toolbar sx={{ justifyContent: open ? "space-between" : "center", minHeight: "64px !important", px: open ? 2 : 0 }}>
        {open ? (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AssignmentIcon sx={{ fontSize: 28 }} />
              <Typography variant="h6" noWrap sx={{ fontWeight: 700, fontSize: "1rem" }}>Asignaciones</Typography>
            </Box>
            <IconButton onClick={onToggle} sx={{ color: "rgba(255,255,255,0.7)" }} size="small">
              <ChevronLeftIcon />
            </IconButton>
          </>
        ) : (
          <IconButton onClick={onToggle} sx={{ color: "rgba(255,255,255,0.7)" }} size="small">
            <ChevronRightIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

      {isPromotor ? (
        <List sx={{ px: open ? 1 : 0.5, pt: 1 }}>
          <NavItem label="Dashboard" href="/promotor" icon={<DashboardIcon />} exact pathname={pathname} open={open} />
          <NavItem label="Mi Asignación" href="/promotor/oportunidades" icon={<TrendingUpIcon />} pathname={pathname} open={open} />
          <NavItem label="Captar cliente" href="/promotor/captacion" icon={<PersonAddIcon />} pathname={pathname} open={open} />
          <NavItem label="Mis Lotes" href="/promotor/asignaciones" icon={<AssignmentIcon />} pathname={pathname} open={open} />
        </List>
      ) : (
        <List sx={{ px: open ? 1 : 0.5, pt: 1 }}>
          <NavItem label="Dashboard" href="/admin" icon={<DashboardIcon />} exact pathname={pathname} open={open} />
          <NavItem label="Bandeja" href="/admin/bandeja" icon={<InboxIcon />} pathname={pathname} open={open} />
          <NavItem label="Usuarios" href="/admin/usuarios" icon={<PeopleIcon />} exact pathname={pathname} open={open} />
          <NavItem label="Embudo" href="/admin/embudo" icon={<FunnelIcon />} exact pathname={pathname} open={open} />
          <NavItem label="Convenio Reglas" href="/admin/convenio-reglas" icon={<RuleIcon />} exact pathname={pathname} open={open} />

          <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", my: 1 }} />
          {open && (
            <Typography sx={{ px: 1.5, py: 0.5, fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
              ORGANIZACIÓN
            </Typography>
          )}
          <NavItem label="Regiones" href="/admin/organizacion/regiones" icon={<MapIcon />} pathname={pathname} indent open={open} />
          <NavItem label="Zonas" href="/admin/organizacion/zonas" icon={<BusinessIcon />} pathname={pathname} indent open={open} />
          <NavItem label="Sucursales" href="/admin/organizacion/sucursales" icon={<LocationCityIcon />} pathname={pathname} indent open={open} />
          <NavItem label="Equipos" href="/admin/organizacion/equipos" icon={<GroupsIcon />} pathname={pathname} indent open={open} />

          <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", my: 1 }} />
          <NavItem label="Planes de Trabajo" href="/admin/planes-trabajo" icon={<WorkIcon />} exact pathname={pathname} open={open} />
          <NavItem label="Configuracion" href="/admin/configuracion" icon={<SettingsIcon />} exact pathname={pathname} open={open} />
        </List>
      )}
    </Drawer>
  );
}

const navItemSx = (open: boolean) => ({
  borderRadius: 1,
  mb: 0.5,
  color: "rgba(255,255,255,0.7)",
  justifyContent: open ? "initial" : "center",
  px: open ? 1.5 : 1,
  minHeight: 44,
  "&.Mui-selected": {
    bgcolor: "rgba(255,255,255,0.12)",
    color: "white",
    "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
  },
  "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
});

function NavItem({
  label, href, icon, pathname, exact = false, indent = false, open,
}: {
  label: string; href: string; icon: React.ReactNode;
  pathname: string; exact?: boolean; indent?: boolean; open: boolean;
}) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  const button = (
    <ListItemButton
      component={Link}
      href={href}
      selected={isActive}
      sx={{ ...navItemSx(open), ...(indent && open ? { pl: 3 } : {}) }}
    >
      <ListItemIcon sx={{ color: "inherit", minWidth: open ? 36 : 0, justifyContent: "center" }}>
        {icon}
      </ListItemIcon>
      {open && (
        <ListItemText
          primary={label}
          primaryTypographyProps={{ fontSize: indent ? "0.875rem" : undefined, noWrap: true }}
        />
      )}
    </ListItemButton>
  );

  if (!open) {
    return (
      <Tooltip title={label} placement="right" arrow>
        {button}
      </Tooltip>
    );
  }

  return button;
}

export { DRAWER_WIDTH, DRAWER_COLLAPSED };
