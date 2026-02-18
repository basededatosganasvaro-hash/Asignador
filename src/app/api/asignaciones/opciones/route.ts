import { NextResponse } from "next/server";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");

  const [tiposRaw, conveniosRaw, estadosRaw, municipiosRaw] = await Promise.all([
    prismaClientes.clientes.findMany({
      select: { tipo_cliente: true },
      distinct: ["tipo_cliente"],
      orderBy: { tipo_cliente: "asc" },
    }),
    prismaClientes.clientes.findMany({
      select: { convenio: true },
      distinct: ["convenio"],
      orderBy: { convenio: "asc" },
    }),
    prismaClientes.clientes.findMany({
      select: { estado: true },
      distinct: ["estado"],
      orderBy: { estado: "asc" },
    }),
    estado
      ? prismaClientes.clientes.findMany({
          select: { municipio: true },
          distinct: ["municipio"],
          where: { estado },
          orderBy: { municipio: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    tiposCliente: tiposRaw.map((r) => r.tipo_cliente).filter(Boolean),
    convenios: conveniosRaw.map((r) => r.convenio).filter(Boolean),
    estados: estadosRaw.map((r) => r.estado).filter(Boolean),
    municipios: municipiosRaw.map((r) => (r as { municipio?: string | null }).municipio).filter(Boolean),
  });
}
