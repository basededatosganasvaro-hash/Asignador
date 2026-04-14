export const FUENTES_CALIFICACION = ["IEPPO", "CDMX", "PENSIONADOS"] as const;
export type FuenteCalificacion = (typeof FUENTES_CALIFICACION)[number];

export function parseRangoCalificacion(url: URLSearchParams): { gte: Date; lte: Date } {
  const desdeStr = url.get("desde");
  const hastaStr = url.get("hasta");
  const hasta = hastaStr ? new Date(hastaStr + "T23:59:59.999Z") : new Date();
  const gteDefault = new Date();
  gteDefault.setUTCDate(gteDefault.getUTCDate() - 6);
  gteDefault.setUTCHours(0, 0, 0, 0);
  const gte = desdeStr ? new Date(desdeStr + "T00:00:00.000Z") : gteDefault;
  return { gte, lte: hasta };
}
