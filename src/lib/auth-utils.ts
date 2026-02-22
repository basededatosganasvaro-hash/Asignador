import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export async function getSessionOrError() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await getSessionOrError();
  if (error) return { session: null, error };
  if (session!.user.rol !== "admin") {
    return { session: null, error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session: session!, error: null };
}

export async function requireSupervisorOrAdmin() {
  const { session, error } = await getSessionOrError();
  if (error) return { session: null, error };
  const rol = session!.user.rol;
  if (rol !== "admin" && rol !== "supervisor") {
    return { session: null, error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session: session!, error: null };
}

export async function requireGestion() {
  // Roles que pueden gestionar: admin, gerente_regional, gerente_sucursal, supervisor
  const { session, error } = await getSessionOrError();
  if (error) return { session: null, error };
  const rol = session!.user.rol;
  const rolesGestion = ["admin", "gerente_regional", "gerente_sucursal", "supervisor"];
  if (!rolesGestion.includes(rol)) {
    return { session: null, error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session: session!, error: null };
}

export async function requirePromotor() {
  const { session, error } = await getSessionOrError();
  if (error) return { session: null, error };
  if (session!.user.rol !== "promotor") {
    return { session: null, error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session: session!, error: null };
}

export async function requireGestorOperaciones() {
  const { session, error } = await getSessionOrError();
  if (error) return { session: null, error };
  if (session!.user.rol !== "gestor_operaciones") {
    return { session: null, error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session: session!, error: null };
}

export async function requireAsistente() {
  // Permite: admin, gerente_regional, gerente_sucursal, supervisor, comercial, direccion
  const { session, error } = await getSessionOrError();
  if (error) return { session: null, error };
  const rol = session!.user.rol;
  const rolesAsistente = ["admin", "gerente_regional", "gerente_sucursal", "supervisor", "comercial", "direccion"];
  if (!rolesAsistente.includes(rol)) {
    return { session: null, error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session: session!, error: null };
}

export async function requireAuth() {
  const { session, error } = await getSessionOrError();
  if (error) return { session: null, error };
  return { session: session!, error: null };
}
