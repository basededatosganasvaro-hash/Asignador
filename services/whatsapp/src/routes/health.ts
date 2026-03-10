import { Router, Request, Response } from "express";
import { messageQueue } from "../services/message-queue.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const queueStats = messageQueue.getStats();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    queue: queueStats,
  });
});

export default router;
