import { NextResponse } from "next/server";
import { requirePromotorOrSupervisor } from "@/lib/auth-utils";
import { busquedaClientesSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { getConfig } from "@/lib/config-cache";

const MEXICO_TZ = "America/Mexico_City";

function getTodayMexico(): { start: Date; end: Date } {
  // Obtener fecha en Mexico sin hardcodear offset (funciona en DST)
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: MEXICO_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const mx = fmt.format(new Date());
  // Calcular offset dinámico
  const offsetFmt = new Intl.DateTimeFormat("en-US", { timeZone: MEXICO_TZ, timeZoneName: "shortOffset" });
  const offsetPart = offsetFmt.formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value || "GMT-6";
  const offsetStr = offsetPart.replace("GMT", "") || "+0";
  const sign = offsetStr.startsWith("-") ? "-" : "+";
  const absHours = Math.abs(parseInt(offsetStr));
  const offset = `${sign}${String(absHours).padStart(2, "0")}:00`;
  const start = new Date(`${mx}T00:00:00${offset}`);
  const end = new Date(`${mx}T23:59:59.999${offset}`);
  return { start, end };
}

export async function POST(req: Request) {
  const { session, error } = await requirePromotorOrSupervisor();
  if (error) return error;

  let body;
  try {
    body = busquedaClientesSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const { start, end } = getTodayMexico();

  // Verificar cupo diario (lectura rápida antes de queries pesadas)
  const limite = parseInt(await getConfig("max_busquedas_por_dia") || "50");
  const usadasPre = await prisma.busquedas_clientes.count({
    where: {
      usuario_id: userId,
      created_at: { gte: start, lte: end },
    },
  });

  if (usadasPre >= limite) {
    return NextResponse.json(
      { error: "Has alcanzado el limite de busquedas por hoy", cupo: { limite, usadas: usadasPre, restantes: 0 } },
      { status: 429 }
    );
  }

  // Buscar en BD Clientes
  const selectFields = {
    id: true,
    nss: true,
    nombres: true,
    a_paterno: true,
    a_materno: true,
    curp: true,
    rfc: true,
    tel_1: true,
    tel_2: true,
    tel_3: true,
    tel_4: true,
    tel_5: true,
    convenio: true,
    dependencia: true,
    estado: true,
    municipio: true,
    capacidad: true,
    oferta: true,
    edad: true,
    genero: true,
    tipo_pension: true,
    estatus: true,
  };

  let whereClause: Record<string, unknown>;

  switch (body.tipo) {
    case "CURP":
      whereClause = { curp: body.valor.toUpperCase() };
      break;
    case "RFC":
      whereClause = { rfc: body.valor.toUpperCase() };
      break;
    case "TELEFONO":
      whereClause = {
        OR: [
          { tel_1: body.valor },
          { tel_2: body.valor },
          { tel_3: body.valor },
          { tel_4: body.valor },
          { tel_5: body.valor },
        ],
      };
      break;
    case "NSS":
      whereClause = { nss: body.valor };
      break;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientes = await (prismaClientes.clientes as any).findMany({
    where: whereClause,
    select: selectFields,
    take: 20,
  });

  // Merge datos_contacto si hay ediciones
  if (clientes.length > 0) {
    const clienteIds = clientes.map((c: { id: number }) => c.id);
    const ediciones = await prisma.datos_contacto.findMany({
      where: { cliente_id: { in: clienteIds } },
      orderBy: { created_at: "desc" },
    });

    if (ediciones.length > 0) {
      // Con orderBy desc, el primer valor por campo es el más reciente
      const editMap = new Map<number, Record<string, string>>();
      for (const e of ediciones) {
        if (!editMap.has(e.cliente_id)) editMap.set(e.cliente_id, {});
        const clientEdits = editMap.get(e.cliente_id)!;
        if (!(e.campo in clientEdits)) clientEdits[e.campo] = e.valor; // first-write wins (most recent)
      }
      for (const c of clientes) {
        const edits = editMap.get(c.id);
        if (edits) Object.assign(c, edits);
      }
    }
  }

  // Registrar busqueda con verificación atómica de cupo (C12)
  const txResult = await prisma.$transaction(async (tx) => {
    const usadas = await tx.busquedas_clientes.count({
      where: { usuario_id: userId, created_at: { gte: start, lte: end } },
    });
    if (usadas >= limite) {
      return { error: true, usadas } as const;
    }
    const busqueda = await tx.busquedas_clientes.create({
      data: {
        usuario_id: userId,
        tipo: body.tipo,
        valor: body.valor,
        motivo: body.motivo,
        resultados: clientes.length,
      },
    });
    return { error: false, busqueda, usadas } as const;
  });

  if (txResult.error) {
    return NextResponse.json(
      { error: "Has alcanzado el limite de busquedas por hoy", cupo: { limite, usadas: txResult.usadas, restantes: 0 } },
      { status: 429 }
    );
  }

  return NextResponse.json({
    resultados: clientes,
    busqueda_id: txResult.busqueda.id,
    cupo: { limite, usadas: txResult.usadas + 1, restantes: Math.max(0, limite - txResult.usadas - 1) },
  });
}
