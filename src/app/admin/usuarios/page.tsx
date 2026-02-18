"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Snackbar,
  IconButton,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
  region: { id: number; nombre: string } | null;
  sucursal: { id: number; nombre: string } | null;
  equipo: { id: number; nombre: string } | null;
  _count: { lotes: number; oportunidades: number };
}

interface OrgItem {
  id: number;
  nombre: string;
}

const ROL_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente_regional: "Gte. Regional",
  gerente_sucursal: "Gte. Sucursal",
  supervisor: "Supervisor",
  promotor: "Promotor",
};

const ROL_COLORS: Record<string, "error" | "warning" | "info" | "secondary" | "primary"> = {
  admin: "error",
  gerente_regional: "warning",
  gerente_sucursal: "info",
  supervisor: "secondary",
  promotor: "primary",
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const [regiones, setRegiones] = useState<OrgItem[]>([]);
  const [sucursales, setSucursales] = useState<OrgItem[]>([]);
  const [equipos, setEquipos] = useState<OrgItem[]>([]);

  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "promotor",
    region_id: "",
    sucursal_id: "",
    equipo_id: "",
  });

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/usuarios");
    const data = await res.json();
    setUsuarios(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchOrgData = async () => {
    const [r, s, e] = await Promise.all([
      fetch("/api/admin/organizacion/regiones").then((res) => res.json()),
      fetch("/api/admin/organizacion/sucursales").then((res) => res.json()),
      fetch("/api/admin/organizacion/equipos").then((res) => res.json()),
    ]);
    setRegiones(r);
    setSucursales(s);
    setEquipos(e);
  };

  const handleOpenCreate = async () => {
    setEditingUser(null);
    setFormData({ nombre: "", email: "", password: "", rol: "promotor", region_id: "", sucursal_id: "", equipo_id: "" });
    await fetchOrgData();
    setDialogOpen(true);
  };

  const handleOpenEdit = async (user: Usuario) => {
    setEditingUser(user);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      password: "",
      rol: user.rol,
      region_id: user.region?.id ? String(user.region.id) : "",
      sucursal_id: user.sucursal?.id ? String(user.sucursal.id) : "",
      equipo_id: user.equipo?.id ? String(user.equipo.id) : "",
    });
    await fetchOrgData();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingUser ? `/api/admin/usuarios/${editingUser.id}` : "/api/admin/usuarios";
    const method = editingUser ? "PUT" : "POST";

    const body: Record<string, string | number | null> = {
      nombre: formData.nombre,
      email: formData.email,
      rol: formData.rol,
      region_id: formData.region_id ? Number(formData.region_id) : null,
      sucursal_id: formData.sucursal_id ? Number(formData.sucursal_id) : null,
      equipo_id: formData.equipo_id ? Number(formData.equipo_id) : null,
    };
    if (formData.password) body.password = formData.password;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      setSnackbar({ open: true, message: editingUser ? "Usuario actualizado" : "Usuario creado", severity: "success" });
      fetchUsers();
    } else {
      const data = await res.json();
      setSnackbar({ open: true, message: data.error || "Error al guardar", severity: "error" });
    }
  };

  const handleToggleActive = async (user: Usuario) => {
    const res = await fetch(`/api/admin/usuarios/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !user.activo }),
    });
    if (res.ok) {
      setSnackbar({ open: true, message: user.activo ? "Usuario desactivado" : "Usuario activado", severity: "success" });
      fetchUsers();
    }
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    {
      field: "rol",
      headerName: "Rol",
      width: 140,
      renderCell: (params) => (
        <Chip
          label={ROL_LABELS[params.value] ?? params.value}
          color={ROL_COLORS[params.value] ?? "default"}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "sucursal",
      headerName: "Sucursal",
      width: 140,
      valueGetter: (_value: unknown, row: Usuario) => row.sucursal?.nombre ?? "—",
    },
    {
      field: "equipo",
      headerName: "Equipo",
      width: 120,
      valueGetter: (_value: unknown, row: Usuario) => row.equipo?.nombre ?? "—",
    },
    {
      field: "lotes",
      headerName: "Lotes",
      width: 80,
      align: "center",
      headerAlign: "center",
      valueGetter: (_value: unknown, row: Usuario) => row._count?.lotes ?? 0,
    },
    {
      field: "activo",
      headerName: "Estado",
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value ? "Activo" : "Inactivo"} color={params.value ? "success" : "default"} size="small" />
      ),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => handleOpenEdit(params.row)} title="Editar">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleToggleActive(params.row)}
            title={params.row.activo ? "Desactivar" : "Activar"}
            color={params.row.activo ? "error" : "success"}
          >
            {params.row.activo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Gestion de Usuarios</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Nuevo Usuario
        </Button>
      </Box>

      <Box sx={{ bgcolor: "white", borderRadius: 2 }}>
        <DataGrid
          rows={usuarios}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          autoHeight
          sx={{ border: "none", "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" } }}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Nombre" value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            margin="normal" required
          />
          <TextField
            fullWidth label="Email" type="email" value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal" required
          />
          <TextField
            fullWidth
            label={editingUser ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
            type="password" value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            margin="normal" required={!editingUser}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Rol</InputLabel>
            <Select value={formData.rol} label="Rol" onChange={(e) => setFormData({ ...formData, rol: e.target.value })}>
              <MenuItem value="promotor">Promotor</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
              <MenuItem value="gerente_sucursal">Gerente de Sucursal</MenuItem>
              <MenuItem value="gerente_regional">Gerente Regional</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Región (opcional)</InputLabel>
            <Select value={formData.region_id} label="Región (opcional)" onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}>
              <MenuItem value="">Sin región</MenuItem>
              {regiones.map((r) => <MenuItem key={r.id} value={String(r.id)}>{r.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Sucursal (opcional)</InputLabel>
            <Select value={formData.sucursal_id} label="Sucursal (opcional)" onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}>
              <MenuItem value="">Sin sucursal</MenuItem>
              {sucursales.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Equipo (opcional)</InputLabel>
            <Select value={formData.equipo_id} label="Equipo (opcional)" onChange={(e) => setFormData({ ...formData, equipo_id: e.target.value })}>
              <MenuItem value="">Sin equipo</MenuItem>
              {equipos.map((e) => <MenuItem key={e.id} value={String(e.id)}>{e.nombre}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>{editingUser ? "Actualizar" : "Crear"}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
