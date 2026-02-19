import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Crear usuario admin por defecto
  const adminExists = await prisma.usuarios.findFirst({
    where: { OR: [{ email: "admin@sistema.com" }, { username: "admin" }] },
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await prisma.usuarios.create({
      data: {
        nombre: "Administrador",
        username: "admin",
        email: "admin@sistema.com",
        password_hash: hashedPassword,
        rol: "admin",
        activo: true,
      },
    });
    console.log("Usuario admin creado: username=admin / password=admin123");
  } else {
    // Asegurar que tenga username si fue creado antes del cambio
    if (!adminExists.username) {
      await prisma.usuarios.update({
        where: { id: adminExists.id },
        data: { username: "admin" },
      });
      console.log("Username 'admin' asignado al admin existente");
    } else {
      console.log("Usuario admin ya existe");
    }
  }

  // Configuracion por defecto
  const configDefaults = [
    { clave: "max_registros_por_dia", valor: "300" },
    { clave: "horario_inicio", valor: "08:55" },
    { clave: "horario_fin", valor: "19:15" },
    { clave: "dias_operativos", valor: "1,2,3,4,5" },
    { clave: "cooldown_meses", valor: "3" },
  ];

  for (const cfg of configDefaults) {
    await prisma.configuracion.upsert({
      where: { clave: cfg.clave },
      update: {},
      create: cfg,
    });
  }
  console.log("Configuracion por defecto establecida");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
