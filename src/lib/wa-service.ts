/**
 * Cliente HTTP para comunicarse con el microservicio WhatsApp (Baileys)
 */

const WA_SERVICE_URL = process.env.WA_SERVICE_URL || "http://localhost:3001";
const WA_SERVICE_SECRET = process.env.WA_SERVICE_SECRET || "";

if (!WA_SERVICE_SECRET) {
  console.warn("[wa-service] WA_SERVICE_SECRET is empty — requests will be sent without authentication");
}

interface FetchOptions {
  method?: string;
  body?: unknown;
}

export async function waFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(`${WA_SERVICE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": WA_SERVICE_SECRET,
      },
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `WA Service error: ${res.status}`);
  }

  return res.json();
}
