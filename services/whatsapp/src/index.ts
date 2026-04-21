import express from "express";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import sessionsRouter from "./routes/sessions.js";
import campaignsRouter from "./routes/campaigns.js";
import { messageQueue } from "./services/message-queue.js";

const app = express();

app.use(express.json());

// Health check (sin auth)
app.use("/health", healthRouter);

// Auth middleware para todas las demás rutas
app.use(authMiddleware);

// Rutas protegidas
app.use("/sessions", sessionsRouter);
app.use("/campaigns", campaignsRouter);

app.listen(config.port, () => {
  console.log(`[WA Service] Running on port ${config.port}`);

  // Recuperar campañas huérfanas después de un reinicio
  setTimeout(() => {
    messageQueue.recoverOrphanedCampaigns().catch((err) => {
      console.error("[WA Service] Failed to recover orphaned campaigns:", err);
    });
  }, 5000);

  // Auto-reanudación periódica de campañas pausadas por motivos recuperables
  // (ESPERA_VENTANA, LIMITE_DIARIO, SIN_SESION, INTERRUMPIDA)
  const AUTO_RESUME_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    messageQueue.autoResume().catch((err) => {
      console.error("[WA Service] autoResume tick failed:", err);
    });
  }, AUTO_RESUME_INTERVAL_MS);
});
