import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Crear usuario admin por defecto
  const adminExists = await prisma.usuarios.findUnique({
    where: { email: "admin@sistema.com" },
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await prisma.usuarios.create({
      data: {
        nombre: "Administrador",
        email: "admin@sistema.com",
        password_hash: hashedPassword,
        rol: "admin",
        activo: true,
      },
    });
    console.log("Usuario admin creado: admin@sistema.com / admin123");
  } else {
    console.log("Usuario admin ya existe");
  }

  // Configuracion por defecto
  await prisma.configuracion.upsert({
    where: { clave: "max_registros_por_dia" },
    update: {},
    create: {
      clave: "max_registros_por_dia",
      valor: "300",
    },
  });
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
