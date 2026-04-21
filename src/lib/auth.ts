import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { logAccess } from "./access-log";

function reqFromNextAuth(req: unknown): Request | null {
  if (!req || typeof req !== "object") return null;
  const r = req as { headers?: Record<string, string | string[] | undefined> };
  if (!r.headers) return null;
  const h = new Headers();
  for (const [k, v] of Object.entries(r.headers)) {
    if (typeof v === "string") h.set(k, v);
    else if (Array.isArray(v)) h.set(k, v.join(","));
  }
  return new Request("http://internal", { headers: h });
}

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        const reqObj = reqFromNextAuth(req);
        if (!credentials?.username || !credentials?.password) {
          logAccess({ accion: "login_fallido", metadata: { motivo: "faltan_credenciales", username: credentials?.username ?? null }, req: reqObj });
          throw new Error("Usuario y contraseña son requeridos");
        }

        const user = await prisma.usuarios.findUnique({
          where: { username: credentials.username },
        });

        if (!user) {
          logAccess({ accion: "login_fallido", username: credentials.username, metadata: { motivo: "usuario_no_existe" }, req: reqObj });
          throw new Error("Credenciales inválidas");
        }

        if (!user.activo) {
          logAccess({ accion: "login_fallido", usuario_id: user.id, username: user.username, rol: user.rol, metadata: { motivo: "inactivo" }, req: reqObj });
          throw new Error("Credenciales inválidas");
        }

        // Verificar bloqueo temporal
        if (user.bloqueado_hasta && user.bloqueado_hasta > new Date()) {
          logAccess({ accion: "login_fallido", usuario_id: user.id, username: user.username, rol: user.rol, metadata: { motivo: "bloqueado" }, req: reqObj });
          throw new Error("Cuenta bloqueada temporalmente");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isValid) {
          // Incrementar intentos fallidos
          const nuevosIntentos = user.intentos_fallidos + 1;
          const bloqueado =
            nuevosIntentos >= MAX_INTENTOS
              ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000)
              : null;

          await prisma.usuarios.update({
            where: { id: user.id },
            data: {
              intentos_fallidos: nuevosIntentos,
              bloqueado_hasta: bloqueado,
            },
          });

          logAccess({ accion: "login_fallido", usuario_id: user.id, username: user.username, rol: user.rol, metadata: { motivo: "password_incorrecto", intentos: nuevosIntentos, bloqueado: !!bloqueado }, req: reqObj });

          if (bloqueado) {
            throw new Error("Cuenta bloqueada temporalmente");
          }

          throw new Error("Credenciales inválidas");
        }

        // Login exitoso: resetear contadores
        await prisma.usuarios.update({
          where: { id: user.id },
          data: {
            intentos_fallidos: 0,
            bloqueado_hasta: null,
          },
        });

        logAccess({ accion: "login", usuario_id: user.id, username: user.username, rol: user.rol, req: reqObj });

        return {
          id: String(user.id),
          email: user.username,
          name: user.nombre,
          nombre: user.nombre,
          rol: user.rol,
          debe_cambiar_password: user.debe_cambiar_password,
          region_id: user.region_id,
          sucursal_id: user.sucursal_id,
          permisos_calificacion: user.permisos_calificacion,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.rol = (user as { rol: string }).rol;
        token.nombre = (user as { nombre: string }).nombre;
        token.debe_cambiar_password = (user as { debe_cambiar_password: boolean }).debe_cambiar_password;
        token.region_id = (user as { region_id?: number | null }).region_id ?? null;
        token.sucursal_id = (user as { sucursal_id?: number | null }).sucursal_id ?? null;
        token.permisos_calificacion = (user as { permisos_calificacion?: string[] }).permisos_calificacion ?? [];
        token.lastRefresh = Date.now();
      } else if (token.id) {
        // Refrescar debe_cambiar_password cada 5 minutos o inmediatamente si update() fue llamado
        const lastRefresh = (token.lastRefresh as number) || 0;
        const forceRefresh = trigger === "update";
        if (forceRefresh || Date.now() - lastRefresh > 5 * 60 * 1000) {
          try {
            const dbUser = await prisma.usuarios.findUnique({
              where: { id: parseInt(token.id as string) },
              select: { debe_cambiar_password: true, region_id: true, sucursal_id: true, rol: true, activo: true, bloqueado_hasta: true, permisos_calificacion: true },
            });
            if (!dbUser || !dbUser.activo || (dbUser.bloqueado_hasta && dbUser.bloqueado_hasta > new Date())) {
              // Usuario desactivado o bloqueado: invalidar sesión
              return { ...token, invalidated: true };
            }
            if (dbUser) {
              token.debe_cambiar_password = dbUser.debe_cambiar_password;
              token.region_id = dbUser.region_id ?? null;
              token.sucursal_id = dbUser.sucursal_id ?? null;
              token.rol = dbUser.rol;
              token.permisos_calificacion = dbUser.permisos_calificacion ?? [];
            }
            token.lastRefresh = Date.now();
          } catch {
            // Si falla la BD, mantener el valor actual del token
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.invalidated) {
        // Sesión invalidada: forzar cierre — devolver sesión vacía
        return { ...session, user: { id: "", email: "", name: "", rol: "", nombre: "" }, expires: new Date(0).toISOString() };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as string;
        session.user.nombre = token.nombre as string;
        session.user.debe_cambiar_password = token.debe_cambiar_password as boolean;
        session.user.region_id = token.region_id as number | null | undefined;
        session.user.sucursal_id = token.sucursal_id as number | null | undefined;
        session.user.permisos_calificacion = (token.permisos_calificacion as string[]) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  // Redirect after sign in based on role
  // comercial/direccion → /asistente (handled via middleware)
};
