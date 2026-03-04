import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getConfigBatch } from "@/lib/config-cache";

/**
 * GET /api/sistema/whatsapp-beta
 * Verifica si el usuario actual tiene acceso a WhatsApp Masivo.
 * Si beta no esta activo, todos tienen acceso.
 */
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const config = await getConfigBatch(["wa_beta_activo", "wa_beta_usuarios"]);

  const betaActivo = config["wa_beta_activo"] === "true";

  if (!betaActivo) {
    return NextResponse.json({ permitido: true, beta_activo: false });
  }

  const usuariosStr = config["wa_beta_usuarios"] || "";
  const idsPermitidos = usuariosStr
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  const userId = Number(session.user.id);
  const permitido = idsPermitidos.includes(userId);

  return NextResponse.json({ permitido, beta_activo: true });
}
