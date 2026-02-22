import { NextRequest, NextResponse } from "next/server";
import { requireAsistente } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { session, error } = await requireAsistente();
  if (error) return error;

  const userId = parseInt(session.user.id);
  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const skip = (page - 1) * limit;

  const [conversaciones, total] = await Promise.all([
    prisma.ia_conversaciones.findMany({
      where: { usuario_id: userId, activo: true },
      orderBy: { updated_at: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        titulo: true,
        created_at: true,
        updated_at: true,
        _count: { select: { mensajes: true } },
      },
    }),
    prisma.ia_conversaciones.count({
      where: { usuario_id: userId, activo: true },
    }),
  ]);

  return NextResponse.json({
    conversaciones,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
