import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { encrypt, decrypt } from "./crypto.js";
import { attachInterceptor } from "./interceptor.js";

const logger = pino({ level: "warn" });

interface SessionInfo {
  socket: WASocket;
  idleTimer: NodeJS.Timeout | null;
  qrCode: string | null;
}

// Códigos de desconexión "sospechosos" — indican posible ban/restricción de WA
const SUSPICIOUS_CODES = new Set<number>([
  DisconnectReason.badSession,          // 500
  DisconnectReason.forbidden,           // 403
  DisconnectReason.loggedOut,           // 401 — cuenta cerrada por WA
  DisconnectReason.multideviceMismatch, // 411
  DisconnectReason.connectionReplaced,  // 440
]);

class SessionManager {
  private sessions: Map<number, SessionInfo> = new Map();
  private interceptedUsers: Set<number> = new Set();

  getSocket(userId: number): WASocket | undefined {
    return this.sessions.get(userId)?.socket;
  }

  isConnected(userId: number): boolean {
    const session = this.sessions.get(userId);
    return !!session?.socket?.user;
  }

  getQrCode(userId: number): string | null {
    return this.sessions.get(userId)?.qrCode || null;
  }

  /** Conectar WhatsApp de un usuario */
  async connect(userId: number): Promise<void> {
    try {
      console.log(`[SessionManager] connect() called for user ${userId}`);

      if (this.sessions.has(userId)) {
        console.log(`[SessionManager] User ${userId} already has active session, skipping`);
        return;
      }

      await this.upsertSession(userId, "CONECTANDO");

      const sessionDir = path.join("/tmp", "wa-sessions", String(userId));
      fs.mkdirSync(sessionDir, { recursive: true });

      // Restaurar creds Y keys desde BD (si existen)
      await this.restoreAuthFromDb(userId, sessionDir);

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`[SessionManager] Using WA version ${version.join(".")}, isLatest: ${isLatest}`);

      const sock = makeWASocket({
        auth: state,
        version,
        logger,
        browser: Browsers.macOS("Desktop"),
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });
      console.log(`[SessionManager] WASocket created for user ${userId}`);

      const sessionInfo: SessionInfo = { socket: sock, idleTimer: null, qrCode: null };
      this.sessions.set(userId, sessionInfo);

      sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          const si = this.sessions.get(userId);
          if (si) si.qrCode = qr;
          await this.upsertSession(userId, "QR_PENDIENTE");
        }

        if (connection === "open") {
          const si = this.sessions.get(userId);
          if (si) si.qrCode = null;
          const numero = sock.user?.id?.split(":")[0] || null;
          await this.upsertSession(userId, "CONECTADO", numero);
          this.startIdleTimer(userId);

          if (!this.interceptedUsers.has(userId)) {
            attachInterceptor(userId, sock);
            this.interceptedUsers.add(userId);
          }

          // Persistir auth state completo (creds + keys)
          await this.saveAuthToDb(userId, sessionDir);
        }

        if (connection === "close") {
          const error = lastDisconnect?.error as Boom | undefined;
          const statusCode = error?.output?.statusCode;
          const motivo = error?.message?.slice(0, 200) || null;
          console.log(`[SessionManager] Connection closed for user ${userId}, statusCode: ${statusCode}, motivo: ${motivo}`);

          // Registrar desconexión
          await this.logDisconnection(userId, statusCode, motivo);

          this.sessions.delete(userId);
          this.interceptedUsers.delete(userId);

          const noReconnectCodes = [
            DisconnectReason.loggedOut,     // 401
            DisconnectReason.timedOut,      // 408
            409,                            // Conflict
          ];
          const shouldReconnect = statusCode === undefined
            || !noReconnectCodes.includes(statusCode);

          if (shouldReconnect) {
            await this.upsertSession(userId, "CONECTANDO");
            const jitter = Math.floor(Math.random() * 5000);
            setTimeout(() => this.connect(userId), 5000 + jitter);
          } else {
            await this.upsertSession(userId, "DESCONECTADO");
            if (statusCode === DisconnectReason.loggedOut) {
              await this.clearCreds(userId, sessionDir);
            }
          }
        }
      });

      sock.ev.on("creds.update", async () => {
        await saveCreds();
        await this.saveAuthToDb(userId, sessionDir);
      });

      console.log(`[SessionManager] All event handlers registered for user ${userId}, waiting for QR...`);
    } catch (err) {
      console.error(`[SessionManager] FATAL error in connect() for user ${userId}:`, err);
      await this.upsertSession(userId, "DESCONECTADO");
    }
  }

  async disconnect(userId: number): Promise<void> {
    const session = this.sessions.get(userId);

    if (session) {
      if (session.idleTimer) clearTimeout(session.idleTimer);
      try {
        await session.socket.logout();
      } catch {
        // ignore
      }
      this.sessions.delete(userId);
      this.interceptedUsers.delete(userId);
    }

    await this.upsertSession(userId, "DESCONECTADO");
    const sessionDir = path.join("/tmp", "wa-sessions", String(userId));
    await this.clearCreds(userId, sessionDir);
  }

  resetIdleTimer(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) return;
    if (session.idleTimer) clearTimeout(session.idleTimer);
    this.startIdleTimer(userId);
  }

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
      ultima_desconexion_at: sesion?.ultima_desconexion_at || null,
      ultima_desconexion_codigo: sesion?.ultima_desconexion_codigo || null,
      ultima_desconexion_motivo: sesion?.ultima_desconexion_motivo || null,
      desconexiones_sospechosas_24h: sesion?.desconexiones_sospechosas_24h || 0,
    };
  }

  // ─── Helpers privados ───

  private startIdleTimer(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) return;

    session.idleTimer = setTimeout(async () => {
      console.log(`[SessionManager] Idle timeout for user ${userId}, disconnecting...`);
      const sessionDir = path.join("/tmp", "wa-sessions", String(userId));
      await this.saveAuthToDb(userId, sessionDir);

      try {
        session.socket.end(undefined);
      } catch { /* ignore */ }

      this.sessions.delete(userId);
      this.interceptedUsers.delete(userId);
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

  /**
   * Registra una desconexión y, si el código es sospechoso, incrementa el
   * contador rolling de 24h. El admin puede consultar este contador para
   * detectar bans masivos (varios promotores desconectándose con códigos
   * sospechosos al mismo tiempo = probable cambio de protocolo WA).
   */
  private async logDisconnection(userId: number, statusCode?: number, motivo?: string | null) {
    const isSuspicious = statusCode !== undefined && SUSPICIOUS_CODES.has(statusCode);

    try {
      const existing = await prisma.wa_sesiones.findUnique({
        where: { usuario_id: userId },
        select: { ultima_desconexion_at: true, desconexiones_sospechosas_24h: true },
      });

      let counter = existing?.desconexiones_sospechosas_24h ?? 0;
      // Reset si la última desconexión fue hace >24h
      if (existing?.ultima_desconexion_at) {
        const elapsed = Date.now() - existing.ultima_desconexion_at.getTime();
        if (elapsed > 24 * 60 * 60 * 1000) counter = 0;
      }
      if (isSuspicious) counter += 1;

      await prisma.wa_sesiones.update({
        where: { usuario_id: userId },
        data: {
          ultima_desconexion_at: new Date(),
          ultima_desconexion_codigo: statusCode ?? null,
          ultima_desconexion_motivo: motivo ?? null,
          desconexiones_sospechosas_24h: counter,
        },
      });

      if (isSuspicious) {
        console.warn(`[SessionManager] SUSPICIOUS disconnect user=${userId} code=${statusCode} count24h=${counter} motivo=${motivo}`);
      }
    } catch (err) {
      console.error(`[SessionManager] Failed to log disconnection for user ${userId}:`, err);
    }
  }

  /**
   * Persiste todo el directorio de auth state (creds.json + archivos de keys
   * pre-key/session/sender-key) en la BD. Railway borra /tmp entre reinicios,
   * así que sin esto las claves Signal se pierden y los próximos mensajes a
   * contactos existentes fallan o llegan ilegibles.
   */
  private async saveAuthToDb(userId: number, sessionDir: string) {
    try {
      if (!fs.existsSync(sessionDir)) return;

      // creds.json → columna creds_json
      const credsPath = path.join(sessionDir, "creds.json");
      let credsEncrypted: string | null = null;
      if (fs.existsSync(credsPath)) {
        credsEncrypted = encrypt(fs.readFileSync(credsPath, "utf-8"));
      }

      // Resto de archivos (keys Signal) → columna keys_json como un objeto {filename: contenido}
      const files = fs.readdirSync(sessionDir);
      const keys: Record<string, string> = {};
      for (const f of files) {
        if (f === "creds.json") continue;
        const full = path.join(sessionDir, f);
        if (fs.statSync(full).isFile()) {
          keys[f] = fs.readFileSync(full, "utf-8");
        }
      }
      const keysEncrypted = Object.keys(keys).length > 0
        ? encrypt(JSON.stringify(keys))
        : null;

      await prisma.wa_sesiones.update({
        where: { usuario_id: userId },
        data: {
          ...(credsEncrypted !== null ? { creds_json: credsEncrypted } : {}),
          keys_json: keysEncrypted,
        },
      });
    } catch (err) {
      console.error(`[SessionManager] Error saving auth for user ${userId}:`, err);
    }
  }

  /** Restaura creds.json Y archivos de keys al sessionDir antes de conectar */
  private async restoreAuthFromDb(userId: number, sessionDir: string) {
    try {
      const sesion = await prisma.wa_sesiones.findUnique({
        where: { usuario_id: userId },
        select: { creds_json: true, keys_json: true },
      });
      if (!sesion) return;

      if (sesion.creds_json) {
        const credsRaw = decrypt(sesion.creds_json);
        fs.writeFileSync(path.join(sessionDir, "creds.json"), credsRaw, "utf-8");
      }

      if (sesion.keys_json) {
        const keysRaw = decrypt(sesion.keys_json);
        try {
          const keys = JSON.parse(keysRaw) as Record<string, string>;
          for (const [filename, content] of Object.entries(keys)) {
            // Protegerse de path traversal — filename solo nombre base
            if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) continue;
            fs.writeFileSync(path.join(sessionDir, filename), content, "utf-8");
          }
        } catch (parseErr) {
          console.warn(`[SessionManager] keys_json malformado para user ${userId}, ignorando`);
        }
      }
    } catch (err) {
      console.error(`[SessionManager] Error restoring auth for user ${userId}:`, err);
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
