import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseMockFallback, isSupabaseConfigured } from "@/lib/env";
import { parseFinancingLead } from "@/lib/validation";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseFinancingLead(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    if (canUseMockFallback()) {
      return NextResponse.json({ ok: true, demo: true });
    }
    return NextResponse.json(
      { error: "Servicio de financiamiento no configurado" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("financing_leads").insert({
      nombre: parsed.data.nombre,
      email: parsed.data.email,
      telefono: parsed.data.telefono,
      vehicle_slug: parsed.data.vehicle_slug,
      pie: parsed.data.pie,
      plazo: parsed.data.plazo,
      renta: parsed.data.renta,
      mensaje: parsed.data.mensaje,
    });

    if (error) {
      console.error("[financing-lead]", error.message);
      return NextResponse.json({ error: "No se pudo guardar el lead" }, { status: 500 });
    }
  } catch (err) {
    console.error("[financing-lead]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
