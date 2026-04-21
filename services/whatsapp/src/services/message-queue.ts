import { prisma } from "../lib/prisma.js";
import { sessionManager } from "./session-manager.js";
import { humanDelay, burstSize, burstPause, typingDelay, sleep, type AntiSpamOpts } from "../lib/anti-spam.js";
import { loadAntiSpamConfig, ANTI_SPAM_DEFAULTS, type AntiSpamConfig } from "../config.js";

interface QueueItem {
  campanaId: number;
  userId: number;
}

/**
 * Estados en los que una campaña está pausada por cualquier motivo.
 * Los estados "AUTO" los reanuda autoResume() cuando se resuelve la causa;
 * los "MANUAL" requieren acción explícita del usuario.
 */
const PAUSED_STATES = [
  "PAUSADA_MANUAL",
  "ESPERA_VENTANA",
  "LIMITE_DIARIO",
  "SIN_SESION",
  "ERRORES_CONSECUTIVOS",
  "INTERRUMPIDA",
] as const;

const AUTO_RESUMABLE_STATES = [
  "ESPERA_VENTANA",
  "LIMITE_DIARIO",
  "SIN_SESION",
  "INTERRUMPIDA",
] as const;

class MessageQueue {
  private queues: Map<number, QueueItem[]> = new Map();
  private processing: Set<number> = new Set();
  private activeCampaigns = 0;

  private dailyCounters: Map<number, { fecha: string; sent: number }> = new Map();
  private lastSendByJid: Map<string, number> = new Map();
  private slotWaiters: Array<() => void> = [];

  async enqueue(campanaId: number, userId: number): Promise<void> {
    if (!this.queues.has(userId)) this.queues.set(userId, []);
    this.queues.get(userId)!.push({ campanaId, userId });

    if (!this.processing.has(userId)) {
      this.processCampaign(userId);
    }
  }

  async pause(campanaId: number): Promise<void> {
    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "PAUSADA_MANUAL" },
    });
  }

  async resume(campanaId: number): Promise<void> {
    const campana = await prisma.wa_campanas.findUnique({ where: { id: campanaId } });
    if (!campana || !(PAUSED_STATES as readonly string[]).includes(campana.estado)) return;
    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "EN_COLA" },
    });
    this.enqueue(campanaId, campana.usuario_id);
  }

  async cancel(campanaId: number): Promise<void> {
    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "CANCELADA" },
    });
    await prisma.wa_mensajes.updateMany({
      where: { campana_id: campanaId, estado: { in: ["PENDIENTE", "ENVIANDO"] } },
      data: { estado: "FALLIDO", error_detalle: "Campaña cancelada" },
    });
  }

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
          data: { estado: "INTERRUMPIDA" },
        });
        await prisma.wa_mensajes.updateMany({
          where: { campana_id: { in: enviandoIds }, estado: "ENVIANDO" },
          data: { estado: "PENDIENTE" },
        });
        console.log(`[MessageQueue] Recovered ${enviando.length} orphaned ENVIANDO campaigns → INTERRUMPIDA`);
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
            data: { estado: "SIN_SESION" },
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

  /**
   * Reanuda automáticamente campañas que están pausadas por motivos recuperables:
   * - ESPERA_VENTANA: si la ventana horaria ya está abierta
   * - LIMITE_DIARIO: si cambió el día (contador diario de ese user != hoy o 0)
   * - SIN_SESION / INTERRUMPIDA: si el socket del usuario está conectado
   * PAUSADA_MANUAL y ERRORES_CONSECUTIVOS nunca se auto-reanudan.
   */
  async autoResume(): Promise<void> {
    try {
      const candidatas = await prisma.wa_campanas.findMany({
        where: { estado: { in: [...AUTO_RESUMABLE_STATES] } },
        select: { id: true, usuario_id: true, estado: true },
      });
      if (candidatas.length === 0) return;

      const cfg = await loadAntiSpamConfig();
      const ventanaAbierta = this.isWithinSendingWindow(cfg);
      const today = this.todayStr();
      let reanudadas = 0;

      for (const c of candidatas) {
        let elegible = false;

        if (c.estado === "ESPERA_VENTANA") {
          elegible = ventanaAbierta;
        } else if (c.estado === "LIMITE_DIARIO") {
          // Reanudable si la ventana está abierta Y el contador en memoria
          // es de otro día (o aún no existe, = nuevo día).
          const cached = this.dailyCounters.get(c.usuario_id);
          const esNuevoDia = !cached || cached.fecha !== today;
          elegible = ventanaAbierta && esNuevoDia;
        } else if (c.estado === "SIN_SESION" || c.estado === "INTERRUMPIDA") {
          elegible = ventanaAbierta && sessionManager.isConnected(c.usuario_id);
        }

        if (elegible) {
          await prisma.wa_campanas.update({
            where: { id: c.id },
            data: { estado: "EN_COLA" },
          });
          await this.enqueue(c.id, c.usuario_id);
          reanudadas++;
        }
      }

      if (reanudadas > 0) {
        console.log(`[MessageQueue] autoResume: ${reanudadas}/${candidatas.length} campañas reanudadas`);
      }
    } catch (err) {
      console.error("[MessageQueue] Error en autoResume:", err);
    }
  }

  getStats() {
    return {
      activeCampaigns: this.activeCampaigns,
      maxConcurrent: ANTI_SPAM_DEFAULTS.maxConcurrentCampaigns,
      processingUsers: this.processing.size,
      queuedItems: Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0),
      waitingForSlot: this.slotWaiters.length,
      dailyCounters: this.dailyCounters.size,
    };
  }

  // ─── Slot global ───

  private async acquireSlot(maxConcurrent: number): Promise<void> {
    if (this.activeCampaigns < maxConcurrent) {
      this.activeCampaigns++;
      return;
    }
    await new Promise<void>((resolve) => this.slotWaiters.push(resolve));
  }

  private releaseSlot(): void {
    const next = this.slotWaiters.shift();
    if (next) next();
    else this.activeCampaigns--;
  }

  // ─── Contador diario ───

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  /** Expone info de warmup/ventana/daily para UI */
  async getLimitInfoFor(userId: number) {
    const cfg = await loadAntiSpamConfig();
    const effectiveLimit = await this.getEffectiveDailyLimit(userId, cfg);
    const sent = await this.getDailySent(userId);
    const sesion = await prisma.wa_sesiones.findUnique({
      where: { usuario_id: userId },
      select: { primer_envio_at: true },
    });
    const diasTranscurridos = sesion?.primer_envio_at
      ? Math.floor((Date.now() - sesion.primer_envio_at.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const enWarmup = !sesion?.primer_envio_at || (diasTranscurridos !== null && diasTranscurridos < 3);
    const ventanaAbierta = this.isWithinSendingWindow(cfg);
    const msHastaProximaVentana = ventanaAbierta ? 0 : this.msUntilNextWindow(cfg);

    return {
      warmup: {
        enWarmup,
        primerEnvioAt: sesion?.primer_envio_at ?? null,
        diasTranscurridos,
        limiteEfectivo: effectiveLimit,
        enviadosHoy: sent,
        limiteDiarioMaduro: cfg.dailyLimit,
      },
      ventana: {
        abierta: ventanaAbierta,
        horaInicio: cfg.ventanaHoraInicio,
        horaFin: cfg.ventanaHoraFin,
        proximaAperturaEnMs: msHastaProximaVentana,
      },
    };
  }

  private async getDailySent(userId: number): Promise<number> {
    const today = this.todayStr();
    const cached = this.dailyCounters.get(userId);
    if (cached && cached.fecha === today) return cached.sent;

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
    const last = this.lastSendByJid.get(`${userId}:${jid}`);
    return !last || Date.now() - last >= cooldownMs;
  }

  private markJidSent(userId: number, jid: string): void {
    this.lastSendByJid.set(`${userId}:${jid}`, Date.now());
    if (this.lastSendByJid.size > 5000) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const [k, t] of this.lastSendByJid) {
        if (t < cutoff) this.lastSendByJid.delete(k);
      }
    }
  }

  // ─── Warmup: límite diario escalado en cuentas nuevas ───

  /**
   * Calcula el límite diario efectivo según los días desde primer_envio_at.
   * Día 1: warmupDia1 (30 por defecto)
   * Día 2: warmupDia2 (60)
   * Día 3: warmupDia3 (120)
   * Día 4+: dailyLimit (180 — cuenta madura)
   */
  private async getEffectiveDailyLimit(userId: number, cfg: AntiSpamConfig): Promise<number> {
    const sesion = await prisma.wa_sesiones.findUnique({
      where: { usuario_id: userId },
      select: { primer_envio_at: true },
    });
    if (!sesion?.primer_envio_at) return cfg.warmupDia1;

    const diasTranscurridos = Math.floor(
      (Date.now() - sesion.primer_envio_at.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diasTranscurridos < 1) return cfg.warmupDia1;
    if (diasTranscurridos < 2) return cfg.warmupDia2;
    if (diasTranscurridos < 3) return cfg.warmupDia3;
    return cfg.dailyLimit;
  }

  private async markFirstSend(userId: number): Promise<void> {
    const sesion = await prisma.wa_sesiones.findUnique({
      where: { usuario_id: userId },
      select: { primer_envio_at: true },
    });
    if (!sesion?.primer_envio_at) {
      await prisma.wa_sesiones.update({
        where: { usuario_id: userId },
        data: { primer_envio_at: new Date() },
      });
    }
  }

  // ─── Ventana horaria ───

  private isWithinSendingWindow(cfg: AntiSpamConfig): boolean {
    const hour = new Date().getHours();
    return hour >= cfg.ventanaHoraInicio && hour < cfg.ventanaHoraFin;
  }

  private msUntilNextWindow(cfg: AntiSpamConfig): number {
    const now = new Date();
    const target = new Date(now);
    target.setHours(cfg.ventanaHoraInicio, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  }

  // ─── Contactos bloqueados ───

  /**
   * Carga el set de números bloqueados (global + del usuario) al inicio de
   * la campaña. Se recarga por campaña, no por mensaje, para no martillar BD.
   */
  private async loadBlockedNumbers(userId: number): Promise<Set<string>> {
    try {
      const rows = await prisma.wa_contactos_bloqueados.findMany({
        where: { OR: [{ usuario_id: userId }, { usuario_id: null }] },
        select: { numero: true },
      });
      return new Set(rows.map((r: { numero: string }) => r.numero));
    } catch (err) {
      console.error("[MessageQueue] Error loading blocked numbers:", err);
      return new Set();
    }
  }

  private async blockContact(userId: number | null, numero: string, motivo: string, origen: string): Promise<void> {
    try {
      const existing = await prisma.wa_contactos_bloqueados.findFirst({
        where: { numero, usuario_id: userId },
      });
      if (existing) {
        await prisma.wa_contactos_bloqueados.update({
          where: { id: existing.id },
          data: { motivo, origen, bloqueado_at: new Date() },
        });
      } else {
        await prisma.wa_contactos_bloqueados.create({
          data: { usuario_id: userId, numero, motivo, origen },
        });
      }
    } catch (err) {
      console.error("[MessageQueue] Error blocking contact:", err);
    }
  }

  // ─── Proceso principal ───

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

  private async sendCampaign(item: QueueItem, antiSpam: AntiSpamConfig): Promise<void> {
    const { campanaId, userId } = item;
    const spamOpts: AntiSpamOpts = antiSpam;

    const sock = sessionManager.getSocket(userId);
    if (!sock) {
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "SIN_SESION" },
      });
      console.log(`[MessageQueue] No socket for user ${userId}, campaign ${campanaId} → SIN_SESION`);
      return;
    }

    // Fuera de ventana horaria → esperar próxima ventana (auto-reanuda)
    if (!this.isWithinSendingWindow(antiSpam)) {
      const waitMs = this.msUntilNextWindow(antiSpam);
      console.log(`[MessageQueue] Fuera de ventana horaria para user ${userId}, campaña ${campanaId} → ESPERA_VENTANA (${Math.round(waitMs / 60000)}min)`);
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "ESPERA_VENTANA" },
      });
      return;
    }

    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "ENVIANDO" },
    });

    // Pre-warm de presencia: parecer online antes del primer envío, no al momento
    try {
      await sock.sendPresenceUpdate("available");
    } catch { /* non-critical */ }

    const mensajes = await prisma.wa_mensajes.findMany({
      where: { campana_id: campanaId, estado: "PENDIENTE" },
      orderBy: { id: "asc" },
    });

    // Límite diario efectivo (incluye warmup)
    const effectiveLimit = await this.getEffectiveDailyLimit(userId, antiSpam);
    const enviadosHoy = await this.getDailySent(userId);

    if (enviadosHoy >= effectiveLimit) {
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "LIMITE_DIARIO" },
      });
      console.log(`[MessageQueue] Daily limit (warmup-aware) reached for user ${userId} (${enviadosHoy}/${effectiveLimit}) → LIMITE_DIARIO`);
      return;
    }

    // Cargar bloqueados una vez por campaña
    const blockedNumbers = await this.loadBlockedNumbers(userId);

    let burstCount = 0;
    let currentBurstSize = burstSize(spamOpts);
    let msgIndex = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    for (const msg of mensajes) {
      // Check estado cada 5
      if (msgIndex % 5 === 0) {
        const campana = await prisma.wa_campanas.findUnique({
          where: { id: campanaId },
          select: { estado: true },
        });
        if (!campana || !["ENVIANDO", "EN_COLA"].includes(campana.estado)) break;
      }
      msgIndex++;

      // Re-check ventana horaria cada 5 (campañas largas pueden cruzar el corte)
      if (msgIndex % 5 === 0 && !this.isWithinSendingWindow(antiSpam)) {
        console.log(`[MessageQueue] Ventana cerró durante envío user ${userId} → ESPERA_VENTANA`);
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { estado: "ESPERA_VENTANA" },
        });
        break;
      }

      // Daily limit (warmup)
      const currentDaily = await this.getDailySent(userId);
      if (currentDaily >= effectiveLimit) {
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { estado: "LIMITE_DIARIO" },
        });
        console.log(`[MessageQueue] Daily limit reached mid-campaign user ${userId} (${currentDaily}/${effectiveLimit}) → LIMITE_DIARIO`);
        break;
      }

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { estado: "ERRORES_CONSECUTIVOS" },
        });
        console.log(`[MessageQueue] ${MAX_CONSECUTIVE_ERRORS} errores consecutivos user=${userId}, campaña ${campanaId} → ERRORES_CONSECUTIVOS`);
        break;
      }

      // Contacto bloqueado (opt-out / ban / no existe)
      if (blockedNumbers.has(msg.numero_destino)) {
        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: { estado: "FALLIDO", error_detalle: "Contacto bloqueado / opt-out" },
        });
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { fallidos: { increment: 1 } },
        });
        continue;
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

      // Rate-limit por JID
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

      // Validar que el número existe en WA antes de gastar envío.
      // Números inexistentes cuentan en el algoritmo anti-spam de WA.
      try {
        const check = await sock.onWhatsApp(msg.numero_destino);
        const exists = Array.isArray(check) && check.length > 0 && check[0]?.exists;
        if (!exists) {
          await prisma.wa_mensajes.update({
            where: { id: msg.id },
            data: { estado: "FALLIDO", error_detalle: "Número no existe en WhatsApp" },
          });
          await prisma.wa_campanas.update({
            where: { id: campanaId },
            data: { fallidos: { increment: 1 } },
          });
          // Bloquear global para no reintentar en futuras campañas
          await this.blockContact(null, msg.numero_destino, "No existe en WhatsApp", "NO_EXISTE");
          blockedNumbers.add(msg.numero_destino);
          continue;
        }
      } catch (checkErr) {
        // Si el check falla, no bloqueamos — seguimos con el envío
        console.warn(`[MessageQueue] onWhatsApp check falló para ${msg.numero_destino}, continuando`);
      }

      try {
        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: { estado: "ENVIANDO" },
        });

        try {
          await sock.presenceSubscribe(jid);
          await sleep(1000);
          await sock.sendPresenceUpdate("composing", jid);
          await sleep(typingDelay(msg.mensaje_texto.length));
          await sock.sendPresenceUpdate("paused", jid);
        } catch (presenceErr) {
          console.warn(`[MessageQueue] Presence simulation failed for ${msg.numero_destino}`);
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

        // Marcar primer_envio_at si es la primera vez (warmup)
        await this.markFirstSend(userId);

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
          data: { estado: "FALLIDO", error_detalle: errorMsg.slice(0, 500) },
        });

        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { fallidos: { increment: 1 } },
        });
      }
    }

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
        data: { estado: pendientes > 0 ? "PAUSADA_MANUAL" : "COMPLETADA" },
      });
    }
  }
}

export const messageQueue = new MessageQueue();
