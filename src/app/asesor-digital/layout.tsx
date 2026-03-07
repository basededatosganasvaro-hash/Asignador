import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LayoutShell from "@/components/layout/LayoutShell";

export default async function AsesorDigitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.rol !== "asesor_digital") {
    redirect("/login");
  }

  return (
    <LayoutShell rol="asesor_digital">
      {children}
    </LayoutShell>
  );
}
