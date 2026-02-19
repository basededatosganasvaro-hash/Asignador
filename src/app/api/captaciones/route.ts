import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";
import { verificarHorarioConConfig } from "@/lib/horario";

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  // Validar horario operativo
  const horario = await verificarHorarioConConfig();
  if (!horario.activo) {
    return NextResponse.json({ error: horario.mensaje }, { status: 403 });
  }

  const userId = Number(session!.user.id);
  const rol = session!.user.rol;

  if (!["promotor", "supervisor"].includes(rol)) {
    return NextResponse.json({ error: "Solo promotores y supervisores pueden captar" }, { status: 403 });
  }

  const body = await req.json();
  const { origen_captacion, convenio, datos } = body;

  if (!origen_captacion || !convenio || !datos) {
    return NextResponse.json({ error: "origen_captacion, convenio y datos son requeridos" }, { status: 400 });
  }

  // Validar campos obligatorios del convenio
  const reglas = await prisma.convenio_reglas.findMany({ where: { convenio } });
  const faltantes = reglas.filter((r) => r.obligatorio && !datos[r.campo]);
  if (faltantes.length > 0) {
    return NextResponse.json(
      { error: `Campos obligatorios faltantes: ${faltantes.map((r) => r.campo).join(", ")}` },
      { status: 400 }
    );
  }

  // Validar campos base
  if (!datos.nombres && !(datos.a_paterno || datos.a_materno)) {
    return NextResponse.json({ error: "Se requiere al menos el nombre del prospecto" }, { status: 400 });
  }
  if (!datos.tel_1) {
    return NextResponse.json({ error: "Se requiere al menos un teléfono" }, { status: 400 });
  }

  // Buscar duplicados en BD Clientes por NSS / CURP / RFC
  let clienteId: number | null = null;
  const condiciones: object[] = [];
  if (datos.nss) condiciones.push({ nss: datos.nss });
  if (datos.curp) condiciones.push({ curp: datos.curp });
  if (datos.rfc) condiciones.push({ rfc: datos.rfc });

  if (condiciones.length > 0) {
    const existing = await prismaClientes.clientes.findFirst({
      where: { OR: condiciones },
      select: { id: true },
    });

    if (existing) {
      // Verificar que este promotor no tenga ya este cliente activo
      const dupOp = await prisma.oportunidades.findFirst({
        where: { cliente_id: existing.id, usuario_id: userId, activo: true },
      });
      if (dupOp) {
        return NextResponse.json(
          { error: "Ya tienes una oportunidad activa con este cliente", oportunidad_id: dupOp.id },
          { status: 409 }
        );
      }
      clienteId = existing.id;
    }
  }

  // Obtener etapa "Asignado"
  const etapaAsignado = await prisma.embudo_etapas.findFirst({
    where: { nombre: "Asignado", activo: true },
  });

  // Obtener timer de captación
  const timerConfig = await prisma.configuracion.findUnique({
    where: { clave: "timer_captacion_horas" },
  });
  const timerHoras = timerConfig ? Number(timerConfig.valor) : 168;
  const timerVence = new Date(Date.now() + timerHoras * 60 * 60 * 1000);

  // Transacción: crear oportunidad + captacion + historial
  const oportunidad = await prisma.$transaction(async (tx) => {
    const op = await tx.oportunidades.create({
      data: {
        cliente_id: clienteId,
        usuario_id: userId,
        etapa_id: etapaAsignado?.id ?? null,
        origen: "CAPTACION",
        timer_vence: timerVence,
        activo: true,
      },
    });

    await tx.captaciones.create({
      data: {
        oportunidad_id: op.id,
        usuario_id: userId,
        origen_captacion,
        convenio,
        datos_json: datos,
      },
    });

    await tx.historial.create({
      data: {
        oportunidad_id: op.id,
        usuario_id: userId,
        tipo: "CAPTACION",
        etapa_nueva_id: etapaAsignado?.id ?? null,
        nota: `Captación por ${origen_captacion}${clienteId ? " — cliente encontrado en base" : " — cliente nuevo"}`,
      },
    });

    return op;
  });

  return NextResponse.json({ id: oportunidad.id }, { status: 201 });
}
