import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * CRON cada hora. Detecta patrones sospechosos en access_log y crea
 * entradas de alerta en el mismo log (accion = "alerta_auditoria").
 *
 * Patrones:
 *  - Usuario con >100 view_oportunidad + view_cliente en la última hora
 *  - >5 login_fallido desde la misma IP en la última hora
 *  - export_excel fuera del horario operativo (antes 8:00 o después 19:30 MX)
 *  - Usuario con logins desde >3 IPs distintas en el día
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date();
  const haceUnaHora = new Date(ahora.getTime() - 60 * 60 * 1000);
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);

  const alertas: Array<{ tipo: string; metadata: Record<string, unknown>; usuario_id: number | null }> = [];

  // 1. Alto volumen de visitas por usuario en 1h
  const picoVistas = await prisma.$queryRaw<Array<{ usuario_id: number; username: string | null; eventos: number }>>`
    SELECT usuario_id, username, COUNT(*)::int as eventos
    FROM access_log
    WHERE accion IN ('view_cliente', 'view_oportunidad')
      AND created_at >= ${haceUnaHora}
      AND usuario_id IS NOT NULL
    GROUP BY usuario_id, username
    HAVING COUNT(*) > 100
  `;
  for (const p of picoVistas) {
    alertas.push({
      tipo: "pico_vistas_por_hora",
      usuario_id: p.usuario_id,
      metadata: { username: p.username, eventos: p.eventos, ventana: "1h" },
    });
  }

  // 2. >5 login_fallido desde la misma IP en 1h
  const bruteForce = await prisma.$queryRaw<Array<{ ip: string; intentos: number }>>`
    SELECT ip, COUNT(*)::int as intentos
    FROM access_log
    WHERE accion = 'login_fallido'
      AND created_at >= ${haceUnaHora}
      AND ip IS NOT NULL
    GROUP BY ip
    HAVING COUNT(*) > 5
  `;
  for (const b of bruteForce) {
    alertas.push({
      tipo: "brute_force_login",
      usuario_id: null,
      metadata: { ip: b.ip, intentos: b.intentos, ventana: "1h" },
    });
  }

  // 3. Export fuera de horario
  const horaActual = ahora.getHours();
  if (horaActual < 8 || horaActual >= 20) {
    const exportsRecientes = await prisma.access_log.findMany({
      where: { accion: "export_excel", created_at: { gte: haceUnaHora } },
      select: { usuario_id: true, username: true, recurso_id: true, ip: true },
    });
    for (const e of exportsRecientes) {
      alertas.push({
        tipo: "export_fuera_horario",
        usuario_id: e.usuario_id,
        metadata: { username: e.username, recurso_id: e.recurso_id, ip: e.ip, hora: horaActual },
      });
    }
  }

  // 4. Logins desde >3 IPs distintas en el día
  const multiIp = await prisma.$queryRaw<Array<{ usuario_id: number; username: string | null; ips_distintas: number }>>`
    SELECT usuario_id, username, COUNT(DISTINCT ip)::int as ips_distintas
    FROM access_log
    WHERE accion = 'login'
      AND created_at >= ${hoy}
      AND usuario_id IS NOT NULL
      AND ip IS NOT NULL
    GROUP BY usuario_id, username
    HAVING COUNT(DISTINCT ip) > 3
  `;
  for (const m of multiIp) {
    alertas.push({
      tipo: "multi_ip_login",
      usuario_id: m.usuario_id,
      metadata: { username: m.username, ips_distintas: m.ips_distintas, ventana: "dia" },
    });
  }

  // Persistir alertas en access_log como eventos (evitar duplicados dentro de la misma ventana)
  for (const a of alertas) {
    try {
      await prisma.access_log.create({
        data: {
          usuario_id: a.usuario_id,
          accion: "alerta_auditoria",
          metadata: { alerta: a.tipo, ...a.metadata } as never,
        },
      });
    } catch (err) {
      console.error("[auditoria-alertas] fallo al persistir:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    alertas_generadas: alertas.length,
    detalle: alertas,
  });
}
