import { z } from "zod";

export const ROLES = ["admin", "gerente_regional", "gerente_sucursal", "supervisor", "promotor"] as const;
export type Rol = typeof ROLES[number];

// ============ USUARIOS ============

export const createUserSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  username: z.string().min(4, "El usuario debe tener al menos 4 caracteres").max(50).regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, numeros, puntos, guiones"),
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rol: z.enum(ROLES),
  equipo_id: z.number().int().positive().optional().nullable(),
  sucursal_id: z.number().int().positive().optional().nullable(),
  region_id: z.number().int().positive().optional().nullable(),
  telegram_id: z.number().int().positive().optional().nullable(),
});

export const updateUserSchema = z.object({
  nombre: z.string().min(2).optional(),
  username: z.string().min(4).max(50).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
  equipo_id: z.number().int().positive().optional().nullable(),
  sucursal_id: z.number().int().positive().optional().nullable(),
  region_id: z.number().int().positive().optional().nullable(),
  telegram_id: z.number().int().positive().optional().nullable(),
});

// ============ CONFIGURACION ============

export const updateConfigSchema = z.object({
  clave: z.string().min(1),
  valor: z.string().min(1),
});

// ============ CLIENTES (edicion en BD Sistema) ============

export const updateClienteSchema = z.object({
  tel_1: z.string().optional(),
  curp: z.string().optional(),
  rfc: z.string().optional(),
  num_empleado: z.string().optional(),
});

// ============ ASIGNACIONES ============

export const createAsignacionSchema = z.object({
  cantidad: z.number().int().positive().optional(),
});

// ============ ORGANIZACION ============

export const createRegionSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(200),
});

export const createZonaSchema = z.object({
  nombre: z.string().min(1).max(200),
  region_id: z.number().int().positive(),
});

export const createSucursalSchema = z.object({
  nombre: z.string().min(1).max(200),
  zona_id: z.number().int().positive(),
  direccion: z.string().optional(),
});

export const createEquipoSchema = z.object({
  nombre: z.string().min(1).max(200),
  sucursal_id: z.number().int().positive(),
  supervisor_id: z.number().int().positive().optional().nullable(),
});

// ============ PLAN DE TRABAJO ============

export const createPlanTrabajoSchema = z.object({
  sucursal_id: z.number().int().positive(),
  convenio: z.string().min(1).max(300),
});
