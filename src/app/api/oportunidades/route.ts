import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = Number(session!.user.id);

  const oportunidades = await prisma.oportunidades.findMany({
    where: {
      usuario_id: userId,
      activo: true,
      // Excluir oportunidades en etapas de salida (datos legacy pre auto-pool)
      OR: [
        { etapa: { tipo: "AVANCE" } },
        { etapa: { tipo: "FINAL", nombre: "Venta" } },
        { etapa_id: null },
      ],
    },
    include: {
      etapa: { select: { id: true, nombre: true, tipo: true, color: true } },
      captacion: { select: { convenio: true, datos_json: true } },
      venta: { select: { monto: true } },
      wa_mensajes: {
        select: { estado: true, enviado_at: true },
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
    orderBy: [{ timer_vence: "asc" }, { created_at: "asc" }],
  });

  if (oportunidades.length === 0) return NextResponse.json([]);

  // Fetch client fields needed for the table (excludes unnamed_*, fecha_carga, archivo_origen)
  const clienteIds = oportunidades.map((o) => o.cliente_id).filter((id): id is number => id !== null);

  const clienteMap: Record<number, Record<string, unknown>> = {};
  const editMap: Record<number, Record<string, string>> = {};

  if (clienteIds.length > 0) {
    // Parallelize: clientes (BD Clientes) and edits (BD Sistema) are independent
    const [clientes, edits] = await Promise.all([
      prismaClientes.clientes.findMany({
        where: { id: { in: clienteIds } },
        select: {
          id: true,
          tipo_cliente: true,
          // Identificacion
          nss: true, a_paterno: true, a_materno: true, nombres: true, curp: true, rfc: true,
          // Datos personales
          edad: true, genero: true, tipo_pension: true, mes_pension: true, anio_pension: true,
          // Ubicacion
          umf_delegacion: true, calle_num: true, colonia: true, domicilio_pensionados: true,
          region: true, estado: true, municipio: true, cp: true,
          // Contacto
          tel_1: true, tipo_1: true, tel_2: true, tipo_2: true, tel_3: true, tipo_3: true,
          tel_4: true, tipo_4: true, tel_5: true, tipo_5: true, direccion_email: true,
          // Financieras
          creditos_actuales: true, tipo_mercado: true, tipo_cliente_original: true,
          tipo_cliente_csp: true, capacidad: true, plazo_oferta: true, oferta: true,
          cotizador: true, tasa: true, cat: true, financiera: true, plazo: true,
          monto_solicitado: true, descuento_actual: true, plazo_transcurrido: true,
          plazo_restante: true, cat_actual: true, tasa_actual: true,
          // Cartera
          convenio: true, monto_comisionable: true, dependencia: true, estatus: true,
          monto: true, num_empleado: true,
          // Laborales / educativos (nuevos)
          nombre: true, tipo_empleado: true, antiguedad: true, tipo_nomina: true,
          nivel_salarial: true, unidad_adm: true, nomb_unidad_adm: true, puesto: true,
          descuento: true, oferta_neta: true, universo: true,
          clave_cct: true, centro_educativo: true, localidad: true,
          municipio_centro_educativo: true, entidad_centro_educativo: true, cp_centro_educativo: true,
          entidad_personal: true, municipio_personal: true, calle: true, num_ext: true, num_int: true,
          oportunidad_total: true, oportunidad_real: true, id_origen: true,
        },
      }),
      prisma.datos_contacto.findMany({
        where: { cliente_id: { in: clienteIds } },
        orderBy: { created_at: "desc" },
      }),
    ]);

    for (const c of clientes) clienteMap[c.id] = c as unknown as Record<string, unknown>;
    for (const edit of edits) {
      if (!editMap[edit.cliente_id]) editMap[edit.cliente_id] = {};
      if (!editMap[edit.cliente_id][edit.campo]) {
        editMap[edit.cliente_id][edit.campo] = edit.valor;
      }
    }
  }

  const result = oportunidades.map((op) => {
    const ultimoWa = op.wa_mensajes[0] ?? null;
    const waFields = {
      wa_estado: ultimoWa?.estado ?? null,
      wa_enviado_at: ultimoWa?.enviado_at ?? null,
      wa_manual_at: op.wa_manual_at ?? null,
    };

    if (op.cliente_id !== null) {
      const cliente = clienteMap[op.cliente_id] ?? {};
      const edits = editMap[op.cliente_id] ?? {};
      // Merge: edits override original client data
      const { id: _clienteId, ...mergedSinId } = { ...cliente, ...edits };
      return {
        id: op.id,
        cliente_id: op.cliente_id,
        etapa: op.etapa,
        timer_vence: op.timer_vence,
        origen: op.origen,
        num_operacion: op.num_operacion ?? null,
        monto_venta: op.venta?.monto ? Number(op.venta.monto) : null,
        ...waFields,
        created_at: op.created_at,
        // All client fields (flat, sin id para no sobreescribir op.id)
        ...mergedSinId,
        // Ensure key display fields have fallbacks
        nombres: (mergedSinId.nombres as string) ?? "—",
        convenio: (mergedSinId.convenio as string) ?? "—",
        estado: (mergedSinId.estado as string) ?? "—",
        municipio: (mergedSinId.municipio as string) ?? "—",
        tipo_cliente: (mergedSinId.tipo_cliente as string) ?? "—",
        tel_1: (mergedSinId.tel_1 as string) ?? null,
      };
    } else {
      // Cliente captado — datos desde captacion.datos_json
      const datos = (op.captacion?.datos_json ?? {}) as Record<string, string>;
      const nombres = datos.nombres
        ? `${datos.nombres} ${datos.a_paterno ?? ""} ${datos.a_materno ?? ""}`.trim()
        : `${datos.a_paterno ?? ""} ${datos.a_materno ?? ""}`.trim() || "Sin nombre";
      return {
        id: op.id,
        cliente_id: null,
        etapa: op.etapa,
        timer_vence: op.timer_vence,
        origen: op.origen,
        num_operacion: op.num_operacion ?? null,
        monto_venta: op.venta?.monto ? Number(op.venta.monto) : null,
        ...waFields,
        created_at: op.created_at,
        ...datos,
        nombres,
        convenio: op.captacion?.convenio ?? "—",
        estado: datos.estado ?? "—",
        municipio: datos.municipio ?? "—",
        tipo_cliente: op.origen === "CAPACIDADES" ? "Capacidad IMSS" : "Captado",
        tel_1: datos.tel_1 ?? null,
      };
    }
  });

  return NextResponse.json(result);
}
