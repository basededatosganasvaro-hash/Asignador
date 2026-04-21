import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { serializeBigInt } from "@/lib/utils";

/**
 * GET /api/admin/auditoria/cliente/[id]
 * Quién ha visto al cliente X (y acciones relacionadas)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const eventos = await prisma.access_log.findMany({
    where: { recurso_id: id },
    orderBy: { created_at: "desc" },
    take: 1000,
  });

  // También buscar eventos cuya metadata contenga cliente_id = id
  const viaMetadata = await prisma.$queryRaw<Array<{
    id: bigint; created_at: Date; usuario_id: number | null; username: string | null;
    rol: string | null; accion: string; recurso_id: string | null; metadata: unknown; ip: string | null;
  }>>`
    SELECT id, created_at, usuario_id, username, rol, accion, recurso_id, metadata, ip
    FROM access_log
    WHERE metadata->>'cliente_id' = ${id}
    ORDER BY created_at DESC
    LIMIT 1000
  `;

  const usuariosUnicos = new Set<number>();
  for (const e of [...eventos, ...viaMetadata]) {
    if (e.usuario_id) usuariosUnicos.add(e.usuario_id);
  }

  return NextResponse.json({
    cliente_id: id,
    total_eventos: eventos.length + viaMetadata.length,
    usuarios_unicos: usuariosUnicos.size,
    eventos_directos: serializeBigInt(eventos),
    eventos_metadata: serializeBigInt(viaMetadata),
  });
}
