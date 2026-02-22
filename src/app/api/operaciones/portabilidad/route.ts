import { NextRequest, NextResponse } from "next/server";
import { requireGestorOperaciones } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const createSchema = z.object({
  promotor_id: z.number().int().positive(),
  rfc_cliente: z.string().min(10).max(13),
  nombre_cliente: z.string().min(1).max(200),
  folio_portabilidad: z.string().min(1).max(100),
  evidencia_url: z.string().default(""),
});

export async function GET(request: NextRequest) {
  const { error } = await requireGestorOperaciones();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const nombre = searchParams.get("nombre");
  const rfc = searchParams.get("rfc");
  const folio = searchParams.get("folio");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  let query = supabaseAdmin
    .from("registros")
    .select("*")
    .order("created_at", { ascending: false });

  if (nombre) {
    query = query.ilike("nombre_cliente", `%${nombre}%`);
  }
  if (rfc) {
    query = query.ilike("rfc_cliente", `%${rfc}%`);
  }
  if (folio) {
    query = query.ilike("folio_portabilidad", `%${folio}%`);
  }
  if (desde) {
    query = query.gte("created_at", desde);
  }
  if (hasta) {
    query = query.lte("created_at", `${hasta}T23:59:59`);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: "Error al consultar registros" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await requireGestorOperaciones();
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.issues }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from("registros")
    .insert(parsed.data)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Error al crear registro" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
