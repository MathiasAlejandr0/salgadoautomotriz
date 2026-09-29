import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { clientIp, honeypotOk, isHoneypotTripped, rateLimit, readJsonLimited, tooManyRequests } from "@/lib/abuse";
import { canUseMockFallback, isSupabaseConfigured } from "@/lib/env";
import { parseFinancingLead } from "@/lib/validation";

const MAX_BYTES = 32_000;

export async function POST(req: Request) {
  if (!rateLimit(`financing:${clientIp(req)}`, 5, 10 * 60 * 1000)) return tooManyRequests();

  const parsedBody = await readJsonLimited(req, MAX_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  if (isHoneypotTripped(parsedBody.body)) return honeypotOk();

  const parsed = parseFinancingLead(parsedBody.body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    if (canUseMockFallback()) {
      return NextResponse.json({ ok: true, demo: true });
    }
    return NextResponse.json({ error: "Servicio de financiamiento no configurado" }, { status: 503 });
  }

  try {
    const supabase = createPublicClient();
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
