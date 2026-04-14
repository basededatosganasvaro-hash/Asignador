import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { prismaClientes } from "@/lib/prisma-clientes";
import ExcelJS from "exceljs";
import {
  FUENTES_CALIFICACION as FUENTES,
  type FuenteCalificacion as Fuente,
  parseRangoCalificacion,
} from "@/lib/calificacion-avance";

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A237E" } };
  });
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = req.nextUrl.searchParams;
  const tipoParam = url.get("tipo");
  const tipo =
    tipoParam && (FUENTES as readonly string[]).includes(tipoParam)
      ? (tipoParam as Fuente)
      : null;
  const { gte, lte } = parseRangoCalificacion(url);

  const [univIeppo, univCdmx, univPens, rondas, histGroups, rangoGroups, lotesRango, groupsProm, lotesCount, lastLotes, groupsRetro, catalogo] =
    await Promise.all([
      prismaClientes.clientes.count({ where: { tipo_cliente: "Cartera para calificar IEPPO" } }),
      prisma.clientes_cdmx.count(),
      prisma.clientes_pensionados.count(),
      prisma.rondas_calificacion.findMany(),
      prisma.calificaciones_promotor.groupBy({
        by: ["tipo"],
        where: { calificado: true },
        _count: { _all: true },
      }),
      prisma.calificaciones_promotor.groupBy({
        by: ["tipo", "calificado"],
        where: { lote: { fecha: { gte, lte } } },
        _count: { _all: true },
      }),
      prisma.lotes_calificacion_promotor.findMany({
        where: { fecha: { gte, lte } },
        select: { promotor_id: true, tipo: true, estado: true },
      }),
      prisma.calificaciones_promotor.groupBy({
        by: ["promotor_id", "tipo", "calificado"],
        where: { lote: { fecha: { gte, lte } }, ...(tipo ? { tipo } : {}) },
        _count: { _all: true },
      }),
      prisma.lotes_calificacion_promotor.groupBy({
        by: ["promotor_id"],
        where: { fecha: { gte, lte }, ...(tipo ? { tipo } : {}) },
        _count: { _all: true },
      }),
      prisma.lotes_calificacion_promotor.groupBy({
        by: ["promotor_id"],
        where: { fecha: { gte, lte }, ...(tipo ? { tipo } : {}) },
        _max: { fecha: true },
      }),
      prisma.calificaciones_promotor.groupBy({
        by: ["retroalimentacion_id"],
        where: { calificado: true, lote: { fecha: { gte, lte } }, ...(tipo ? { tipo } : {}) },
        _count: { _all: true },
      }),
      prisma.catalogo_retroalimentacion.findMany({ orderBy: { id: "asc" } }),
    ]);

  const universo: Record<Fuente, number> = { IEPPO: univIeppo, CDMX: univCdmx, PENSIONADOS: univPens };
  const rondaByTipo: Record<string, number> = {};
  rondas.forEach((r) => (rondaByTipo[r.tipo] = r.ronda_actual));
  const histByTipo: Record<string, number> = {};
  histGroups.forEach((g) => (histByTipo[g.tipo] = g._count._all));

  const asignadosR: Record<Fuente, number> = { IEPPO: 0, CDMX: 0, PENSIONADOS: 0 };
  const calificadosR: Record<Fuente, number> = { IEPPO: 0, CDMX: 0, PENSIONADOS: 0 };
  rangoGroups.forEach((g) => {
    const f = g.tipo as Fuente;
    if (!(FUENTES as readonly string[]).includes(f)) return;
    asignadosR[f] += g._count._all;
    if (g.calificado) calificadosR[f] += g._count._all;
  });

  const promActivos: Record<Fuente, Set<number>> = { IEPPO: new Set(), CDMX: new Set(), PENSIONADOS: new Set() };
  const lotesEstados: Record<Fuente, { PENDIENTE: number; EN_PROCESO: number; DEVUELTO: number }> = {
    IEPPO: { PENDIENTE: 0, EN_PROCESO: 0, DEVUELTO: 0 },
    CDMX: { PENDIENTE: 0, EN_PROCESO: 0, DEVUELTO: 0 },
    PENSIONADOS: { PENDIENTE: 0, EN_PROCESO: 0, DEVUELTO: 0 },
  };
  lotesRango.forEach((l) => {
    const f = l.tipo as Fuente;
    if (!(FUENTES as readonly string[]).includes(f)) return;
    promActivos[f].add(l.promotor_id);
    const e = l.estado as keyof (typeof lotesEstados)[Fuente];
    if (e in lotesEstados[f]) lotesEstados[f][e]++;
  });

  const workbook = new ExcelJS.Workbook();

  // Hoja 1: Resumen
  const hResumen = workbook.addWorksheet("Resumen");
  hResumen.columns = [
    { header: "Fuente", key: "fuente", width: 15 },
    { header: "Ronda", key: "ronda", width: 10 },
    { header: "Universo", key: "universo", width: 14 },
    { header: "Calificados histórico", key: "calHist", width: 20 },
    { header: "% Avance total", key: "pctTotal", width: 16 },
    { header: "Asignados (rango)", key: "asignados", width: 18 },
    { header: "Calificados (rango)", key: "calificados", width: 20 },
    { header: "Pendientes (rango)", key: "pendientes", width: 18 },
    { header: "% Avance rango", key: "pctRango", width: 16 },
    { header: "Promotores activos", key: "promotores", width: 18 },
    { header: "Lotes pendientes", key: "lotesPend", width: 16 },
    { header: "Lotes en proceso", key: "lotesProc", width: 16 },
    { header: "Lotes devueltos", key: "lotesDev", width: 16 },
  ];
  styleHeader(hResumen);
  FUENTES.forEach((f) => {
    const univ = universo[f];
    const calHist = histByTipo[f] ?? 0;
    const asign = asignadosR[f];
    const cal = calificadosR[f];
    hResumen.addRow({
      fuente: f,
      ronda: rondaByTipo[f] ?? 1,
      universo: univ,
      calHist,
      pctTotal: univ > 0 ? `${((calHist / univ) * 100).toFixed(2)}%` : "—",
      asignados: asign,
      calificados: cal,
      pendientes: asign - cal,
      pctRango: asign > 0 ? `${((cal / asign) * 100).toFixed(2)}%` : "—",
      promotores: promActivos[f].size,
      lotesPend: lotesEstados[f].PENDIENTE,
      lotesProc: lotesEstados[f].EN_PROCESO,
      lotesDev: lotesEstados[f].DEVUELTO,
    });
  });

  // Hoja 2: Por Promotor
  const lotesMap = new Map(lotesCount.map((l) => [l.promotor_id, l._count._all]));
  const lastLoteMap = new Map(lastLotes.map((l) => [l.promotor_id, l._max.fecha]));
  const promotorIds = Array.from(
    new Set([...groupsProm.map((g) => g.promotor_id), ...lotesCount.map((l) => l.promotor_id)]),
  );
  const usuarios = await prisma.usuarios.findMany({
    where: { id: { in: promotorIds } },
    select: {
      id: true,
      nombre: true,
      username: true,
      sucursal: { select: { nombre: true } },
    },
  });

  type Agg = {
    nombre: string;
    username: string;
    sucursal: string;
    asignados: number;
    calificados: number;
    ieppo_a: number; ieppo_c: number;
    cdmx_a: number; cdmx_c: number;
    pens_a: number; pens_c: number;
    lotes: number;
    ultimo: string;
  };

  const agg: Record<number, Agg> = {};
  usuarios.forEach((u) => {
    agg[u.id] = {
      nombre: u.nombre,
      username: u.username,
      sucursal: u.sucursal?.nombre ?? "—",
      asignados: 0,
      calificados: 0,
      ieppo_a: 0, ieppo_c: 0,
      cdmx_a: 0, cdmx_c: 0,
      pens_a: 0, pens_c: 0,
      lotes: lotesMap.get(u.id) ?? 0,
      ultimo: lastLoteMap.get(u.id)?.toISOString().slice(0, 10) ?? "—",
    };
  });
  groupsProm.forEach((g) => {
    const row = agg[g.promotor_id];
    if (!row) return;
    row.asignados += g._count._all;
    if (g.calificado) row.calificados += g._count._all;
    if (g.tipo === "IEPPO") { row.ieppo_a += g._count._all; if (g.calificado) row.ieppo_c += g._count._all; }
    if (g.tipo === "CDMX") { row.cdmx_a += g._count._all; if (g.calificado) row.cdmx_c += g._count._all; }
    if (g.tipo === "PENSIONADOS") { row.pens_a += g._count._all; if (g.calificado) row.pens_c += g._count._all; }
  });

  const hProm = workbook.addWorksheet("Por Promotor");
  hProm.columns = [
    { header: "Promotor", key: "nombre", width: 28 },
    { header: "Username", key: "username", width: 18 },
    { header: "Sucursal", key: "sucursal", width: 22 },
    { header: "Lotes", key: "lotes", width: 10 },
    { header: "Último lote", key: "ultimo", width: 14 },
    { header: "Asignados", key: "asignados", width: 12 },
    { header: "Calificados", key: "calificados", width: 12 },
    { header: "Pendientes", key: "pendientes", width: 12 },
    { header: "% Avance", key: "pct", width: 10 },
    { header: "IEPPO asig", key: "ieppo_a", width: 12 },
    { header: "IEPPO cal", key: "ieppo_c", width: 12 },
    { header: "CDMX asig", key: "cdmx_a", width: 12 },
    { header: "CDMX cal", key: "cdmx_c", width: 12 },
    { header: "PENS asig", key: "pens_a", width: 12 },
    { header: "PENS cal", key: "pens_c", width: 12 },
  ];
  styleHeader(hProm);
  Object.values(agg)
    .sort((a, b) => b.asignados - a.asignados)
    .forEach((r) => {
      hProm.addRow({
        ...r,
        pendientes: r.asignados - r.calificados,
        pct: r.asignados > 0 ? `${((r.calificados / r.asignados) * 100).toFixed(1)}%` : "—",
      });
    });

  // Hoja 3: Retroalimentación
  const nombreById = new Map(catalogo.map((c) => [c.id, c.nombre]));
  const hRetro = workbook.addWorksheet("Retroalimentación");
  hRetro.columns = [
    { header: "Retroalimentación", key: "nombre", width: 32 },
    { header: "Total", key: "total", width: 12 },
  ];
  styleHeader(hRetro);
  groupsRetro
    .map((g) => ({
      nombre: g.retroalimentacion_id
        ? nombreById.get(g.retroalimentacion_id) ?? `Retro #${g.retroalimentacion_id}`
        : "Sin retroalimentación",
      total: g._count._all,
    }))
    .sort((a, b) => b.total - a.total)
    .forEach((r) => hRetro.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();
  const sufijo = tipo ? `_${tipo.toLowerCase()}` : "";
  const desde = gte.toISOString().slice(0, 10);
  const hasta = lte.toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=calificacion_avance${sufijo}_${desde}_${hasta}.xlsx`,
    },
  });
}
