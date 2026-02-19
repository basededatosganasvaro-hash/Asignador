import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  ConnectionState,
  AuthenticationState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { encrypt, decrypt } from "./crypto.js";

const logger = pino({ level: "warn" });

interface SessionInfo {
  socket: WASocket;
  idleTimer: NodeJS.Timeout | null;
  qrCode: string | null;
}

class SessionManager {
  private sessions: Map<number, SessionInfo> = new Map();

  /** Obtener socket activo de un usuario */
  getSocket(userId: number): WASocket | undefined {
    return this.sessions.get(userId)?.socket;
  }

  /** Verificar si un usuario tiene sesión conectada */
  isConnected(userId: number): boolean {
    const session = this.sessions.get(userId);
    return !!session?.socket?.user;
  }

  /** Obtener QR code actual de un usuario */
  getQrCode(userId: number): string | null {
    return this.sessions.get(userId)?.qrCode || null;
  }

  /** Conectar WhatsApp de un usuario */
  async connect(userId: number): Promise<void> {
    try {
      console.log(`[SessionManager] connect() called for user ${userId}`);

      // Si ya está conectado, no hacer nada
      if (this.isConnected(userId)) {
        console.log(`[SessionManager] User ${userId} already connected`);
        return;
      }

      // Actualizar estado en BD
      await this.upsertSession(userId, "CONECTANDO");
      console.log(`[SessionManager] State set to CONECTANDO for user ${userId}`);

      // Preparar directorio temporal para auth state
      const sessionDir = path.join("/tmp", "wa-sessions", String(userId));
      fs.mkdirSync(sessionDir, { recursive: true });
      console.log(`[SessionManager] Session dir created: ${sessionDir}`);

      // Intentar restaurar credenciales desde BD
      await this.restoreCredsFromDb(userId, sessionDir);

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      console.log(`[SessionManager] Auth state loaded for user ${userId}`);

      const sock = makeWASocket({
        auth: state,
        logger,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
      });
      console.log(`[SessionManager] WASocket created for user ${userId}`);

      const sessionInfo: SessionInfo = { socket: sock, idleTimer: null, qrCode: null };
      this.sessions.set(userId, sessionInfo);

      // Evento de actualización de conexión
      sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        console.log(`[SessionManager] connection.update for user ${userId}:`, JSON.stringify(update).slice(0, 200));
        const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Guardar QR en memoria para polling
        const si = this.sessions.get(userId);
        if (si) si.qrCode = qr;
        await this.upsertSession(userId, "QR_PENDIENTE");
      }

      if (connection === "open") {
        // Limpiar QR de memoria
        const si = this.sessions.get(userId);
        if (si) si.qrCode = null;
        const numero = sock.user?.id?.split(":")[0] || null;
        await this.upsertSession(userId, "CONECTADO", numero);
        this.startIdleTimer(userId);

        // Guardar credenciales en BD
        await this.saveCredsToDb(userId, sessionDir);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.sessions.delete(userId);

        if (shouldReconnect) {
          // Reconectar automáticamente
          await this.upsertSession(userId, "CONECTANDO");
          setTimeout(() => this.connect(userId), 3000);
        } else {
          await this.upsertSession(userId, "DESCONECTADO");
          // Limpiar credenciales
          await this.clearCreds(userId, sessionDir);
        }
      }
    });

    // Guardar credenciales al actualizarse
    sock.ev.on("creds.update", async () => {
      await saveCreds();
      await this.saveCredsToDb(userId, sessionDir);
    });

    console.log(`[SessionManager] All event handlers registered for user ${userId}, waiting for QR...`);
    } catch (err) {
      console.error(`[SessionManager] FATAL error in connect() for user ${userId}:`, err);
      await this.upsertSession(userId, "DESCONECTADO");
    }
  }

  /** Desconectar sesión de un usuario */
  async disconnect(userId: number): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    if (session.idleTimer) clearTimeout(session.idleTimer);

    try {
      await session.socket.logout();
    } catch {
      // Ignorar errores al cerrar
    }

    this.sessions.delete(userId);
    await this.upsertSession(userId, "DESCONECTADO");

    // Limpiar credenciales
    const sessionDir = path.join("/tmp", "wa-sessions", String(userId));
    await this.clearCreds(userId, sessionDir);
  }

  /** Resetear timer de inactividad */
  resetIdleTimer(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) return;

    if (session.idleTimer) clearTimeout(session.idleTimer);
    this.startIdleTimer(userId);
  }

  /** Obtener estado de sesión desde BD + QR de memoria */
  async getStatus(userId: number) {
    const sesion = await prisma.wa_sesiones.findUnique({
      where: { usuario_id: userId },
    });
    return {
      estado: sesion?.estado || "DESCONECTADO",
      numero_wa: sesion?.numero_wa || null,
      ultimo_uso: sesion?.ultimo_uso || null,
      activo_en_memoria: this.isConnected(userId),
      qr_code: this.getQrCode(userId),
    };
  }

  // ─── Helpers privados ───

  private startIdleTimer(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) return;

    session.idleTimer = setTimeout(async () => {
      console.log(`[SessionManager] Idle timeout for user ${userId}, disconnecting...`);
      const sessionDir = path.join("/tmp", "wa-sessions", String(userId));
      await this.saveCredsToDb(userId, sessionDir);

      try {
        session.socket.end(undefined);
      } catch { /* ignore */ }

      this.sessions.delete(userId);
      await this.upsertSession(userId, "DESCONECTADO");
    }, config.idleTimeoutMs);
  }

  private async upsertSession(userId: number, estado: string, numero_wa?: string | null) {
    await prisma.wa_sesiones.upsert({
      where: { usuario_id: userId },
      update: {
        estado,
        ...(numero_wa !== undefined ? { numero_wa } : {}),
        ultimo_uso: new Date(),
      },
      create: {
        usuario_id: userId,
        estado,
        numero_wa: numero_wa || null,
      },
    });
  }

  private async saveCredsToDb(userId: number, sessionDir: string) {
    try {
      const credsPath = path.join(sessionDir, "creds.json");
      if (fs.existsSync(credsPath)) {
        const credsRaw = fs.readFileSync(credsPath, "utf-8");
        const credsEncrypted = encrypt(credsRaw);
        await prisma.wa_sesiones.update({
          where: { usuario_id: userId },
          data: { creds_json: credsEncrypted },
        });
      }
    } catch (err) {
      console.error(`[SessionManager] Error saving creds for user ${userId}:`, err);
    }
  }

  private async restoreCredsFromDb(userId: number, sessionDir: string) {
    try {
      const sesion = await prisma.wa_sesiones.findUnique({
        where: { usuario_id: userId },
      });
      if (sesion?.creds_json) {
        const credsRaw = decrypt(sesion.creds_json);
        const credsPath = path.join(sessionDir, "creds.json");
        fs.writeFileSync(credsPath, credsRaw, "utf-8");
      }
    } catch (err) {
      console.error(`[SessionManager] Error restoring creds for user ${userId}:`, err);
    }
  }

  private async clearCreds(userId: number, sessionDir: string) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      await prisma.wa_sesiones.update({
        where: { usuario_id: userId },
        data: { creds_json: null, keys_json: null },
      });
    } catch { /* ignore */ }
  }
}

export const sessionManager = new SessionManager();
