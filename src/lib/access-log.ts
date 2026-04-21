import { prisma } from "./prisma";

export type AccionAuditoria =
  | "login"
  | "login_fallido"
  | "logout"
  | "view_cliente"
  | "view_lote"
  | "view_oportunidad"
  | "solicitar_asignacion"
  | "liberar_lote"
  | "calificar_cliente"
  | "export_excel"
  | "editar_cliente"
  | "crear_usuario"
  | "editar_usuario"
  | "eliminar_usuario"
  | "reasignar_cliente"
  | "view_auditoria";

interface LogAccessInput {
  usuario_id?: number | null;
  username?: string | null;
  rol?: string | null;
  accion: AccionAuditoria | string;
  recurso_id?: string | number | bigint | null;
  metadata?: Record<string, unknown> | null;
  req?: Request | null;
}

function extractIp(req: Request | null | undefined): string | null {
  if (!req) return null;
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || null;
}

function extractUserAgent(req: Request | null | undefined): string | null {
  if (!req) return null;
  const ua = req.headers.get("user-agent");
  return ua ? ua.substring(0, 500) : null;
}

/**
 * Fire-and-forget: NO usar await. Registra evento en access_log sin bloquear el response.
 * Errores se loguean pero nunca se propagan.
 */
export function logAccess(input: LogAccessInput): void {
  const {
    usuario_id = null,
    username = null,
    rol = null,
    accion,
    recurso_id = null,
    metadata = null,
    req = null,
  } = input;

  const recurso = recurso_id === null || recurso_id === undefined
    ? null
    : String(recurso_id);

  prisma.access_log
    .create({
      data: {
        usuario_id: usuario_id ?? null,
        username: username ?? null,
        rol: rol ?? null,
        accion,
        recurso_id: recurso,
        metadata: (metadata ?? undefined) as never,
        ip: extractIp(req),
        user_agent: extractUserAgent(req),
      },
    })
    .catch((err) => {
      console.error("[access-log] fallo al registrar evento:", err);
    });
}

/**
 * Variante que acepta sesión de NextAuth directamente.
 */
interface SessionLike {
  user?: {
    id?: string | number;
    email?: string | null;
    username?: string | null;
    rol?: string | null;
  } | null;
}

export function logAccessWithSession(
  session: SessionLike | null | undefined,
  accion: AccionAuditoria | string,
  opts: {
    recurso_id?: string | number | bigint | null;
    metadata?: Record<string, unknown> | null;
    req?: Request | null;
  } = {}
): void {
  const uid = session?.user?.id;
  const usuario_id =
    uid === undefined || uid === null || uid === ""
      ? null
      : typeof uid === "string"
        ? parseInt(uid)
        : uid;

  logAccess({
    usuario_id: Number.isNaN(usuario_id as number) ? null : usuario_id,
    username: session?.user?.username ?? session?.user?.email ?? null,
    rol: session?.user?.rol ?? null,
    accion,
    recurso_id: opts.recurso_id,
    metadata: opts.metadata,
    req: opts.req,
  });
}
