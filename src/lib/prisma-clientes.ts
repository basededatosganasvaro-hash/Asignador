import { PrismaClient } from "@/generated/prisma-clientes";

const globalForPrismaClientes = globalThis as unknown as {
  prismaClientes: PrismaClient | undefined;
};

export const prismaClientes =
  globalForPrismaClientes.prismaClientes ?? new PrismaClient();

if (process.env.NODE_ENV !== "production")
  globalForPrismaClientes.prismaClientes = prismaClientes;
