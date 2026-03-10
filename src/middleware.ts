import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ROLES_ADMIN_AREA = ["admin"];
const ROLES_GERENTE_AREA = ["gerente_regional", "gerente_sucursal"];
const ROLES_SUPERVISOR_AREA = ["supervisor"];
const ROLES_PROMOTOR_AREA = ["promotor"];
const ROLES_OPERACIONES_AREA = ["gestor_operaciones"];
const ROLES_ASESOR_DIGITAL_AREA = ["asesor_digital"];
// Rate limiting por IP para login (credential stuffing protection)
const loginAttempts = new Map<string, number[]>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_MAX_PER_IP = 20;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting por IP en login — antes de cualquier otra lógica
  if (pathname === "/api/auth/callback/credentials" && request.method === "POST") {
    const ip = (request as unknown as { ip?: string }).ip || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
    if (attempts.length >= LOGIN_MAX_PER_IP) {
      return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
    }
    attempts.push(now);
    loginAttempts.set(ip, attempts);
    return NextResponse.next();
  }

  const token = await getToken({ req: request });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rol = token.rol as string;

  // Forzar cambio de contraseña si es obligatorio
  if (token.debe_cambiar_password && !pathname.startsWith("/cambiar-password") && !pathname.startsWith("/api/auth")) {
    return NextResponse.redirect(new URL("/cambiar-password", request.url));
  }

  // Asistente IA deshabilitado — redirigir a inicio
  if (pathname.startsWith("/asistente")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Area asesor digital: acceso solo para asesor_digital
  if ((pathname.startsWith("/asesor-digital") || pathname.startsWith("/api/asesor-digital")) && !ROLES_ASESOR_DIGITAL_AREA.includes(rol)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Area operaciones: acceso solo para gestor_operaciones
  if (pathname.startsWith("/operaciones") && !ROLES_OPERACIONES_AREA.includes(rol)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Area supervisor: acceso solo para supervisores
  if ((pathname.startsWith("/supervisor") || pathname.startsWith("/api/supervisor")) && !ROLES_SUPERVISOR_AREA.includes(rol)) {
    if (ROLES_ADMIN_AREA.includes(rol)) return NextResponse.redirect(new URL("/admin", request.url));
    if (ROLES_GERENTE_AREA.includes(rol)) return NextResponse.redirect(new URL("/gerente", request.url));
    if (ROLES_OPERACIONES_AREA.includes(rol)) return NextResponse.redirect(new URL("/operaciones", request.url));
    if (ROLES_ASESOR_DIGITAL_AREA.includes(rol)) return NextResponse.redirect(new URL("/asesor-digital", request.url));
    return NextResponse.redirect(new URL("/promotor", request.url));
  }

  // Area gerente: acceso solo para gerentes regionales y de sucursal
  if ((pathname.startsWith("/gerente") || pathname.startsWith("/api/gerente")) && !ROLES_GERENTE_AREA.includes(rol)) {
    if (ROLES_ADMIN_AREA.includes(rol)) return NextResponse.redirect(new URL("/admin", request.url));
    if (ROLES_SUPERVISOR_AREA.includes(rol)) return NextResponse.redirect(new URL("/supervisor", request.url));
    if (ROLES_OPERACIONES_AREA.includes(rol)) return NextResponse.redirect(new URL("/operaciones", request.url));
    if (ROLES_ASESOR_DIGITAL_AREA.includes(rol)) return NextResponse.redirect(new URL("/asesor-digital", request.url));
    return NextResponse.redirect(new URL("/promotor", request.url));
  }

  // Area admin: acceso solo para admin
  if (pathname.startsWith("/admin") && !ROLES_ADMIN_AREA.includes(rol)) {
    if (ROLES_GERENTE_AREA.includes(rol)) return NextResponse.redirect(new URL("/gerente", request.url));
    if (ROLES_SUPERVISOR_AREA.includes(rol)) return NextResponse.redirect(new URL("/supervisor", request.url));
    if (ROLES_OPERACIONES_AREA.includes(rol)) return NextResponse.redirect(new URL("/operaciones", request.url));
    if (ROLES_ASESOR_DIGITAL_AREA.includes(rol)) return NextResponse.redirect(new URL("/asesor-digital", request.url));
    return NextResponse.redirect(new URL("/promotor", request.url));
  }

  // Area promotor: acceso solo para promotores
  if (pathname.startsWith("/promotor") && !ROLES_PROMOTOR_AREA.includes(rol)) {
    if (ROLES_ADMIN_AREA.includes(rol)) return NextResponse.redirect(new URL("/admin", request.url));
    if (ROLES_GERENTE_AREA.includes(rol)) return NextResponse.redirect(new URL("/gerente", request.url));
    if (ROLES_SUPERVISOR_AREA.includes(rol)) return NextResponse.redirect(new URL("/supervisor", request.url));
    if (ROLES_OPERACIONES_AREA.includes(rol)) return NextResponse.redirect(new URL("/operaciones", request.url));
    if (ROLES_ASESOR_DIGITAL_AREA.includes(rol)) return NextResponse.redirect(new URL("/asesor-digital", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/gerente/:path*",
    "/supervisor/:path*",
    "/promotor/:path*",
    "/operaciones/:path*",
    "/api/supervisor/:path*",
    "/api/gerente/:path*",
    "/api/admin/:path*",
    "/api/asignaciones/:path*",
    "/api/clientes/:path*",
    "/api/organizacion/:path*",
    "/api/oportunidades/:path*",
    "/api/captaciones/:path*",
    "/api/embudo/:path*",
    "/api/promotor/:path*",
    "/api/operaciones/:path*",
    "/api/whatsapp/:path*",
    "/api/sistema/:path*",
    "/api/auth/callback/:path*",
    "/asistente/:path*",
    "/asesor-digital/:path*",
    "/api/asesor-digital/:path*",
  ],
};
