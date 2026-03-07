import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.rol === "gestor_operaciones") {
    redirect("/operaciones");
  }

  if (session.user.rol === "supervisor") {
    redirect("/supervisor");
  }

  if (session.user.rol === "promotor") {
    redirect("/promotor");
  }

  if (session.user.rol === "asesor_digital") {
    redirect("/asesor-digital");
  }

  redirect("/admin");
}
