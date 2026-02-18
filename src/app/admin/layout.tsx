import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LayoutShell from "@/components/layout/LayoutShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const rolesGestion = ["admin", "gerente_regional", "gerente_sucursal", "supervisor"];
  if (!session || !rolesGestion.includes(session.user.rol)) {
    redirect("/login");
  }

  return <LayoutShell rol="admin">{children}</LayoutShell>;
}
