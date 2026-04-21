import { prisma } from "../lib/prisma.js";
import { sessionManager } from "./session-manager.js";
import { humanDelay, burstSize, burstPause, typingDelay, sleep, type AntiSpamOpts } from "../lib/anti-spam.js";
import { loadAntiSpamConfig, ANTI_SPAM_DEFAULTS } from "../config.js";

interface QueueItem {
  campanaId: number;
  userId: number;
}

class MessageQueue {
  private queues: Map<number, QueueItem[]> = new Map(); // userId → queue
  private processing: Set<number> = new Set(); // userIds currently processing
  private activeCampaigns = 0; // global counter of campaigns currently sending

  // Contador diario en memoria: userId → { fecha ISO, sent }
  private dailyCounters: Map<number, { fecha: string; sent: number }> = new Map();

  // Último envío por JID (para rate-limit por contacto): "userId:jid" → timestamp ms
  private lastSendByJid: Map<string, number> = new Map();

  // Espera por cupo global: resolvers que se llaman cuando se libera un slot
  private slotWaiters: Array<() => void> = [];

  /** Encolar una campaña para envío */
  async enqueue(campanaId: number, userId: number): Promise<void> {
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }
    this.queues.get(userId)!.push({ campanaId, userId });

    if (!this.processing.has(userId)) {
      this.processCampaign(userId);
    }
  }

  /** Pausar campaña */
  async pause(campanaId: number): Promise<void> {
    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "PAUSADA" },
    });
  }

  /** Reanudar campaña */
  async resume(campanaId: number): Promise<void> {
    const campana = await prisma.wa_campanas.findUnique({
      where: { id: campanaId },
    });
    if (!campana || campana.estado !== "PAUSADA") return;

    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "EN_COLA" },
    });

    this.enqueue(campanaId, campana.usuario_id);
  }

  /** Cancelar campaña */
  async cancel(campanaId: number): Promise<void> {
    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "CANCELADA" },
    });

    await prisma.wa_mensajes.updateMany({
      where: {
        campana_id: campanaId,
        estado: { in: ["PENDIENTE", "ENVIANDO"] },
      },
      data: { estado: "FALLIDO", error_detalle: "Campaña cancelada" },
    });
  }

  /**
   * Recuperar campañas huérfanas al iniciar el servicio.
   */
  async recoverOrphanedCampaigns(): Promise<void> {
    try {
      const enviando = await prisma.wa_campanas.findMany({
        where: { estado: "ENVIANDO" },
        select: { id: true, usuario_id: true },
      });

      if (enviando.length > 0) {
        const enviandoIds = enviando.map((c: { id: number }) => c.id);
        await prisma.wa_campanas.updateMany({
          where: { id: { in: enviandoIds } },
          data: { estado: "PAUSADA" },
        });

        await prisma.wa_mensajes.updateMany({
          where: {
            campana_id: { in: enviandoIds },
            estado: "ENVIANDO",
          },
          data: { estado: "PENDIENTE" },
        });

        console.log(`[MessageQueue] Recovered ${enviando.length} orphaned ENVIANDO campaigns → PAUSADA`);
      }

      const enCola = await prisma.wa_campanas.findMany({
        where: { estado: "EN_COLA" },
        select: { id: true, usuario_id: true },
      });

      let reEnqueued = 0;
      for (const campana of enCola) {
        if (sessionManager.isConnected(campana.usuario_id)) {
          await this.enqueue(campana.id, campana.usuario_id);
          reEnqueued++;
        } else {
          await prisma.wa_campanas.update({
            where: { id: campana.id },
            data: { estado: "PAUSADA" },
          });
        }
      }

      if (enCola.length > 0) {
        console.log(`[MessageQueue] Recovered ${enCola.length} EN_COLA campaigns (${reEnqueued} re-enqueued, ${enCola.length - reEnqueued} paused)`);
      }
    } catch (err) {
      console.error("[MessageQueue] Error recovering orphaned campaigns:", err);
    }
  }

  /** Estadísticas de la cola — expuesto por /health */
  getStats() {
    return {
      activeCampaigns: this.activeCampaigns,
      maxConcurrent: ANTI_SPAM_DEFAULTS.maxConcurrentCampaigns, // informativo; el real se lee dinámico
      processingUsers: this.processing.size,
      queuedItems: Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0),
      waitingForSlot: this.slotWaiters.length,
      dailyCounters: this.dailyCounters.size,
    };
  }

  // ─── Slot global (notifier event-driven) ───

  private async acquireSlot(maxConcurrent: number): Promise<void> {
    if (this.activeCampaigns < maxConcurrent) {
      this.activeCampaigns++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.slotWaiters.push(resolve);
    });
    // al ser resuelto, el releaser ya incrementó activeCampaigns por nosotros
  }

  private releaseSlot(): void {
    const next = this.slotWaiters.shift();
    if (next) {
      // transferimos el slot directamente al waiter (sin decrementar/incrementar)
      next();
    } else {
      this.activeCampaigns--;
    }
  }

  // ─── Contador diario en memoria ───

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  private async getDailySent(userId: number): Promise<number> {
    const today = this.todayStr();
    const cached = this.dailyCounters.get(userId);
    if (cached && cached.fecha === today) return cached.sent;

    // Hidrata desde BD (al arrancar o nuevo día)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const sent = await prisma.wa_mensajes.count({
      where: {
        campana: { usuario_id: userId },
        estado: { in: ["ENVIADO", "ENTREGADO", "LEIDO"] },
        enviado_at: { gte: hoy },
      },
    });
    this.dailyCounters.set(userId, { fecha: today, sent });
    return sent;
  }

  private incrementDailySent(userId: number): number {
    const today = this.todayStr();
    const cached = this.dailyCounters.get(userId);
    if (!cached || cached.fecha !== today) {
      this.dailyCounters.set(userId, { fecha: today, sent: 1 });
      return 1;
    }
    cached.sent++;
    return cached.sent;
  }

  // ─── Rate-limit por JID ───

  private canSendToJid(userId: number, jid: string, cooldownMs: number): boolean {
    const key = `${userId}:${jid}`;
    const last = this.lastSendByJid.get(key);
    if (!last) return true;
    return Date.now() - last >= cooldownMs;
  }

  private markJidSent(userId: number, jid: string): void {
    this.lastSendByJid.set(`${userId}:${jid}`, Date.now());
    // Poda cada ~500 inserts para evitar crecer indefinido
    if (this.lastSendByJid.size > 5000) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const [k, t] of this.lastSendByJid) {
        if (t < cutoff) this.lastSendByJid.delete(k);
      }
    }
  }

  /** Procesar cola de un usuario */
  private async processCampaign(userId: number): Promise<void> {
    this.processing.add(userId);

    try {
      while (this.queues.get(userId)?.length) {
        const antiSpam = await loadAntiSpamConfig();
        await this.acquireSlot(antiSpam.maxConcurrentCampaigns);

        const item = this.queues.get(userId)!.shift()!;
        try {
          await this.sendCampaign(item, antiSpam);
        } finally {
          this.releaseSlot();
        }
      }
    } finally {
      this.processing.delete(userId);
      this.queues.delete(userId);
    }
  }

  /** Enviar todos los mensajes de una campaña */
  private async sendCampaign(item: QueueItem, antiSpam: Awaited<ReturnType<typeof loadAntiSpamConfig>>): Promise<void> {
    const { campanaId, userId } = item;
    const spamOpts: AntiSpamOpts = antiSpam;

    const sock = sessionManager.getSocket(userId);
    if (!sock) {
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "PAUSADA" },
      });
      console.log(`[MessageQueue] No socket for user ${userId}, campaign ${campanaId} paused`);
      return;
    }

    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "ENVIANDO" },
    });

    const mensajes = await prisma.wa_mensajes.findMany({
      where: { campana_id: campanaId, estado: "PENDIENTE" },
      orderBy: { id: "asc" },
    });

    // Verificar límite diario (usando contador en memoria, fuente de verdad ante concurrencia)
    const enviadosHoy = await this.getDailySent(userId);

    if (enviadosHoy >= antiSpam.dailyLimit) {
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "PAUSADA" },
      });
      console.log(`[MessageQueue] Daily limit reached for user ${userId} (${enviadosHoy}/${antiSpam.dailyLimit})`);
      return;
    }

    let burstCount = 0;
    let currentBurstSize = burstSize(spamOpts);
    let msgIndex = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    for (const msg of mensajes) {
      // Check campaña still active (every 5 messages)
      if (msgIndex % 5 === 0) {
        const campana = await prisma.wa_campanas.findUnique({
          where: { id: campanaId },
          select: { estado: true },
        });
        if (!campana || !["ENVIANDO", "EN_COLA"].includes(campana.estado)) {
          break;
        }
      }
      msgIndex++;

      // Check daily limit contra contador en memoria
      const currentDaily = await this.getDailySent(userId);
      if (currentDaily >= antiSpam.dailyLimit) {
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { estado: "PAUSADA" },
        });
        console.log(`[MessageQueue] Daily limit reached mid-campaign for user ${userId}`);
        break;
      }

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { estado: "PAUSADA" },
        });
        console.log(`[MessageQueue] ${MAX_CONSECUTIVE_ERRORS} consecutive errors for user ${userId}, pausing campaign ${campanaId}`);
        break;
      }

      // Burst control
      if (burstCount >= currentBurstSize) {
        const pause = burstPause(spamOpts);
        console.log(`[MessageQueue] Burst pause ${Math.round(pause / 1000)}s for user ${userId}`);
        await sleep(pause);
        burstCount = 0;
        currentBurstSize = burstSize(spamOpts);
      }

      const jid = `${msg.numero_destino}@s.whatsapp.net`;

      // Rate-limit por JID — evita re-enviar al mismo número dentro del cooldown
      if (!this.canSendToJid(userId, jid, antiSpam.perJidCooldownMs)) {
        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: {
            estado: "FALLIDO",
            error_detalle: `Rate-limit por JID: último envío dentro de ${Math.round(antiSpam.perJidCooldownMs / 60000)}min`,
          },
        });
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { fallidos: { increment: 1 } },
        });
        continue;
      }

      try {
        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: { estado: "ENVIANDO" },
        });

        // Simulate typing (non-critical)
        try {
          await sock.presenceSubscribe(jid);
          await sleep(1000);
          await sock.sendPresenceUpdate("composing", jid);
          await sleep(typingDelay(msg.mensaje_texto.length));
          await sock.sendPresenceUpdate("paused", jid);
        } catch (presenceErr) {
          console.warn(`[MessageQueue] Presence simulation failed for ${msg.numero_destino}, proceeding with send`);
        }

        const sent = await sock.sendMessage(jid, { text: msg.mensaje_texto });

        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: {
            estado: "ENVIADO",
            wa_message_id: sent?.key?.id || null,
            enviado_at: new Date(),
          },
        });

        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { enviados: { increment: 1 } },
        });

        this.incrementDailySent(userId);
        this.markJidSent(userId, jid);
        sessionManager.resetIdleTimer(userId);

        burstCount++;
        consecutiveErrors = 0;

        const delay = humanDelay(msg.mensaje_texto.length, spamOpts);
        console.log(`[MessageQueue] Sent to ${msg.numero_destino}, next in ${Math.round(delay / 1000)}s`);
        await sleep(delay);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[MessageQueue] Failed to send to ${msg.numero_destino}:`, errorMsg);
        consecutiveErrors++;

        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: {
            estado: "FALLIDO",
            error_detalle: errorMsg.slice(0, 500),
          },
        });

        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { fallidos: { increment: 1 } },
        });
      }
    }

    // Finalize
    const campana = await prisma.wa_campanas.findUnique({
      where: { id: campanaId },
      select: { estado: true },
    });
    if (campana?.estado === "ENVIANDO") {
      const pendientes = await prisma.wa_mensajes.count({
        where: { campana_id: campanaId, estado: "PENDIENTE" },
      });
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: pendientes > 0 ? "PAUSADA" : "COMPLETADA" },
      });
    }
  }
}

export const messageQueue = new MessageQueue();
