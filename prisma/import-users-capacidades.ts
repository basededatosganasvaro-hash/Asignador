/**
 * Script de importación: crea usuarios y equipos del sistema a partir de BD Capacidades.
 *
 * Lógica:
 * 1. Lee equipos de BD Capacidades (tabla equipos) y crea en BD Sistema los que no existan
 * 2. Lee usuarios_equipos → asigna equipo_id a agentes
 * 3. Lee supervisor_equipos → asigna supervisor_id en equipos de BD Sistema
 * 4. Crea usuarios nuevos (por telegram_id) con username generado
 * 5. Actualiza equipo_id de usuarios existentes si no tienen equipo asignado
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

  // ============================================
  // 1. EQUIPOS: leer de BD Capacidades y crear en BD Sistema
  // ============================================
  const equiposCapacidades = await prismaCapacidades.equipos.findMany();
  console.log(`Equipos en BD Capacidades: ${equiposCapacidades.length}`);

  // Cargar equipos existentes en BD Sistema
  const equiposExistentes = await prisma.equipos.findMany({
    select: { id: true, nombre: true },
  });
  const equipoMap = new Map<string, number>(); // key lowercase → id en BD Sistema
  for (const eq of equiposExistentes) {
    equipoMap.set(eq.nombre.toLowerCase().trim(), eq.id);
  }

  let equiposCreados = 0;
  for (const eqCap of equiposCapacidades) {
    const key = eqCap.nombre.toLowerCase().trim();
    if (!equipoMap.has(key)) {
      const nuevo = await prisma.equipos.create({
        data: { nombre: eqCap.nombre.trim() },
      });
      equipoMap.set(key, nuevo.id);
      equiposCreados++;
    }
  }
  console.log(`Equipos creados: ${equiposCreados}`);
  console.log(`Equipos ya existían: ${equiposCapacidades.length - equiposCreados}\n`);

  // ============================================
  // 2. RELACIONES EQUIPO: leer usuarios_equipos y supervisor_equipos
  // ============================================
  const usuariosEquipos = await prismaCapacidades.usuarios_equipos.findMany();
  const supervisorEquipos = await prismaCapacidades.supervisor_equipos.findMany();
  console.log(`Relaciones agente↔equipo en BD Capacidades: ${usuariosEquipos.length}`);
  console.log(`Relaciones supervisor↔equipo en BD Capacidades: ${supervisorEquipos.length}\n`);

  // Mapas: telegram_id → equipo_nombre (tomamos el primero si hay varios)
  const agenteEquipoMap = new Map<bigint, string>();
  for (const ue of usuariosEquipos) {
    if (!agenteEquipoMap.has(ue.agente_telegram_id)) {
      agenteEquipoMap.set(ue.agente_telegram_id, ue.equipo_nombre);
    }
  }

  const supervisorEquipoMap = new Map<bigint, string>();
  for (const se of supervisorEquipos) {
    if (!supervisorEquipoMap.has(se.supervisor_telegram_id)) {
      supervisorEquipoMap.set(se.supervisor_telegram_id, se.equipo_nombre);
    }
  }

  // ============================================
  // 3. USUARIOS: leer de BD Capacidades
  // ============================================
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

  // ============================================
  // 4. Cargar usuarios existentes para evitar duplicados
  // ============================================
  const existentes = await prisma.usuarios.findMany({
    select: { id: true, username: true, email: true, telegram_id: true, equipo_id: true },
  });

  const usados = new Set<string>();
  const usadosEmail = new Set<string>();
  const telegramIdToUsuario = new Map<bigint, { id: number; equipo_id: number | null }>();

  for (const u of existentes) {
    usados.add(u.username);
    usadosEmail.add(u.email);
    if (u.telegram_id !== null) {
      telegramIdToUsuario.set(u.telegram_id, { id: u.id, equipo_id: u.equipo_id });
    }
  }

  console.log(`Usuarios existentes en BD Sistema: ${existentes.length}`);
  console.log(`  - Con telegram_id: ${telegramIdToUsuario.size}\n`);

  // ============================================
  // 5. Crear usuarios nuevos + actualizar equipo de existentes
  // ============================================
  let creados = 0;
  let yaExistian = 0;
  let sinNombre = 0;
  let conEquipo = 0;
  let equipoActualizado = 0;

  for (const user of usersCapacidades) {
    // Resolver equipo para este usuario
    const equipoNombre =
      user.role === "supervisor"
        ? supervisorEquipoMap.get(user.user_id)
        : agenteEquipoMap.get(user.user_id);

    let equipo_id: number | null = null;
    if (equipoNombre) {
      equipo_id = equipoMap.get(equipoNombre.toLowerCase().trim()) ?? null;
    }

    // Verificar si ya existe por telegram_id
    const existente = telegramIdToUsuario.get(user.user_id);
    if (existente) {
      yaExistian++;
      // Actualizar equipo_id si no tiene y encontramos match
      if (equipo_id && !existente.equipo_id) {
        await prisma.usuarios.update({
          where: { id: existente.id },
          data: { equipo_id },
        });
        equipoActualizado++;
      }
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

    if (equipo_id) conEquipo++;

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

  // ============================================
  // 6. Asignar supervisor_id en equipos de BD Sistema
  // ============================================
  let supervisoresAsignados = 0;
  for (const [supervisorTelegramId, equipoNombre] of supervisorEquipoMap) {
    const equipoIdSistema = equipoMap.get(equipoNombre.toLowerCase().trim());
    if (!equipoIdSistema) continue;

    // Buscar supervisor en BD Sistema por telegram_id
    const supervisor = await prisma.usuarios.findUnique({
      where: { telegram_id: supervisorTelegramId },
      select: { id: true },
    });
    if (!supervisor) continue;

    // Actualizar equipo con supervisor_id
    await prisma.equipos.update({
      where: { id: equipoIdSistema },
      data: { supervisor_id: supervisor.id },
    });
    supervisoresAsignados++;
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Equipos creados: ${equiposCreados}`);
  console.log(`Supervisores asignados a equipos: ${supervisoresAsignados}`);
  console.log(`Usuarios creados: ${creados} (${conEquipo} con equipo asignado)`);
  console.log(`Ya existían (por telegram_id): ${yaExistian} (${equipoActualizado} con equipo actualizado)`);
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
