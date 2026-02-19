import { Router, Request, Response } from "express";
import { sessionManager } from "../services/session-manager.js";

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
