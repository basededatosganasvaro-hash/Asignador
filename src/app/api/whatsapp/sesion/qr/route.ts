import { requireAuth } from "@/lib/auth-utils";

const WA_SERVICE_URL = process.env.WA_SERVICE_URL || "http://localhost:3001";
const WA_SERVICE_SECRET = process.env.WA_SERVICE_SECRET || "";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user.id;

  // Proxy SSE desde microservicio
  const upstream = await fetch(`${WA_SERVICE_URL}/sessions/${userId}/qr`, {
    headers: { "X-Service-Secret": WA_SERVICE_SECRET },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Error conectando con servicio WA", { status: 502 });
  }

  // Stream passthrough
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
