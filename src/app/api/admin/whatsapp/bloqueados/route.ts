import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const origen = searchParams.get("origen");
  const search = searchParams.get("search")?.trim();

  const where: Record<string, unknown> = {};
  if (origen) where.origen = origen;
  if (search) where.numero = { contains: search };

  const [items, total] = await Promise.all([
    prisma.wa_contactos_bloqueados.findMany({
      where,
      orderBy: { bloqueado_at: "desc" },
      take: 500,
    }),
    prisma.wa_contactos_bloqueados.count({ where }),
  ]);

  // Resolver nombres de usuarios
  const userIds = Array.from(new Set(items.map((b) => b.usuario_id).filter((u): u is number => u !== null)));
  const usuarios = userIds.length > 0
    ? await prisma.usuarios.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nombre: true },
      })
    : [];
  const userMap = new Map(usuarios.map((u) => [u.id, u.nombre]));

  const data = items.map((b) => ({
    id: b.id,
    usuario_id: b.usuario_id,
    usuario_nombre: b.usuario_id ? userMap.get(b.usuario_id) ?? null : null,
    numero: b.numero,
    motivo: b.motivo,
    origen: b.origen,
    bloqueado_at: b.bloqueado_at.toISOString(),
  }));

  // Stats por origen
  const byOrigen = await prisma.wa_contactos_bloqueados.groupBy({
    by: ["origen"],
    _count: { id: true },
  });

  return NextResponse.json({
    items: data,
    total,
    porOrigen: byOrigen.map((o) => ({ origen: o.origen, count: o._count.id })),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const numero = String(body.numero ?? "").replace(/\D/g, "");
  const motivo = body.motivo ? String(body.motivo).slice(0, 200) : null;
  const usuario_id = body.usuario_id ? Number(body.usuario_id) : null;

  if (!numero || numero.length < 8) {
    return NextResponse.json({ error: "Número inválido" }, { status: 400 });
  }

  const existing = await prisma.wa_contactos_bloqueados.findFirst({
    where: { numero, usuario_id },
  });
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, duplicado: true });
  }

  const created = await prisma.wa_contactos_bloqueados.create({
    data: { numero, motivo, usuario_id, origen: "MANUAL" },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
