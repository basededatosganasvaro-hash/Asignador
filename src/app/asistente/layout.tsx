import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LayoutShell from "@/components/layout/LayoutShell";

const ROLES_ASISTENTE = ["admin", "gerente_regional", "gerente_sucursal", "supervisor", "comercial", "direccion"];

export default async function AsistenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !ROLES_ASISTENTE.includes(session.user.rol)) {
    redirect("/login");
  }

  // comercial/direccion get minimal sidebar; admin/gerentes get full admin sidebar
  const shellRol = ["comercial", "direccion"].includes(session.user.rol) ? "asistente" : "admin";

  return <LayoutShell rol={shellRol}>{children}</LayoutShell>;
}
