import { prisma } from "./lib/prisma.js";

export const ANTI_SPAM_DEFAULTS = {
  delayMin: 8000,        // 8s mínimo entre mensajes
  delayMax: 25000,       // 25s máximo
  burstMin: 5,           // mínimo mensajes por ráfaga
  burstMax: 12,          // máximo mensajes por ráfaga
  burstPauseMin: 120000, // 2 min pausa entre ráfagas
  burstPauseMax: 420000, // 7 min pausa
  dailyLimit: 180,       // límite diario por número (cuenta madura)
  maxConcurrentCampaigns: 30, // campañas enviando simultáneamente (global)
  perJidCooldownMs: 5 * 60 * 1000, // 5 min mínimo entre mensajes al mismo destino
  // Warmup de cuentas nuevas: límite diario escalado por día desde primer envío
  warmupDia1: 30,
  warmupDia2: 60,
  warmupDia3: 120,
  // Ventana horaria de envío (hora local del servidor, Mexico)
  ventanaHoraInicio: 9,  // envío permitido desde las 09:00
  ventanaHoraFin: 20,    // envío bloqueado a partir de las 20:00
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
  wa_max_campanas_concurrentes: "maxConcurrentCampaigns",
  wa_per_jid_cooldown_ms: "perJidCooldownMs",
  wa_warmup_dia1: "warmupDia1",
  wa_warmup_dia2: "warmupDia2",
  wa_warmup_dia3: "warmupDia3",
  wa_ventana_hora_inicio: "ventanaHoraInicio",
  wa_ventana_hora_fin: "ventanaHoraFin",
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
