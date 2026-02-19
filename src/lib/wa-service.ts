/**
 * Cliente HTTP para comunicarse con el microservicio WhatsApp (Baileys)
 */

const WA_SERVICE_URL = process.env.WA_SERVICE_URL || "http://localhost:3001";
const WA_SERVICE_SECRET = process.env.WA_SERVICE_SECRET || "";

interface FetchOptions {
  method?: string;
  body?: unknown;
}

export async function waFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(`${WA_SERVICE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Service-Secret": WA_SERVICE_SECRET,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `WA Service error: ${res.status}`);
  }

  return res.json();
}
