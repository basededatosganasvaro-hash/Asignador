import { PrismaClient } from "@/generated/prisma-capacidades";

const globalForPrismaCapacidades = globalThis as unknown as {
  prismaCapacidades: PrismaClient | undefined;
};

export const prismaCapacidades =
  globalForPrismaCapacidades.prismaCapacidades ?? new PrismaClient();

if (process.env.NODE_ENV !== "production")
  globalForPrismaCapacidades.prismaCapacidades = prismaCapacidades;
