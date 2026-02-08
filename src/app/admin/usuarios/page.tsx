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
  _count: { asignaciones: number };
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "promotor" as "admin" | "promotor",
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

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({ nombre: "", email: "", password: "", rol: "promotor" });
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: Usuario) => {
    setEditingUser(user);
    setFormData({ nombre: user.nombre, email: user.email, password: "", rol: user.rol as "admin" | "promotor" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingUser
      ? `/api/admin/usuarios/${editingUser.id}`
      : "/api/admin/usuarios";
    const method = editingUser ? "PUT" : "POST";

    const body: Record<string, string> = {
      nombre: formData.nombre,
      email: formData.email,
      rol: formData.rol,
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
      setSnackbar({
        open: true,
        message: user.activo ? "Usuario desactivado" : "Usuario activado",
        severity: "success",
      });
      fetchUsers();
    }
  };

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    {
      field: "rol",
      headerName: "Rol",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value === "admin" ? "Admin" : "Promotor"}
          color={params.value === "admin" ? "error" : "primary"}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "activo",
      headerName: "Estado",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Activo" : "Inactivo"}
          color={params.value ? "success" : "default"}
          size="small"
        />
      ),
    },
    {
      field: "_count",
      headerName: "Asignaciones",
      width: 120,
      align: "center",
      headerAlign: "center",
      valueGetter: (_value: unknown, row: Usuario) => row._count?.asignaciones ?? 0,
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 140,
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
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" },
          }}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label={editingUser ? "Nueva contraseña (dejar vacio para no cambiar)" : "Contraseña"}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            margin="normal"
            required={!editingUser}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Rol</InputLabel>
            <Select
              value={formData.rol}
              label="Rol"
              onChange={(e) => setFormData({ ...formData, rol: e.target.value as "admin" | "promotor" })}
            >
              <MenuItem value="promotor">Promotor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingUser ? "Actualizar" : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
