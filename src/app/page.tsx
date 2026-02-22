import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.rol === "comercial" || session.user.rol === "direccion") {
    redirect("/asistente");
  }

  if (session.user.rol === "gestor_operaciones") {
    redirect("/operaciones");
  }

  if (session.user.rol === "promotor") {
    redirect("/promotor");
  }

  redirect("/admin");
}
