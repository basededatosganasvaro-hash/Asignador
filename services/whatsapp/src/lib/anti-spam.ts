import { config } from "../config.js";

const { antiSpam } = config;

/** Delay aleatorio humanizado entre mensajes */
export function humanDelay(messageLength: number): number {
  const base = Math.random() * (antiSpam.delayMax - antiSpam.delayMin) + antiSpam.delayMin;
  const typingFactor = (messageLength / 100) * 1000; // ~1s por cada 100 chars
  const jitter = (Math.random() - 0.5) * 3000;
  return Math.max(antiSpam.delayMin, base + typingFactor + jitter);
}

/** Tamaño aleatorio de ráfaga */
export function burstSize(): number {
  return Math.floor(Math.random() * (antiSpam.burstMax - antiSpam.burstMin + 1)) + antiSpam.burstMin;
}

/** Pausa aleatoria entre ráfagas */
export function burstPause(): number {
  return Math.random() * (antiSpam.burstPauseMax - antiSpam.burstPauseMin) + antiSpam.burstPauseMin;
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
