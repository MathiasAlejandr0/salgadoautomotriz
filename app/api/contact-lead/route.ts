import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseMockFallback, isSupabaseConfigured } from "@/lib/env";
import { parseContactLead } from "@/lib/validation";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseContactLead(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    if (canUseMockFallback()) {
      return NextResponse.json({ ok: true, demo: true });
    }
    return NextResponse.json(
      { error: "Servicio de contacto no configurado" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("contact_leads").insert({
      nombre: parsed.data.nombre,
      email: parsed.data.email,
      telefono: parsed.data.telefono,
      mensaje: parsed.data.mensaje,
      vehicle_slug: parsed.data.vehicle_slug,
    });

    if (error) {
      console.error("[contact-lead]", error.message);
      return NextResponse.json({ error: "No se pudo guardar el lead" }, { status: 500 });
    }
  } catch (err) {
    console.error("[contact-lead]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
