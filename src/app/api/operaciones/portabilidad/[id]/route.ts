import { NextRequest, NextResponse } from "next/server";
import { requireGestorOperaciones } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const updateSchema = z.object({
  promotor_id: z.number().int().positive().optional(),
  rfc_cliente: z.string().min(10).max(13).optional(),
  nombre_cliente: z.string().min(1).max(200).optional(),
  folio_portabilidad: z.string().min(1).max(100).optional(),
  evidencia_url: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireGestorOperaciones();
  if (error) return error;

  const { id } = await params;
  const { data, error: dbError } = await supabaseAdmin
    .from("registros")
    .select("*")
    .eq("id", id)
    .single();

  if (dbError || !data) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireGestorOperaciones();
  if (error) return error;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.issues }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from("registros")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (dbError || !data) {
    return NextResponse.json({ error: "Error al actualizar registro" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireGestorOperaciones();
  if (error) return error;

  const { id } = await params;

  // Get registro to find evidencia files to delete
  const { data: registro } = await supabaseAdmin
    .from("registros")
    .select("evidencia_url")
    .eq("id", id)
    .single();

  if (registro?.evidencia_url) {
    // Parse evidencia_url: can be single string or JSON array
    let urls: string[] = [];
    try {
      const parsed = JSON.parse(registro.evidencia_url);
      urls = Array.isArray(parsed) ? parsed : [registro.evidencia_url];
    } catch {
      if (registro.evidencia_url) urls = [registro.evidencia_url];
    }

    // Delete files from storage
    const filePaths = urls
      .map((url: string) => {
        const match = url.match(/evidencias\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (filePaths.length > 0) {
      await supabaseAdmin.storage.from("evidencias").remove(filePaths);
    }
  }

  const { error: dbError } = await supabaseAdmin
    .from("registros")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: "Error al eliminar registro" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
