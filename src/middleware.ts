import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ROLES_ADMIN_AREA = ["admin", "gerente_regional", "gerente_sucursal", "supervisor"];
const ROLES_PROMOTOR_AREA = ["promotor"];
const ROLES_OPERACIONES_AREA = ["gestor_operaciones"];

// Rate limiting por IP para login (credential stuffing protection)
const loginAttempts = new Map<string, number[]>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_MAX_PER_IP = 20;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting por IP en login — antes de cualquier otra lógica
  if (pathname === "/api/auth/callback/credentials" && request.method === "POST") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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

  // Area operaciones: acceso solo para gestor_operaciones
  if (pathname.startsWith("/operaciones") && !ROLES_OPERACIONES_AREA.includes(rol)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Area admin: acceso para roles de gestion
  if (pathname.startsWith("/admin") && !ROLES_ADMIN_AREA.includes(rol)) {
    if (ROLES_OPERACIONES_AREA.includes(rol)) {
      return NextResponse.redirect(new URL("/operaciones", request.url));
    }
    return NextResponse.redirect(new URL("/promotor", request.url));
  }

  // Area promotor: acceso solo para promotores
  if (pathname.startsWith("/promotor") && !ROLES_PROMOTOR_AREA.includes(rol)) {
    if (ROLES_OPERACIONES_AREA.includes(rol)) {
      return NextResponse.redirect(new URL("/operaciones", request.url));
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/promotor/:path*",
    "/operaciones/:path*",
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
  ],
};
