import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { updateUserSchema } from "@/lib/validators";
import { serializeBigInt } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const usuario = await prisma.usuarios.findUnique({
    where: { id: parseInt(id) },
    select: {
      id: true,
      nombre: true,
      username: true,
      telegram_id: true,
      rol: true,
      activo: true,
      created_at: true,
      equipo_id: true,
      sucursal_id: true,
      region_id: true,
      equipo: { select: { id: true, nombre: true } },
      sucursal: { select: { id: true, nombre: true } },
      region: { select: { id: true, nombre: true } },
    },
  });

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json(serializeBigInt(usuario));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.nombre !== undefined) data.nombre = parsed.data.nombre;
  if (parsed.data.username !== undefined) data.username = parsed.data.username;
  if (parsed.data.rol !== undefined) data.rol = parsed.data.rol;
  if (parsed.data.activo !== undefined) data.activo = parsed.data.activo;
  if (parsed.data.equipo_id !== undefined) data.equipo_id = parsed.data.equipo_id;
  if (parsed.data.sucursal_id !== undefined) data.sucursal_id = parsed.data.sucursal_id;
  if (parsed.data.region_id !== undefined) data.region_id = parsed.data.region_id;
  if (parsed.data.telegram_id !== undefined) {
    if (parsed.data.telegram_id) {
      try {
        data.telegram_id = BigInt(parsed.data.telegram_id);
      } catch {
        return NextResponse.json({ error: "telegram_id debe ser un numero valido" }, { status: 400 });
      }
    } else {
      data.telegram_id = null;
    }
  }

  // Auto-derivar sucursal_id y region_id desde la jerarquía del equipo
  // Solo cuando se ASIGNA un equipo — no al quitarlo, ya que region/sucursal
  // pueden ser asignados independientemente (ej. gerentes sin equipo)
  const equipoId = parsed.data.equipo_id !== undefined ? parsed.data.equipo_id : undefined;
  if (equipoId) {
    const equipo = await prisma.equipos.findUnique({
      where: { id: equipoId },
      include: { sucursal: { include: { zona: true } } },
    });
    if (equipo?.sucursal) {
      data.sucursal_id = equipo.sucursal.id;
      data.region_id = equipo.sucursal.zona?.region_id ?? null;
    }
  }
  if (parsed.data.password) {
    const hashed = await bcrypt.hash(parsed.data.password, 10);
    data.password_hash = hashed;
    data.debe_cambiar_password = true;
    data.intentos_fallidos = 0;
    data.bloqueado_hasta = null;
  }

  const usuario = await prisma.usuarios.update({
    where: { id: parseInt(id) },
    data,
    select: {
      id: true,
      nombre: true,
      username: true,
      rol: true,
      activo: true,
      created_at: true,
      equipo_id: true,
      sucursal_id: true,
      region_id: true,
      telegram_id: true,
    },
  });

  return NextResponse.json(serializeBigInt(usuario));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const userId = parseInt(id);

  const usuario = await prisma.usuarios.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          lotes: true,
          oportunidades: true,
          captaciones: true,
          ventas: true,
          datos_contacto_editados: true,
          historial: true,
          equipos_supervisados: true,
          wa_campanas: true,
          ad_registros: true,
        },
      },
    },
  });

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const counts = usuario._count;
  const totalRelations =
    counts.lotes + counts.oportunidades + counts.captaciones +
    counts.ventas + counts.datos_contacto_editados + counts.historial +
    counts.equipos_supervisados + counts.wa_campanas + counts.ad_registros;

  if (totalRelations > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar: el usuario tiene datos asociados. Desactívalo en su lugar." },
      { status: 409 }
    );
  }

  // Sin datos asociados — eliminar registros dependientes sin FK constraint y luego el usuario
  await prisma.$transaction([
    prisma.cupo_diario.deleteMany({ where: { usuario_id: userId } }),
    prisma.plantillas_whatsapp.deleteMany({ where: { usuario_id: userId } }),
    prisma.wa_sesiones.deleteMany({ where: { usuario_id: userId } }),
    prisma.ia_conversaciones.deleteMany({ where: { usuario_id: userId } }),
    prisma.planes_trabajo.deleteMany({ where: { creado_por: userId } }),
    prisma.usuarios.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ success: true });
}
