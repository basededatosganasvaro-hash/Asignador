import { NextResponse } from "next/server";
import { prismaClientes } from "@/lib/prisma-clientes";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const convenios = await prismaClientes.catalogo_convenios.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, tipo_cliente: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(convenios);
}
