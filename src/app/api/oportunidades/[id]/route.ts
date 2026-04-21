import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";
import { logAccessWithSession } from "@/lib/access-log";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const userId = Number(session!.user.id);
  const rol = session!.user.rol;

  const op = await prisma.oportunidades.findUnique({
    where: { id: Number(id) },
    include: {
      etapa: true,
      captacion: true,
      historial: {
        include: {
          usuario: { select: { id: true, nombre: true, rol: true } },
          etapa_anterior: { select: { id: true, nombre: true, color: true } },
          etapa_nueva: { select: { id: true, nombre: true, color: true } },
        },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!op) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Solo el dueño o rol superior con scope puede ver esta oportunidad
  if (op.usuario_id !== userId) {
    const rolesSuperiores = ["admin", "gerente_regional", "gerente_sucursal", "supervisor"];
    if (!rolesSuperiores.includes(rol)) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
    // H17: Verificar scope organizacional para roles no-admin
    if (rol === "supervisor") {
      const equipo = await prisma.equipos.findFirst({ where: { supervisor_id: userId }, select: { id: true } });
      if (equipo) {
        const promotor = await prisma.usuarios.findUnique({ where: { id: op.usuario_id }, select: { equipo_id: true } });
        if (promotor?.equipo_id !== equipo.id) {
          return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
        }
      }
    }
  }

  let clienteMerged: Record<string, unknown> = {};

  if (op.cliente_id !== null) {
    // Cliente de BD Clientes
    const cliente = await prismaClientes.clientes.findUnique({
      where: { id: op.cliente_id },
    });

    const ediciones = await prisma.datos_contacto.findMany({
      where: { cliente_id: op.cliente_id },
      orderBy: { created_at: "desc" },
    });
    const editMap: Record<string, string> = {};
    for (const edit of ediciones) {
      if (!editMap[edit.campo]) editMap[edit.campo] = edit.valor;
    }

    clienteMerged = { ...(cliente as object), ...editMap };
  } else if (op.captacion) {
    // Cliente captado — datos desde datos_json
    const datos = op.captacion.datos_json as Record<string, string>;
    clienteMerged = {
      ...datos,
      convenio: op.captacion.convenio,
      _es_captacion_nueva: true,
    };
  }

  // Transiciones disponibles desde la etapa actual
  let transiciones: unknown[] = [];
  if (op.etapa_id) {
    transiciones = await prisma.embudo_transiciones.findMany({
      where: { etapa_origen_id: op.etapa_id, activo: true },
      include: { etapa_destino: { select: { id: true, nombre: true, color: true, tipo: true } } },
    });
  }

  logAccessWithSession(session, "view_oportunidad", {
    recurso_id: op.id,
    metadata: { cliente_id: op.cliente_id, etapa_id: op.etapa_id },
    req,
  });

  return NextResponse.json({
    ...op,
    cliente: clienteMerged,
    transiciones,
  });
}
