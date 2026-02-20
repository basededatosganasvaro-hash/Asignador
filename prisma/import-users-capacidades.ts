/**
 * Script de importación: crea usuarios y equipos del sistema a partir de BD Capacidades.
 *
 * Lógica:
 * 1. Lee todos los users de BD Capacidades con role agente o supervisor
 * 2. Crea equipos únicos a partir del campo users.equipo (sin sucursal)
 * 3. Verifica cuáles usuarios ya existen en BD Sistema (por telegram_id)
 * 4. Solo CREA los que no existen — NO elimina usuarios/equipos existentes
 * 5. Asigna equipo_id al usuario si hay match por nombre
 * 6. Username generado, password = username, debe_cambiar_password = true
 *
 * Ejecutar: npx tsx prisma/import-users-capacidades.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaCapacidades } from "../src/generated/prisma-capacidades";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const prismaCapacidades = new PrismaCapacidades();

function generarUsername(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s.-]/g, "") // solo alfanumérico
    .trim()
    .replace(/\s+/g, ".") // espacios → puntos
    .substring(0, 45); // max 45 para dejar espacio a sufijo
}

async function main() {
  console.log("=== Importación de usuarios desde BD Capacidades ===\n");

  // 1. Leer usuarios de BD Capacidades (agentes y supervisores)
  const usersCapacidades = await prismaCapacidades.users.findMany({
    where: {
      role: { in: ["agente", "supervisor"] },
    },
    orderBy: { created_at: "asc" },
  });

  console.log(`Encontrados en BD Capacidades: ${usersCapacidades.length} usuarios`);
  const agentes = usersCapacidades.filter((u) => u.role === "agente");
  const supervisores = usersCapacidades.filter((u) => u.role === "supervisor");
  console.log(`  - Agentes: ${agentes.length}`);
  console.log(`  - Supervisores: ${supervisores.length}\n`);

  // 2. Crear equipos únicos desde BD Capacidades
  const nombresEquiposCap = new Set<string>();
  for (const u of usersCapacidades) {
    if (u.equipo?.trim()) {
      nombresEquiposCap.add(u.equipo.trim());
    }
  }
  console.log(`Equipos únicos en BD Capacidades: ${nombresEquiposCap.size}`);

  // Cargar equipos existentes en BD Sistema
  const equiposExistentes = await prisma.equipos.findMany({
    select: { id: true, nombre: true },
  });
  const equipoMap = new Map<string, number>();
  for (const eq of equiposExistentes) {
    equipoMap.set(eq.nombre.toLowerCase().trim(), eq.id);
  }

  // Crear equipos que no existen
  let equiposCreados = 0;
  for (const nombreEquipo of nombresEquiposCap) {
    const key = nombreEquipo.toLowerCase().trim();
    if (!equipoMap.has(key)) {
      const nuevo = await prisma.equipos.create({
        data: { nombre: nombreEquipo },
      });
      equipoMap.set(key, nuevo.id);
      equiposCreados++;
    }
  }
  console.log(`Equipos creados: ${equiposCreados}`);
  console.log(`Equipos ya existían: ${nombresEquiposCap.size - equiposCreados}\n`);

  // 3. Cargar todos los usuarios existentes para evitar duplicados
  const existentes = await prisma.usuarios.findMany({
    select: { username: true, email: true, telegram_id: true },
  });

  const usados = new Set<string>();
  const usadosEmail = new Set<string>();
  const telegramIdsExistentes = new Set<bigint>();

  for (const u of existentes) {
    usados.add(u.username);
    usadosEmail.add(u.email);
    if (u.telegram_id !== null) {
      telegramIdsExistentes.add(u.telegram_id);
    }
  }

  console.log(`Usuarios existentes en BD Sistema: ${existentes.length}`);
  console.log(`  - Con telegram_id: ${telegramIdsExistentes.size}\n`);

  // 4. Crear solo los usuarios que no existen
  let creados = 0;
  let yaExistian = 0;
  let sinNombre = 0;
  let conEquipo = 0;

  for (const user of usersCapacidades) {
    // Verificar si ya existe por telegram_id
    if (telegramIdsExistentes.has(user.user_id)) {
      yaExistian++;
      continue;
    }

    const nombre = user.nombre?.trim();
    if (!nombre) {
      sinNombre++;
      console.log(`  SKIP: user_id=${user.user_id} sin nombre (username TG: ${user.username || "N/A"})`);
      continue;
    }

    // Generar username único
    let base = generarUsername(nombre);
    if (!base || base.length < 4) {
      base = `user${user.user_id}`;
    }
    let username = base;
    let suffix = 2;
    while (usados.has(username)) {
      username = `${base}${suffix}`;
      suffix++;
    }
    usados.add(username);

    // Email placeholder único
    let email = `${username}@sistema.local`;
    let emailSuffix = 2;
    while (usadosEmail.has(email)) {
      email = `${username}${emailSuffix}@sistema.local`;
      emailSuffix++;
    }
    usadosEmail.add(email);

    // Rol mapeado
    const rol = user.role === "supervisor" ? "supervisor" : "promotor";

    // Match equipo por nombre
    let equipo_id: number | null = null;
    if (user.equipo?.trim()) {
      const key = user.equipo.trim().toLowerCase();
      equipo_id = equipoMap.get(key) ?? null;
      if (equipo_id) conEquipo++;
    }

    // Password = username (bcrypt)
    const password_hash = await bcrypt.hash(username, 10);

    await prisma.usuarios.create({
      data: {
        nombre,
        username,
        email,
        password_hash,
        rol,
        telegram_id: user.user_id,
        equipo_id,
        debe_cambiar_password: true,
        activo: true,
      },
    });

    creados++;
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Equipos creados: ${equiposCreados}`);
  console.log(`Usuarios creados: ${creados} (${conEquipo} con equipo asignado)`);
  console.log(`Ya existían (por telegram_id): ${yaExistian}`);
  console.log(`Omitidos (sin nombre): ${sinNombre}`);
  console.log(`Total en sistema: ${existentes.length + creados}`);
  console.log(`\nImportación completada.`);
}

main()
  .catch((e) => {
    console.error("Error en importación:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaCapacidades.$disconnect();
  });
