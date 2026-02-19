import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { messageQueue } from "../services/message-queue.js";
import { sessionManager } from "../services/session-manager.js";

const router = Router();

/** POST /campaigns — Crear y lanzar campaña */
router.post("/", async (req: Request, res: Response) => {
  const {
    nombre,
    mensaje_base,
    variaciones,
    etapa_filtro,
    destinatarios, // Array de { oportunidad_id, numero_destino, nombre_cliente }
  } = req.body;
  const usuario_id = Number(req.body.usuario_id);

  if (!usuario_id || !mensaje_base || !destinatarios?.length) {
    res.status(400).json({ error: "Faltan campos requeridos" });
    return;
  }

  // Verificar sesión activa
  if (!sessionManager.isConnected(usuario_id)) {
    res.status(400).json({ error: "WhatsApp no conectado" });
    return;
  }

  try {
    // Obtener sesión
    const sesion = await prisma.wa_sesiones.findUnique({
      where: { usuario_id },
    });
    if (!sesion) {
      res.status(400).json({ error: "Sesión no encontrada" });
      return;
    }

    // Preparar variaciones como array
    const variacionesArr: string[] = Array.isArray(variaciones) ? variaciones : [];

    // Crear campaña
    const campana = await prisma.wa_campanas.create({
      data: {
        usuario_id,
        sesion_id: sesion.id,
        nombre: nombre || `Campaña ${new Date().toLocaleDateString("es-MX")}`,
        mensaje_base,
        variaciones: variacionesArr.length > 0 ? variacionesArr : undefined,
        etapa_filtro: etapa_filtro || null,
        estado: "EN_COLA",
        total_mensajes: destinatarios.length,
      },
    });

    // Crear mensajes individuales con variaciones asignadas
    const mensajesData = destinatarios.map(
      (dest: { oportunidad_id: number; numero_destino: string; nombre_cliente: string }, idx: number) => {
        // Seleccionar variación o mensaje base
        const variacionIdx = variacionesArr.length > 0 ? idx % variacionesArr.length : 0;
        const textoBase = variacionesArr.length > 0 ? variacionesArr[variacionIdx] : mensaje_base;

        // Reemplazar variables
        const mensajeTexto = textoBase
          .replace(/\{nombre\}/g, dest.nombre_cliente || "")
          .replace(/\{numero\}/g, dest.numero_destino || "");

        return {
          campana_id: campana.id,
          oportunidad_id: dest.oportunidad_id,
          numero_destino: dest.numero_destino,
          mensaje_texto: mensajeTexto,
          variacion_idx: variacionIdx,
        };
      }
    );

    await prisma.wa_mensajes.createMany({ data: mensajesData });

    // Encolar para envío
    await messageQueue.enqueue(campana.id, usuario_id);

    res.json({
      ok: true,
      campana_id: campana.id,
      total_mensajes: destinatarios.length,
    });
  } catch (err) {
    console.error("[Campaigns] Error creating campaign:", err);
    res.status(500).json({ error: "Error al crear campaña" });
  }
});

/** GET /campaigns?usuario_id=X — Listar campañas de un usuario */
router.get("/", async (req: Request, res: Response) => {
  const usuarioId = Number(req.query.usuario_id);
  if (!usuarioId) {
    res.status(400).json({ error: "usuario_id requerido" });
    return;
  }

  try {
    const campanas = await prisma.wa_campanas.findMany({
      where: { usuario_id: usuarioId },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    res.json(campanas);
  } catch (err) {
    console.error("[Campaigns] Error listing campaigns:", err);
    res.status(500).json({ error: "Error al listar campañas" });
  }
});

/** GET /campaigns/:id — Detalle de campaña con contadores */
router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  try {
    const campana = await prisma.wa_campanas.findUnique({
      where: { id },
      include: {
        mensajes: {
          select: {
            id: true,
            numero_destino: true,
            estado: true,
            variacion_idx: true,
            enviado_at: true,
            entregado_at: true,
            leido_at: true,
            error_detalle: true,
          },
        },
      },
    });

    if (!campana) {
      res.status(404).json({ error: "Campaña no encontrada" });
      return;
    }

    res.json(campana);
  } catch (err) {
    console.error("[Campaigns] Error getting campaign:", err);
    res.status(500).json({ error: "Error al obtener campaña" });
  }
});

/** PATCH /campaigns/:id/pause — Pausar campaña */
router.patch("/:id/pause", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await messageQueue.pause(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Campaigns] Error pausing:", err);
    res.status(500).json({ error: "Error al pausar" });
  }
});

/** PATCH /campaigns/:id/resume — Reanudar campaña */
router.patch("/:id/resume", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await messageQueue.resume(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Campaigns] Error resuming:", err);
    res.status(500).json({ error: "Error al reanudar" });
  }
});

/** PATCH /campaigns/:id/cancel — Cancelar campaña */
router.patch("/:id/cancel", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await messageQueue.cancel(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Campaigns] Error cancelling:", err);
    res.status(500).json({ error: "Error al cancelar" });
  }
});

export default router;
