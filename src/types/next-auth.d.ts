import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    rol: string;
    nombre: string;
    debe_cambiar_password?: boolean;
    region_id?: number | null;
    sucursal_id?: number | null;
    permisos_calificacion?: string[];
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      rol: string;
      nombre: string;
      debe_cambiar_password?: boolean;
      region_id?: number | null;
      sucursal_id?: number | null;
      permisos_calificacion?: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: string;
    nombre: string;
    debe_cambiar_password?: boolean;
    region_id?: number | null;
    sucursal_id?: number | null;
    permisos_calificacion?: string[];
  }
}
