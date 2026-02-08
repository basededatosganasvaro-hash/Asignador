import { z } from "zod";

export const createUserSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email invalido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rol: z.enum(["admin", "promotor"]),
});

export const updateUserSchema = z.object({
  nombre: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  rol: z.enum(["admin", "promotor"]).optional(),
  activo: z.boolean().optional(),
});

export const updateConfigSchema = z.object({
  clave: z.string().min(1),
  valor: z.string().min(1),
});

export const updateClienteSchema = z.object({
  tel_1: z.string().optional(),
  curp: z.string().optional(),
  rfc: z.string().optional(),
  num_empleado: z.string().optional(),
});

export const createAsignacionSchema = z.object({
  cantidad: z.number().int().positive().optional(),
});
