import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireSupervisor } from "@/lib/auth-utils";

const TIPO_CLIENTE_LOCKED = "Compilado Cartera";

export async function POST(request: Request) {
  const { session, error } = await requireSupervisor();
  if (error) return error;

  const supervisorId = parseInt(session.user.id);

  let cantidad: number;
  let convenio: string | undefined;
  let estado: string | undefined;
  let municipio: string | undefined;
  let rango_oferta: string | undefined;
  let tiene_telefono: boolean | undefined;

  try {
    const body = await request.json();
    cantidad = Math.floor(Number(body.cantidad));
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      return NextResponse.json({ error: "Cantidad debe ser un numero entero positivo" }, { status: 400 });
    }
    convenio = body.convenio || undefined;
    estado = body.estado || undefined;
    municipio = body.municipio || undefined;
    rango_oferta = body.rango_oferta || undefined;
    tiene_telefono = body.tiene_telefono || false;
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  // Verificar que no tenga lote activo
  const loteActivo = await prisma.lotes_supervisor.findFirst({
    where: {
      supervisor_id: supervisorId,
      estado: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
  });

  if (loteActivo) {
    return NextResponse.json(
      { error: "Ya tienes un lote activo. Finaliza o califica todos los registros antes de solicitar otro." },
      { status: 409 }
    );
  }

  // Obtener equipo_id del supervisor
  const supervisor = await prisma.usuarios.findUnique({
    where: { id: supervisorId },
    select: { equipo_id: true },
  });

  if (!supervisor?.equipo_id) {
    return NextResponse.json({ error: "No tienes equipo asignado" }, { status: 400 });
  }

  try {
    // Exclusiones: oportunidades activas + calificaciones_supervisor activas + pool_supervisor no asignado
    const [excOportunidades, excCalificaciones, excPool] = await Promise.all([
      prisma.$queryRaw<{ cliente_id: number }[]>`
        SELECT DISTINCT cliente_id FROM oportunidades
        WHERE cliente_id IS NOT NULL AND activo = true
      `,
      prisma.$queryRaw<{ cliente_id: number }[]>`
        SELECT DISTINCT cs.cliente_id FROM calificaciones_supervisor cs
        JOIN lotes_supervisor ls ON ls.id = cs.lote_id
        WHERE ls.estado IN ('PENDIENTE', 'EN_PROCESO')
      `,
      prisma.$queryRaw<{ cliente_id: number }[]>`
        SELECT DISTINCT cliente_id FROM pool_supervisor
        WHERE asignado = false AND expira_at > NOW()
      `,
    ]);

    const idSet = new Set<number>();
    for (const r of excOportunidades) idSet.add(r.cliente_id);
    for (const r of excCalificaciones) idSet.add(r.cliente_id);
    for (const r of excPool) idSet.add(r.cliente_id);
    const excludeArray = [...idSet];

    // Build SQL con filtros
    const params: unknown[] = [TIPO_CLIENTE_LOCKED];
    const clauses: string[] = [`tipo_cliente = $1`];

    if (excludeArray.length > 0) {
      params.push(excludeArray);
      clauses.push(`id != ALL($${params.length})`);
    }
    if (convenio)  { params.push(convenio);  clauses.push(`convenio = $${params.length}`); }
    if (estado)    { params.push(estado);    clauses.push(`estado = $${params.length}`); }
    if (municipio) { params.push(municipio); clauses.push(`municipio = $${params.length}`); }
    if (tiene_telefono) clauses.push(`tel_1 IS NOT NULL AND TRIM(tel_1) != ''`);

    if (rango_oferta) {
      const OFERTA_NUM = `CAST(NULLIF(regexp_replace(COALESCE(oferta, ''), '[^0-9]', '', 'g'), '') AS NUMERIC)`;
      const rangos: Record<string, { min: number; max: number | null }> = {
        "0-50000": { min: 0, max: 50000 },
        "50000-100000": { min: 50000, max: 100000 },
        "100000-500000": { min: 100000, max: 500000 },
        "500000+": { min: 500000, max: null },
      };
      const rango = rangos[rango_oferta];
      if (rango) {
        params.push(rango.min);
        clauses.push(`${OFERTA_NUM} >= $${params.length}`);
        if (rango.max !== null) {
          params.push(rango.max);
          clauses.push(`${OFERTA_NUM} < $${params.length}`);
        }
      }
    }

    params.push(cantidad);
    const sql = `SELECT id FROM clientes WHERE ${clauses.join(" AND ")} ORDER BY id ASC LIMIT $${params.length}`;

    const records = await prismaClientes.$queryRawUnsafe<{ id: number }[]>(sql, ...params);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No hay registros disponibles con esos filtros" },
        { status: 404 }
      );
    }

    // Crear lote + calificaciones en transacción
    const lote = await prisma.$transaction(async (tx) => {
      const nuevoLote = await tx.lotes_supervisor.create({
        data: {
          supervisor_id: supervisorId,
          cantidad: records.length,
        },
      });

      await tx.calificaciones_supervisor.createMany({
        data: records.map((r) => ({
          lote_id: nuevoLote.id,
          supervisor_id: supervisorId,
          cliente_id: r.id,
        })),
      });

      return nuevoLote;
    });

    return NextResponse.json(
      {
        id: lote.id,
        fecha: lote.fecha,
        cantidad: records.length,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("Error al crear lote supervisor:", err instanceof Error ? err.message : "Error desconocido");
    return NextResponse.json(
      { error: "Error al crear el lote" },
      { status: 500 }
    );
  }
}
