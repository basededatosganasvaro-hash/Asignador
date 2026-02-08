import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { Prisma } from "@prisma/client";

// GET: Listar asignaciones del usuario autenticado
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = parseInt(session.user.id);

  const asignaciones = await prisma.asignaciones.findMany({
    where: { usuario_id: userId },
    include: {
      registros: {
        include: {
          cliente: {
            select: { tel_1: true },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const result = asignaciones.map((a) => {
    const registrosConTel1 = a.registros.filter(
      (r) => r.cliente.tel_1 && r.cliente.tel_1.trim() !== ""
    ).length;

    return {
      id: a.id,
      fecha_asignacion: a.fecha_asignacion,
      cantidad_registros: a.cantidad_registros,
      estado: a.estado,
      registros_con_tel1: registrosConTel1,
      puede_descargar: registrosConTel1 === a.cantidad_registros && a.cantidad_registros > 0,
    };
  });

  return NextResponse.json(result);
}

// POST: Solicitar nueva asignacion (lote)
export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = parseInt(session.user.id);

  let cantidad: number | undefined;
  try {
    const body = await request.json();
    cantidad = body.cantidad;
  } catch {
    // Si no hay body, usamos el maximo
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Leer configuracion de max registros por dia
        const config = await tx.configuracion.findUnique({
          where: { clave: "max_registros_por_dia" },
        });
        const maxPerDay = parseInt(config?.valor || "300");

        // 2. Calcular cuantos registros ya se asignaron hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const asignacionesHoy = await tx.asignaciones.findMany({
          where: {
            usuario_id: userId,
            fecha_asignacion: {
              gte: today,
              lt: tomorrow,
            },
          },
        });

        const asignadosHoy = asignacionesHoy.reduce(
          (sum, a) => sum + a.cantidad_registros,
          0
        );

        const remaining = maxPerDay - asignadosHoy;
        if (remaining <= 0) {
          throw new Error("DAILY_LIMIT_REACHED");
        }

        const requested = Math.min(cantidad || remaining, remaining);

        // 3. Seleccionar registros no asignados con lock para concurrencia
        const records: { id: number }[] = await tx.$queryRaw`
          SELECT c.id FROM clientes c
          LEFT JOIN asignacion_registros ar ON ar.cliente_id = c.id
          WHERE ar.id IS NULL
          ORDER BY c.id ASC
          LIMIT ${requested}
          FOR UPDATE OF c SKIP LOCKED
        `;

        if (records.length === 0) {
          throw new Error("NO_RECORDS_AVAILABLE");
        }

        // 4. Crear la asignacion
        const asignacion = await tx.asignaciones.create({
          data: {
            usuario_id: userId,
            fecha_asignacion: today,
            cantidad_registros: records.length,
            estado: "activa",
          },
        });

        // 5. Vincular registros al lote
        await tx.asignacion_registros.createMany({
          data: records.map((r) => ({
            asignacion_id: asignacion.id,
            cliente_id: r.id,
          })),
        });

        return {
          id: asignacion.id,
          fecha_asignacion: asignacion.fecha_asignacion,
          cantidad_registros: records.length,
          estado: asignacion.estado,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    if (message === "DAILY_LIMIT_REACHED") {
      return NextResponse.json(
        { error: "Has alcanzado el limite diario de asignaciones" },
        { status: 409 }
      );
    }

    if (message === "NO_RECORDS_AVAILABLE") {
      return NextResponse.json(
        { error: "No hay registros disponibles para asignar" },
        { status: 404 }
      );
    }

    console.error("Error al crear asignacion:", err);
    return NextResponse.json(
      { error: "Error al crear la asignacion" },
      { status: 500 }
    );
  }
}
