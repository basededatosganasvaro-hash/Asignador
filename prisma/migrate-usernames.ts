/**
 * Script de migración: genera usernames para usuarios existentes.
 * Ejecutar ANTES de prisma db push.
 *
 * Uso: npx tsx prisma/migrate-usernames.ts
 *
 * Lógica:
 * - Agrega la columna username como nullable primero
 * - Genera usernames basados en nombre (ej: "Juan Pérez" → "juan.perez")
 * - Si hay duplicado, agrega sufijo numérico (juan.perez2)
 * - Luego hace la columna NOT NULL y UNIQUE
 * - También agrega los campos de bloqueo con defaults
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  console.log("Verificando si la columna username ya existe...");

  // Verificar si la columna ya existe
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'username'
  `;

  if (columns.length > 0) {
    console.log("La columna username ya existe. Verificando usuarios sin username...");
  } else {
    console.log("Agregando columna username (nullable)...");
    await prisma.$executeRawUnsafe(`ALTER TABLE usuarios ADD COLUMN username VARCHAR(50)`);
  }

  // Obtener usuarios sin username
  const usuarios = await prisma.$queryRaw<{ id: number; nombre: string }[]>`
    SELECT id, nombre FROM usuarios WHERE username IS NULL OR username = ''
  `;

  if (usuarios.length === 0) {
    console.log("Todos los usuarios ya tienen username.");
  } else {
    console.log(`${usuarios.length} usuarios necesitan username...`);

    const usados = new Set<string>();

    // Cargar usernames existentes
    const existentes = await prisma.$queryRaw<{ username: string }[]>`
      SELECT username FROM usuarios WHERE username IS NOT NULL AND username != ''
    `;
    for (const e of existentes) usados.add(e.username);

    for (const user of usuarios) {
      let base = generarUsername(user.nombre);
      if (!base || base.length < 4) {
        base = `user${user.id}`;
      }

      let username = base;
      let suffix = 2;
      while (usados.has(username)) {
        username = `${base}${suffix}`;
        suffix++;
      }

      usados.add(username);
      await prisma.$executeRawUnsafe(
        `UPDATE usuarios SET username = $1 WHERE id = $2`,
        username,
        user.id
      );
      console.log(`  ${user.nombre} → ${username}`);
    }
  }

  // Verificar si ya tiene constraint NOT NULL
  const colInfo = await prisma.$queryRaw<{ is_nullable: string }[]>`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'username'
  `;

  if (colInfo[0]?.is_nullable === "YES") {
    console.log("Aplicando NOT NULL a username...");
    await prisma.$executeRawUnsafe(`ALTER TABLE usuarios ALTER COLUMN username SET NOT NULL`);
  }

  // Verificar si ya tiene unique constraint
  const uniqueCheck = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM pg_indexes
    WHERE tablename = 'usuarios' AND indexdef LIKE '%username%' AND indexdef LIKE '%UNIQUE%'
  `;

  if (Number(uniqueCheck[0]?.count ?? 0) === 0) {
    console.log("Creando índice UNIQUE en username...");
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_key ON usuarios(username)`);
  }

  // Agregar campos de bloqueo si no existen
  const addColumnIfNotExists = async (col: string, type: string, defaultVal?: string) => {
    const exists = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'usuarios' AND column_name = ${col}
    `;
    if (exists.length === 0) {
      const def = defaultVal ? ` DEFAULT ${defaultVal}` : "";
      await prisma.$executeRawUnsafe(`ALTER TABLE usuarios ADD COLUMN ${col} ${type}${def}`);
      console.log(`  Columna ${col} agregada`);
    }
  };

  await addColumnIfNotExists("intentos_fallidos", "INT", "0");
  await addColumnIfNotExists("bloqueado_hasta", "TIMESTAMP");
  await addColumnIfNotExists("debe_cambiar_password", "BOOLEAN", "false");

  // Crear tabla cupo_diario si no existe
  const tablaCupo = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'cupo_diario' AND table_schema = 'public'
  `;
  if (tablaCupo.length === 0) {
    console.log("Creando tabla cupo_diario...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE cupo_diario (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES usuarios(id),
        fecha DATE NOT NULL,
        registros_usados INT DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE(usuario_id, fecha)
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_cupo_diario_usuario_fecha ON cupo_diario(usuario_id, fecha)`);
    console.log("  Tabla cupo_diario creada");
  } else {
    console.log("Tabla cupo_diario ya existe.");
  }

  console.log("\nMigración completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
