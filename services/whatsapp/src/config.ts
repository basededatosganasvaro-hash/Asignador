export const config = {
  port: Number(process.env.PORT || 3001),
  serviceSecret: process.env.WA_SERVICE_SECRET || "",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutos sin actividad → desconectar
  antiSpam: {
    delayMin: 8000,        // 8s mínimo entre mensajes
    delayMax: 25000,       // 25s máximo
    burstMin: 5,           // mínimo mensajes por ráfaga
    burstMax: 12,          // máximo mensajes por ráfaga
    burstPauseMin: 120000, // 2 min pausa entre ráfagas
    burstPauseMax: 420000, // 7 min pausa
    dailyLimit: 180,       // límite diario por número
  },
};
