"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Ban, CheckCircle, Search, Copy, Download } from "lucide-react";

interface Usuario {
  id: number;
  nombre: string;
  username?: string;
  rol: string;
  activo: boolean;
  created_at: string;
  region: { id: number; nombre: string } | null;
  sucursal: { id: number; nombre: string } | null;
  equipo: { id: number; nombre: string } | null;
  telegram_id: string | null;
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
  gestor_operaciones: "Gestor Op.",
  comercial: "Comercial",
  direccion: "Direccion",
};

type BadgeColor = "red" | "orange" | "blue" | "purple" | "amber" | "teal" | "slate";

const ROL_COLORS: Record<string, BadgeColor> = {
  admin: "red",
  gerente_regional: "orange",
  gerente_sucursal: "blue",
  supervisor: "purple",
  promotor: "amber",
  gestor_operaciones: "teal",
  comercial: "slate",
  direccion: "orange",
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const { toast } = useToast();

  const [regiones, setRegiones] = useState<OrgItem[]>([]);
  const [sucursales, setSucursales] = useState<OrgItem[]>([]);
  const [equipos, setEquipos] = useState<OrgItem[]>([]);

  const [busqueda, setBusqueda] = useState("");

  const usuariosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return usuarios;
    const term = busqueda.toLowerCase();
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(term) ||
        (u.username && u.username.toLowerCase().includes(term)) ||
        (u.equipo?.nombre && u.equipo.nombre.toLowerCase().includes(term))
    );
  }, [usuarios, busqueda]);

  const [formData, setFormData] = useState({
    nombre: "",
    username: "",
    password: "",
    rol: "promotor",
    region_id: "",
    sucursal_id: "",
    equipo_id: "",
    telegram_id: "",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usuarios");
      if (!res.ok) throw new Error("Error al cargar usuarios");
      const data = await res.json();
      setUsuarios(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchOrgData = async () => {
    try {
      const [r, s, e] = await Promise.all([
        fetch("/api/admin/organizacion/regiones").then((res) => res.json()),
        fetch("/api/admin/organizacion/sucursales").then((res) => res.json()),
        fetch("/api/admin/organizacion/equipos").then((res) => res.json()),
      ]);
      setRegiones(r);
      setSucursales(s);
      setEquipos(e);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error de conexion", "error");
    }
  };

  const handleOpenCreate = async () => {
    setEditingUser(null);
    setFormData({ nombre: "", username: "", password: "", rol: "promotor", region_id: "", sucursal_id: "", equipo_id: "", telegram_id: "" });
    await fetchOrgData();
    setDialogOpen(true);
  };

  const handleOpenEdit = async (user: Usuario) => {
    setEditingUser(user);
    setFormData({
      nombre: user.nombre,
      username: user.username || "",
      password: "",
      rol: user.rol,
      region_id: user.region?.id ? String(user.region.id) : "",
      sucursal_id: user.sucursal?.id ? String(user.sucursal.id) : "",
      equipo_id: user.equipo?.id ? String(user.equipo.id) : "",
      telegram_id: user.telegram_id ? String(user.telegram_id) : "",
    });
    await fetchOrgData();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingUser ? `/api/admin/usuarios/${editingUser.id}` : "/api/admin/usuarios";
    const method = editingUser ? "PUT" : "POST";

    const body: Record<string, string | number | null> = {
      nombre: formData.nombre,
      username: formData.username,
      rol: formData.rol,
      region_id: formData.region_id ? Number(formData.region_id) : null,
      sucursal_id: formData.sucursal_id ? Number(formData.sucursal_id) : null,
      equipo_id: formData.equipo_id ? Number(formData.equipo_id) : null,
      telegram_id: formData.telegram_id ? Number(formData.telegram_id) : null,
    };
    if (formData.password) body.password = formData.password;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      toast(editingUser ? "Usuario actualizado" : "Usuario creado", "success");
      fetchUsers();
    } else {
      const data = await res.json();
      toast(data.error || "Error al guardar", "error");
    }
  };

  const handleToggleActive = async (user: Usuario) => {
    const res = await fetch(`/api/admin/usuarios/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !user.activo }),
    });
    if (res.ok) {
      toast(user.activo ? "Usuario desactivado" : "Usuario activado", "success");
      fetchUsers();
    }
  };

  const handleCopyUsername = (username: string) => {
    navigator.clipboard.writeText(username);
    toast(`Username "${username}" copiado`, "success");
  };

  const columns: ColumnDef<Usuario, unknown>[] = [
    {
      accessorKey: "nombre",
      header: "Nombre",
      size: 200,
    },
    {
      accessorKey: "username",
      header: "Usuario",
      size: 170,
      cell: ({ row }) => {
        const username = row.original.username;
        if (!username) return <span className="text-slate-500">&mdash;</span>;
        return (
          <Tooltip content="Click para copiar">
            <button
              onClick={() => handleCopyUsername(username)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono
                bg-slate-800/50 text-slate-300 ring-1 ring-slate-700
                hover:bg-slate-700/60 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              {username}
            </button>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "rol",
      header: "Rol",
      size: 140,
      cell: ({ row }) => (
        <Badge color={ROL_COLORS[row.original.rol] ?? "slate"}>
          {ROL_LABELS[row.original.rol] ?? row.original.rol}
        </Badge>
      ),
    },
    {
      accessorKey: "telegram_id",
      header: "Telegram ID",
      size: 140,
      cell: ({ row }) => (
        <span className="text-sm text-slate-400">
          {row.original.telegram_id ?? "\u2014"}
        </span>
      ),
    },
    {
      id: "sucursal",
      header: "Sucursal",
      size: 140,
      accessorFn: (row) => row.sucursal?.nombre ?? "\u2014",
    },
    {
      id: "equipo",
      header: "Equipo",
      size: 120,
      accessorFn: (row) => row.equipo?.nombre ?? "\u2014",
    },
    {
      id: "lotes",
      header: "Lotes",
      size: 80,
      accessorFn: (row) => row._count?.lotes ?? 0,
      cell: ({ getValue }) => (
        <span className="text-center block">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: "activo",
      header: "Estado",
      size: 100,
      cell: ({ row }) => (
        <Badge color={row.original.activo ? "green" : "slate"}>
          {row.original.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenEdit(row.original)}
            title="Editar"
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleActive(row.original)}
            title={row.original.activo ? "Desactivar" : "Activar"}
            className={`p-1.5 rounded-lg transition-colors ${
              row.original.activo
                ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                : "text-slate-400 hover:text-green-400 hover:bg-green-500/10"
            }`}
          >
            {row.original.activo ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-xl font-bold text-slate-100">Gestion de Usuarios</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={() => window.open("/api/admin/usuarios/exportar", "_blank")}
          >
            Descargar
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Nuevo Usuario
          </Button>
        </div>
      </div>

      <div className="mb-4 max-w-md">
        <Input
          placeholder="Buscar por nombre, usuario o equipo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      <DataTable
        data={usuariosFiltrados}
        columns={columns}
        loading={loading}
        pageSize={10}
        pageSizeOptions={[10, 25]}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input
            label="Nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            required
          />
          <Input
            label="Nombre de usuario"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            helperText="Minimo 4 caracteres. Solo letras, numeros, puntos y guiones."
            minLength={4}
            maxLength={50}
          />
          <Input
            label={editingUser ? "Nueva contrasena (dejar vacio para no cambiar)" : "Contrasena"}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!editingUser}
          />
          <Select
            label="Rol"
            value={formData.rol}
            onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
            options={[
              { value: "promotor", label: "Promotor" },
              { value: "supervisor", label: "Supervisor" },
              { value: "gerente_sucursal", label: "Gerente de Sucursal" },
              { value: "gerente_regional", label: "Gerente Regional" },
              { value: "admin", label: "Admin" },
              { value: "gestor_operaciones", label: "Gestor de Operaciones" },
              { value: "comercial", label: "Comercial" },
              { value: "direccion", label: "Direccion" },
            ]}
          />
          <Input
            label="Telegram ID (opcional)"
            value={formData.telegram_id}
            onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
            type="number"
            helperText="ID de Telegram del usuario (para vincular capacidades)"
          />
          <Select
            label="Region (opcional)"
            value={formData.region_id}
            onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
            options={regiones.map((r) => ({ value: String(r.id), label: r.nombre }))}
            placeholder="Sin region"
          />
          <Select
            label="Sucursal (opcional)"
            value={formData.sucursal_id}
            onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
            options={sucursales.map((s) => ({ value: String(s.id), label: s.nombre }))}
            placeholder="Sin sucursal"
          />
          <Select
            label="Equipo (opcional)"
            value={formData.equipo_id}
            onChange={(e) => setFormData({ ...formData, equipo_id: e.target.value })}
            options={equipos.map((e) => ({ value: String(e.id), label: e.nombre }))}
            placeholder="Sin equipo"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>{editingUser ? "Actualizar" : "Crear"}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
