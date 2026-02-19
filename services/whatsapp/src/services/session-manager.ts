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
}

class SessionManager {
  private sessions: Map<number, SessionInfo> = new Map();
  private qrCallbacks: Map<number, (data: { type: string; data: string }) => void> = new Map();

  /** Obtener socket activo de un usuario */
  getSocket(userId: number): WASocket | undefined {
    return this.sessions.get(userId)?.socket;
  }

  /** Verificar si un usuario tiene sesión conectada */
  isConnected(userId: number): boolean {
    const session = this.sessions.get(userId);
    return !!session?.socket?.user;
  }

  /** Registrar callback para eventos QR/conexión (SSE) */
  onQrEvent(userId: number, callback: (data: { type: string; data: string }) => void) {
    this.qrCallbacks.set(userId, callback);
  }

  /** Remover callback QR */
  removeQrCallback(userId: number) {
    this.qrCallbacks.delete(userId);
  }

  /** Conectar WhatsApp de un usuario */
  async connect(userId: number): Promise<void> {
    // Si ya está conectado, no hacer nada
    if (this.isConnected(userId)) {
      this.emitQrEvent(userId, "connected", "already_connected");
      return;
    }

    // Actualizar estado en BD
    await this.upsertSession(userId, "CONECTANDO");

    // Preparar directorio temporal para auth state
    const sessionDir = path.join("/tmp", "wa-sessions", String(userId));
    fs.mkdirSync(sessionDir, { recursive: true });

    // Intentar restaurar credenciales desde BD
    await this.restoreCredsFromDb(userId, sessionDir);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ["Sistema Asignacion", "Chrome", "1.0.0"],
    });

    const sessionInfo: SessionInfo = { socket: sock, idleTimer: null };
    this.sessions.set(userId, sessionInfo);

    // Evento de actualización de conexión
    sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        await this.upsertSession(userId, "QR_PENDIENTE");
        this.emitQrEvent(userId, "qr", qr);
      }

      if (connection === "open") {
        const numero = sock.user?.id?.split(":")[0] || null;
        await this.upsertSession(userId, "CONECTADO", numero);
        this.emitQrEvent(userId, "connected", numero || "connected");
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
          this.emitQrEvent(userId, "disconnected", "logged_out");
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

  /** Obtener estado de sesión desde BD */
  async getStatus(userId: number) {
    const sesion = await prisma.wa_sesiones.findUnique({
      where: { usuario_id: userId },
    });
    return {
      estado: sesion?.estado || "DESCONECTADO",
      numero_wa: sesion?.numero_wa || null,
      ultimo_uso: sesion?.ultimo_uso || null,
      activo_en_memoria: this.isConnected(userId),
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

  private emitQrEvent(userId: number, type: string, data: string) {
    const callback = this.qrCallbacks.get(userId);
    if (callback) callback({ type, data });
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
