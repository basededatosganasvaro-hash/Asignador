import { prisma } from "../lib/prisma.js";
import { sessionManager } from "./session-manager.js";
import { humanDelay, burstSize, burstPause, typingDelay, sleep } from "../lib/anti-spam.js";
import { config } from "../config.js";
import { proto } from "@whiskeysockets/baileys";

interface QueueItem {
  campanaId: number;
  userId: number;
}

class MessageQueue {
  private queues: Map<number, QueueItem[]> = new Map(); // userId → queue
  private processing: Set<number> = new Set(); // userIds currently processing

  /** Encolar una campaña para envío */
  async enqueue(campanaId: number, userId: number): Promise<void> {
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }
    this.queues.get(userId)!.push({ campanaId, userId });

    // Si no está procesando, arrancar
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

    // Marcar mensajes pendientes como cancelados
    await prisma.wa_mensajes.updateMany({
      where: {
        campana_id: campanaId,
        estado: { in: ["PENDIENTE", "ENVIANDO"] },
      },
      data: { estado: "FALLIDO", error_detalle: "Campaña cancelada" },
    });
  }

  /** Procesar cola de un usuario */
  private async processCampaign(userId: number): Promise<void> {
    this.processing.add(userId);

    try {
      while (this.queues.get(userId)?.length) {
        const item = this.queues.get(userId)!.shift()!;
        await this.sendCampaign(item);
      }
    } finally {
      this.processing.delete(userId);
      this.queues.delete(userId);
    }
  }

  /** Enviar todos los mensajes de una campaña */
  private async sendCampaign(item: QueueItem): Promise<void> {
    const { campanaId, userId } = item;

    // Verificar socket activo
    const sock = sessionManager.getSocket(userId);
    if (!sock) {
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "CANCELADA" },
      });
      return;
    }

    // Actualizar estado de campaña
    await prisma.wa_campanas.update({
      where: { id: campanaId },
      data: { estado: "ENVIANDO" },
    });

    // Obtener mensajes pendientes
    const mensajes = await prisma.wa_mensajes.findMany({
      where: { campana_id: campanaId, estado: "PENDIENTE" },
      orderBy: { id: "asc" },
    });

    // Verificar límite diario
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const enviadosHoy = await prisma.wa_mensajes.count({
      where: {
        campana: { usuario_id: userId },
        OR: [
          { enviado_at: { gte: hoy }, estado: { in: ["ENVIADO", "ENTREGADO", "LEIDO"] } },
          { estado: { in: ["PENDIENTE", "ENVIANDO"] }, created_at: { gte: hoy } },
        ],
      },
    });

    if (enviadosHoy >= config.antiSpam.dailyLimit) {
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "PAUSADA" },
      });
      console.log(`[MessageQueue] Daily limit reached for user ${userId}`);
      return;
    }

    let remaining = config.antiSpam.dailyLimit - enviadosHoy;
    let burstCount = 0;
    let currentBurstSize = burstSize();
    let msgIndex = 0;

    for (const msg of mensajes) {
      // Check campaña still active (every 5 messages to reduce DB queries)
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

      // Check daily limit
      if (remaining <= 0) {
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { estado: "PAUSADA" },
        });
        console.log(`[MessageQueue] Daily limit reached mid-campaign for user ${userId}`);
        break;
      }

      // Burst control
      if (burstCount >= currentBurstSize) {
        const pause = burstPause();
        console.log(`[MessageQueue] Burst pause ${Math.round(pause / 1000)}s for user ${userId}`);
        await sleep(pause);
        burstCount = 0;
        currentBurstSize = burstSize();
      }

      // Send message
      try {
        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: { estado: "ENVIANDO" },
        });

        // Format phone for WhatsApp
        const jid = `${msg.numero_destino}@s.whatsapp.net`;

        // Simulate typing (non-critical — don't block send on failure)
        try {
          await sock.presenceSubscribe(jid);
          await sleep(1000);
          await sock.sendPresenceUpdate("composing", jid);
          await sleep(typingDelay(msg.mensaje_texto.length));
          await sock.sendPresenceUpdate("paused", jid);
        } catch (presenceErr) {
          console.warn(`[MessageQueue] Presence simulation failed for ${msg.numero_destino}, proceeding with send`);
        }

        // Send
        const sent = await sock.sendMessage(jid, { text: msg.mensaje_texto });

        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: {
            estado: "ENVIADO",
            wa_message_id: sent?.key?.id || null,
            enviado_at: new Date(),
          },
        });

        // Update campaign counters
        await prisma.wa_campanas.update({
          where: { id: campanaId },
          data: { enviados: { increment: 1 } },
        });

        // Reset idle timer
        sessionManager.resetIdleTimer(userId);

        remaining--;
        burstCount++;

        // Human delay before next message
        const delay = humanDelay(msg.mensaje_texto.length);
        console.log(`[MessageQueue] Sent to ${msg.numero_destino}, next in ${Math.round(delay / 1000)}s`);
        await sleep(delay);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[MessageQueue] Failed to send to ${msg.numero_destino}:`, errorMsg);

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

    // Finalize campaign
    const campana = await prisma.wa_campanas.findUnique({
      where: { id: campanaId },
      select: { estado: true },
    });
    if (campana?.estado === "ENVIANDO") {
      await prisma.wa_campanas.update({
        where: { id: campanaId },
        data: { estado: "COMPLETADA" },
      });
    }
  }
}

export const messageQueue = new MessageQueue();
