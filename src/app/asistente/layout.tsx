import { redirect } from "next/navigation";

// Asistente IA deshabilitado — redirigir a inicio
export default async function AsistenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  redirect("/");
}
