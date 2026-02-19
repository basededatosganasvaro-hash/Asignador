import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    rol: string;
    nombre: string;
    debe_cambiar_password?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      rol: string;
      nombre: string;
      debe_cambiar_password?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: string;
    nombre: string;
    debe_cambiar_password?: boolean;
  }
}
