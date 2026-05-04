import express from "express";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import sessionsRouter from "./routes/sessions.js";
import campaignsRouter from "./routes/campaigns.js";
import { messageQueue } from "./services/message-queue.js";

// Handlers globales: una promesa colgada de Baileys (típicamente Boom 408
// "Timed Out" desde getUSyncDevices después de un disconnect) NO debe matar
// al servicio entero, que atiende a todos los usuarios.
process.on("unhandledRejection", (reason) => {
  const err = reason as { message?: string; output?: { statusCode?: number } } | undefined;
  console.error(
    `[WA Service] unhandledRejection: code=${err?.output?.statusCode ?? "?"} msg=${err?.message ?? String(reason)}`,
  );
});

process.on("uncaughtException", (err) => {
  console.error("[WA Service] uncaughtException:", err?.message ?? err);
});

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
