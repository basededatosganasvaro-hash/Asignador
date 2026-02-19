import { Router, Request, Response } from "express";
import { sessionManager } from "../services/session-manager";

const router = Router();

/** POST /sessions/:userId/connect — Iniciar conexión WA */
router.post("/:userId/connect", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "userId inválido" });
    return;
  }

  try {
    // Iniciar conexión en background (no bloquea)
    sessionManager.connect(userId);
    res.json({ ok: true, message: "Conexión iniciada" });
  } catch (err) {
    console.error(`[Sessions] Error connecting user ${userId}:`, err);
    res.status(500).json({ error: "Error al conectar" });
  }
});

/** GET /sessions/:userId/qr — SSE stream para QR y eventos de conexión */
router.get("/:userId/qr", (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "userId inválido" });
    return;
  }

  // Configurar SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Registrar callback para eventos QR
  sessionManager.onQrEvent(userId, (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);

    // Si se conectó o desconectó, cerrar stream
    if (data.type === "connected" || data.type === "disconnected") {
      setTimeout(() => res.end(), 500);
    }
  });

  // Limpiar al cerrar conexión
  req.on("close", () => {
    sessionManager.removeQrCallback(userId);
  });
});

/** DELETE /sessions/:userId — Desconectar sesión WA */
router.delete("/:userId", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "userId inválido" });
    return;
  }

  try {
    await sessionManager.disconnect(userId);
    res.json({ ok: true, message: "Desconectado" });
  } catch (err) {
    console.error(`[Sessions] Error disconnecting user ${userId}:`, err);
    res.status(500).json({ error: "Error al desconectar" });
  }
});

/** GET /sessions/:userId/status — Estado de sesión */
router.get("/:userId/status", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    res.status(400).json({ error: "userId inválido" });
    return;
  }

  try {
    const status = await sessionManager.getStatus(userId);
    res.json(status);
  } catch (err) {
    console.error(`[Sessions] Error getting status for user ${userId}:`, err);
    res.status(500).json({ error: "Error al obtener estado" });
  }
});

export default router;
