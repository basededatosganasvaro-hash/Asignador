/**
 * Recursively converts BigInt values to strings for JSON serialization.
 */
export function serializeBigInt<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === "bigint") return String(data) as unknown as T;
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
