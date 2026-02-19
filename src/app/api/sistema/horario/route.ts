import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { verificarHorarioConConfig } from "@/lib/horario";

/**
 * GET /api/sistema/horario
 * Devuelve el estado actual del horario del sistema.
 * Usado por el frontend para mostrar overlay fuera de horario.
 */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const horario = await verificarHorarioConConfig();

  return NextResponse.json(horario);
}
