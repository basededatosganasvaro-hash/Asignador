import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ROLES_ADMIN_AREA = ["admin", "gerente_regional", "gerente_sucursal", "supervisor"];
const ROLES_PROMOTOR_AREA = ["promotor"];

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

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

  // Area admin: acceso para roles de gestion
  if (pathname.startsWith("/admin") && !ROLES_ADMIN_AREA.includes(rol)) {
    return NextResponse.redirect(new URL("/promotor", request.url));
  }

  // Area promotor: acceso solo para promotores
  if (pathname.startsWith("/promotor") && !ROLES_PROMOTOR_AREA.includes(rol)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/promotor/:path*",
    "/api/admin/:path*",
    "/api/asignaciones/:path*",
    "/api/clientes/:path*",
    "/api/organizacion/:path*",
    "/api/oportunidades/:path*",
    "/api/captaciones/:path*",
    "/api/embudo/:path*",
    "/api/promotor/:path*",
    "/api/whatsapp/:path*",
    "/api/sistema/:path*",
  ],
};
