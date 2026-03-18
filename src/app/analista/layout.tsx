import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LayoutShell from "@/components/layout/LayoutShell";
import HorarioGuard from "@/components/HorarioGuard";

export default async function AnalistaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.rol !== "analista") {
    redirect("/login");
  }

  return (
    <LayoutShell rol="analista">
      <HorarioGuard>{children}</HorarioGuard>
    </LayoutShell>
  );
}
