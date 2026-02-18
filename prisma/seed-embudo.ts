import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // =============================================
  // ETAPAS
  // =============================================
  const etapasData = [
    { nombre: "Asignado",         orden: 1, tipo: "AVANCE", timer_horas: 72,   color: "#1565c0" },
    { nombre: "Contactado",       orden: 2, tipo: "AVANCE", timer_horas: 48,   color: "#2196f3" },
    { nombre: "Interesado",       orden: 3, tipo: "AVANCE", timer_horas: 72,   color: "#4caf50" },
    { nombre: "Negociacion",      orden: 4, tipo: "AVANCE", timer_horas: 48,   color: "#ff9800" },
    { nombre: "Venta",            orden: 5, tipo: "FINAL",  timer_horas: null, color: "#66bb6a" },
    { nombre: "No contactado",    orden: 6, tipo: "SALIDA", timer_horas: null, color: "#ef9a9a" },
    { nombre: "No interesado",    orden: 7, tipo: "SALIDA", timer_horas: null, color: "#ef5350" },
    { nombre: "Negociacion caida",orden: 8, tipo: "SALIDA", timer_horas: null, color: "#b71c1c" },
    { nombre: "Descartado",       orden: 9, tipo: "FINAL",  timer_horas: null, color: "#9e9e9e" },
  ];

  const etapas: Record<string, number> = {};
  for (const e of etapasData) {
    const etapa = await prisma.embudo_etapas.upsert({
      where: { id: etapasData.indexOf(e) + 1 },
      update: e,
      create: e,
    });
    etapas[e.nombre] = etapa.id;
    console.log(`✓ Etapa: ${etapa.nombre} (id: ${etapa.id})`);
  }

  // =============================================
  // TRANSICIONES
  // =============================================
  const transicionesData = [
    // Desde Asignado
    { origen: "Asignado",      destino: "Contactado",       accion: "Marcar contactado",       nota: true,  sup: false, pool: false },
    { origen: "Asignado",      destino: "No contactado",    accion: "No se logro contactar",   nota: true,  sup: false, pool: false },
    // Desde Contactado
    { origen: "Contactado",    destino: "Interesado",       accion: "Cliente interesado",      nota: true,  sup: false, pool: false },
    { origen: "Contactado",    destino: "No interesado",    accion: "Cliente no interesado",   nota: true,  sup: false, pool: false },
    // Desde Interesado
    { origen: "Interesado",    destino: "Negociacion",      accion: "Iniciar negociacion",     nota: true,  sup: false, pool: false },
    { origen: "Interesado",    destino: "No interesado",    accion: "Perdio interes",          nota: true,  sup: false, pool: false },
    // Desde Negociacion
    { origen: "Negociacion",   destino: "Venta",            accion: "Registrar venta",         nota: true,  sup: false, pool: false },
    { origen: "Negociacion",   destino: "Negociacion caida",accion: "Negociacion fallida",     nota: true,  sup: false, pool: false },
    // Desde No contactado (supervisor)
    { origen: "No contactado", destino: null,               accion: "Devolver al pool",        nota: false, sup: true,  pool: true  },
    // Desde No interesado (supervisor)
    { origen: "No interesado", destino: "Interesado",       accion: "Retomar cliente",         nota: true,  sup: true,  pool: false },
    { origen: "No interesado", destino: null,               accion: "Devolver al pool",        nota: false, sup: true,  pool: true  },
    // Desde Negociacion caida (supervisor)
    { origen: "Negociacion caida", destino: "Interesado",   accion: "Retomar cliente",         nota: true,  sup: true,  pool: false },
    { origen: "Negociacion caida", destino: null,           accion: "Devolver al pool",        nota: false, sup: true,  pool: true  },
    // Descartado (manual por supervisor)
    { origen: "Interesado",    destino: "Descartado",       accion: "Descartar cliente",       nota: true,  sup: true,  pool: false },
  ];

  let count = 0;
  for (const t of transicionesData) {
    const origenId = etapas[t.origen];
    const destinoId = t.destino ? etapas[t.destino] : null;

    await prisma.embudo_transiciones.create({
      data: {
        etapa_origen_id:     origenId,
        etapa_destino_id:    destinoId,
        nombre_accion:       t.accion,
        requiere_nota:       t.nota,
        requiere_supervisor: t.sup,
        devuelve_al_pool:    t.pool,
      },
    });
    count++;
  }
  console.log(`✓ ${count} transiciones creadas`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
