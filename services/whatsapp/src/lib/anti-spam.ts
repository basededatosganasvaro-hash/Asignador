import { config, type AntiSpamConfig } from "../config.js";

const defaults = config.antiSpam;

export interface AntiSpamOpts {
  delayMin?: number;
  delayMax?: number;
  burstMin?: number;
  burstMax?: number;
  burstPauseMin?: number;
  burstPauseMax?: number;
}

/** Delay aleatorio humanizado entre mensajes */
export function humanDelay(messageLength: number, opts?: AntiSpamOpts): number {
  const delayMin = opts?.delayMin ?? defaults.delayMin;
  const delayMax = opts?.delayMax ?? defaults.delayMax;
  const base = Math.random() * (delayMax - delayMin) + delayMin;
  const typingFactor = (messageLength / 100) * 1000; // ~1s por cada 100 chars
  const jitter = (Math.random() - 0.5) * 3000;
  return Math.max(delayMin, base + typingFactor + jitter);
}

/** Tamaño aleatorio de ráfaga */
export function burstSize(opts?: AntiSpamOpts): number {
  const burstMin = opts?.burstMin ?? defaults.burstMin;
  const burstMax = opts?.burstMax ?? defaults.burstMax;
  return Math.floor(Math.random() * (burstMax - burstMin + 1)) + burstMin;
}

/** Pausa aleatoria entre ráfagas */
export function burstPause(opts?: AntiSpamOpts): number {
  const burstPauseMin = opts?.burstPauseMin ?? defaults.burstPauseMin;
  const burstPauseMax = opts?.burstPauseMax ?? defaults.burstPauseMax;
  return Math.random() * (burstPauseMax - burstPauseMin) + burstPauseMin;
}

/** Delay para simular escritura según longitud del mensaje */
export function typingDelay(messageLength: number): number {
  const words = messageLength / 5; // ~5 chars por palabra
  const msPerWord = Math.random() * 200 + 150; // 150-350ms por palabra
  const pausaInicial = Math.random() * 2000 + 1000; // 1-3s antes de empezar
  return pausaInicial + (words * msPerWord);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
