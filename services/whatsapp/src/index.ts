import express from "express";
import { config } from "./config";
import { authMiddleware } from "./middleware/auth";
import healthRouter from "./routes/health";
import sessionsRouter from "./routes/sessions";
import campaignsRouter from "./routes/campaigns";

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
});
