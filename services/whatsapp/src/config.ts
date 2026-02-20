import { prisma } from "./lib/prisma.js";

export const ANTI_SPAM_DEFAULTS = {
  delayMin: 8000,        // 8s mínimo entre mensajes
  delayMax: 25000,       // 25s máximo
  burstMin: 5,           // mínimo mensajes por ráfaga
  burstMax: 12,          // máximo mensajes por ráfaga
  burstPauseMin: 120000, // 2 min pausa entre ráfagas
  burstPauseMax: 420000, // 7 min pausa
  dailyLimit: 180,       // límite diario por número
};

export type AntiSpamConfig = typeof ANTI_SPAM_DEFAULTS;

const KEY_MAP: Record<string, keyof AntiSpamConfig> = {
  wa_delay_min: "delayMin",
  wa_delay_max: "delayMax",
  wa_burst_min: "burstMin",
  wa_burst_max: "burstMax",
  wa_burst_pause_min: "burstPauseMin",
  wa_burst_pause_max: "burstPauseMax",
  wa_daily_limit: "dailyLimit",
};

/** Lee config anti-spam de BD, con fallback a defaults */
export async function loadAntiSpamConfig(): Promise<AntiSpamConfig> {
  try {
    const rows = await prisma.configuracion.findMany({
      where: { clave: { startsWith: "wa_" } },
    });

    const result = { ...ANTI_SPAM_DEFAULTS };
    for (const row of rows) {
      const field = KEY_MAP[row.clave];
      if (field) {
        const num = Number(row.valor);
        if (!isNaN(num) && num > 0) {
          result[field] = num;
        }
      }
    }
    return result;
  } catch (err) {
    console.warn("[Config] Failed to load anti-spam config from DB, using defaults:", err);
    return { ...ANTI_SPAM_DEFAULTS };
  }
}

export const config = {
  port: Number(process.env.PORT || 3001),
  serviceSecret: process.env.WA_SERVICE_SECRET || "",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutos sin actividad → desconectar
  antiSpam: ANTI_SPAM_DEFAULTS,
};
