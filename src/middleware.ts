import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Si no hay token, redirigir a login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar acceso por rol
  if (pathname.startsWith("/admin") && token.rol !== "admin") {
    return NextResponse.redirect(new URL("/promotor", request.url));
  }

  if (pathname.startsWith("/promotor") && token.rol !== "promotor") {
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
  ],
};
