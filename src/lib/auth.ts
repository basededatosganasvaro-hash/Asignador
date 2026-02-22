import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

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
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Usuario y contraseña son requeridos");
        }

        const user = await prisma.usuarios.findUnique({
          where: { username: credentials.username },
        });

        if (!user) {
          throw new Error("Credenciales inválidas");
        }

        if (!user.activo) {
          throw new Error("Credenciales inválidas");
        }

        // Verificar bloqueo temporal
        if (user.bloqueado_hasta && user.bloqueado_hasta > new Date()) {
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

        return {
          id: String(user.id),
          email: user.username,
          name: user.nombre,
          nombre: user.nombre,
          rol: user.rol,
          debe_cambiar_password: user.debe_cambiar_password,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = (user as { rol: string }).rol;
        token.nombre = (user as { nombre: string }).nombre;
        token.debe_cambiar_password = (user as { debe_cambiar_password: boolean }).debe_cambiar_password;
      } else if (token.id) {
        // Refrescar debe_cambiar_password desde BD en cada request
        const dbUser = await prisma.usuarios.findUnique({
          where: { id: parseInt(token.id as string) },
          select: { debe_cambiar_password: true },
        });
        if (dbUser) {
          token.debe_cambiar_password = dbUser.debe_cambiar_password;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as string;
        session.user.nombre = token.nombre as string;
        session.user.debe_cambiar_password = token.debe_cambiar_password as boolean;
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
