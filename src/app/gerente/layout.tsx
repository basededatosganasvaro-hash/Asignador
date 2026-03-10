import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LayoutShell from "@/components/layout/LayoutShell";

export default async function GerenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const rolesGerente = ["gerente_regional", "gerente_sucursal"];
  if (!session || !rolesGerente.includes(session.user.rol)) {
    redirect("/login");
  }

  return <LayoutShell rol={session.user.rol}>{children}</LayoutShell>;
}
