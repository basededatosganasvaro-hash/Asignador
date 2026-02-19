import { WASocket } from "@whiskeysockets/baileys";
import { prisma } from "../lib/prisma";

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
        });
        if (!msg) continue;

        const updateData: Record<string, unknown> = {};

        // Determinar nuevo estado basado en el update
        if (update.update?.status === 3) {
          // DELIVERY_ACK = entregado
          updateData.estado = "ENTREGADO";
          updateData.entregado_at = new Date();
        } else if (update.update?.status === 4) {
          // READ = leído
          updateData.estado = "LEIDO";
          updateData.leido_at = new Date();
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.wa_mensajes.update({
            where: { id: msg.id },
            data: updateData,
          });

          // Actualizar contadores de la campaña
          if (updateData.estado === "ENTREGADO") {
            await prisma.wa_campanas.update({
              where: { id: msg.campana_id },
              data: { entregados: { increment: 1 } },
            });
          } else if (updateData.estado === "LEIDO") {
            await prisma.wa_campanas.update({
              where: { id: msg.campana_id },
              data: { leidos: { increment: 1 } },
            });
          }
        }
      } catch (err) {
        console.error(`[Interceptor] Error processing update for ${waMessageId}:`, err);
      }
    }
  });
}
