import { NextResponse } from "next/server";
import { requireGerente } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";

export async function GET() {
  const { session, error, scopeFilter } = await requireGerente();
  if (error) return error;

  // Filtrar pool por región del gerente
  const wherePool: Record<string, unknown> = {
    asignado: false,
    expira_at: { gt: new Date() },
  };

  // Resolver region_id para ambos tipos de gerente
  let regionId: number | null = null;
  if (scopeFilter?.field === "region_id") {
    regionId = scopeFilter.value ?? null;
  } else {
    // gerente_sucursal: obtener region_id desde la BD
    const usuario = await prisma.usuarios.findUnique({
      where: { id: Number(session.user.id) },
      select: { region_id: true },
    });
    regionId = usuario?.region_id ?? null;
  }

  if (regionId) {
    wherePool.region_id = regionId;
  }

  const poolItems = await prisma.pool_gerente.findMany({
    where: wherePool,
    orderBy: { created_at: "desc" },
    take: 500,
  });

  if (poolItems.length === 0) {
    return NextResponse.json({ items: [], total: 0 });
  }

  // Obtener datos de clientes
  const clienteIds = poolItems.map((p) => p.cliente_id);
  const clientes = await prismaClientes.clientes.findMany({
    where: { id: { in: clienteIds } },
    select: {
      id: true,
      nss: true,
      curp: true,
      nombres: true,
      a_paterno: true,
      a_materno: true,
      tel_1: true,
      capacidad: true,
      percepciones_fijas: true,
      descuentos_terceros: true,
      convenio: true,
      estado: true,
      municipio: true,
      filiacion: true,
    },
  });

  // Datos de contacto editados
  const datosContacto = await prisma.datos_contacto.findMany({
    where: { cliente_id: { in: clienteIds } },
  });

  const clientesMap = new Map(clientes.map((c) => [c.id, { ...c }]));
  for (const dc of datosContacto) {
    const cliente = clientesMap.get(dc.cliente_id);
    if (cliente) {
      (cliente as Record<string, unknown>)[dc.campo] = dc.valor;
    }
  }

  // Nombres de analistas
  const analistaIds = [...new Set(poolItems.map((p) => p.calificado_por))];
  const analistas = await prisma.usuarios.findMany({
    where: { id: { in: analistaIds } },
    select: { id: true, nombre: true },
  });
  const analistaMap = new Map(analistas.map((a) => [a.id, a.nombre]));

  const items = poolItems.map((p) => ({
    id: p.id,
    cliente_id: p.cliente_id,
    calificado_por_nombre: analistaMap.get(p.calificado_por) ?? "Desconocido",
    expira_at: p.expira_at,
    created_at: p.created_at,
    cliente: clientesMap.get(p.cliente_id) || null,
  }));

  return NextResponse.json({ items, total: items.length });
}
