/**
 * In-memory cache for configuracion table.
 * TTL: 5 minutes. Reduces ~300-500 queries/min to ~1-5.
 */

const cache: Map<string, { value: string; expiry: number }> = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes

export async function getConfig(clave: string): Promise<string | null> {
  const cached = cache.get(clave);
  if (cached && Date.now() < cached.expiry) return cached.value;

  const { prisma } = await import("@/lib/prisma");
  const config = await prisma.configuracion.findUnique({ where: { clave } });
  if (config) {
    cache.set(clave, { value: config.valor, expiry: Date.now() + TTL });
  }
  return config?.valor ?? null;
}

export async function getConfigBatch(
  claves: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const clave of claves) {
    const cached = cache.get(clave);
    if (cached && Date.now() < cached.expiry) {
      result[clave] = cached.value;
    } else {
      missing.push(clave);
    }
  }

  if (missing.length > 0) {
    const { prisma } = await import("@/lib/prisma");
    const configs = await prisma.configuracion.findMany({
      where: { clave: { in: missing } },
    });
    for (const c of configs) {
      cache.set(c.clave, { value: c.valor, expiry: Date.now() + TTL });
      result[c.clave] = c.valor;
    }
  }
  return result;
}

export function invalidateConfig(clave?: string) {
  if (clave) cache.delete(clave);
  else cache.clear();
}
