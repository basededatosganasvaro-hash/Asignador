import { WASocket } from "@whiskeysockets/baileys";
import { prisma } from "../lib/prisma.js";

/**
 * Interceptor: se engancha a los eventos de Baileys para capturar
 * actualizaciones de estado de mensajes (entregado, leído, fallido)
 */
export function attachInterceptor(userId: number, sock: WASocket) {
  // Capturar actualizaciones de estado de mensajes
  sock.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      if (!update.key.id) continue;

      const waMessageId = update.key.id;

      try {
        // Buscar el mensaje en BD
        const msg = await prisma.wa_mensajes.findFirst({
          where: { wa_message_id: waMessageId },
          select: { id: true, estado: true, campana_id: true },
        });
        if (!msg) continue;

        // Determinar nuevo estado basado en el update
        let nuevoEstado: string | null = null;
        const updateData: Record<string, unknown> = {};

        if (update.update?.status === 3) {
          nuevoEstado = "ENTREGADO";
          updateData.entregado_at = new Date();
        } else if (update.update?.status === 4) {
          nuevoEstado = "LEIDO";
          updateData.leido_at = new Date();
        }

        if (!nuevoEstado) continue;

        // Solo actualizar si el estado realmente cambia (evita contadores duplicados)
        if (msg.estado === nuevoEstado) continue;

        updateData.estado = nuevoEstado;

        await prisma.wa_mensajes.update({
          where: { id: msg.id },
          data: updateData,
        });

        // Actualizar contadores de la campaña
        if (nuevoEstado === "ENTREGADO") {
          await prisma.wa_campanas.update({
            where: { id: msg.campana_id },
            data: { entregados: { increment: 1 } },
          });
        } else if (nuevoEstado === "LEIDO") {
          await prisma.wa_campanas.update({
            where: { id: msg.campana_id },
            data: { leidos: { increment: 1 } },
          });
        }
      } catch (err) {
        console.error(`[Interceptor] Error processing update for ${waMessageId}:`, err);
      }
    }
  });
}
