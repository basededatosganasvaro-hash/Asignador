/**
 * Recursively converts BigInt values to strings for JSON serialization.
 */
export function serializeBigInt<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === "bigint") return String(data) as unknown as T;
  if (data instanceof Date) return data.toISOString() as unknown as T;
  if (Array.isArray(data)) return data.map(serializeBigInt) as unknown as T;
  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = serializeBigInt(value);
    }
    return result as T;
  }
  return data;
}

/**
 * Normaliza un row de BD Clientes: si `nombres` está vacío pero `nombre` (singular)
 * tiene el nombre completo (caso del archivo "Banco reestructurado IMSS PENSIONDOS NUEVOS"),
 * usa `nombre` como fallback. Idempotente: si ya hay `nombres`, no toca nada.
 *
 * Acepta cualquier objeto con campos opcionales `nombres` y `nombre`.
 */
export function normalizeCliente<T extends { nombres?: string | null; nombre?: string | null }>(
  cliente: T
): T {
  if (!cliente) return cliente;
  const nombres = cliente.nombres?.trim();
  if (!nombres && cliente.nombre?.trim()) {
    return { ...cliente, nombres: cliente.nombre };
  }
  return cliente;
}

