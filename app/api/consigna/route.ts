import { NextResponse } from "next/server";
import { clientIp, honeypotOk, isHoneypotTripped, rateLimit, readJsonLimited, tooManyRequests } from "@/lib/abuse";
import { canUseMockFallback, isSupabaseConfigured } from "@/lib/env";
import { escapeHtml } from "@/lib/html";
import { SITE } from "@/lib/site";
import { parseConsigna } from "@/lib/validation";

const MAX_BYTES = 7_000_000;

export async function POST(req: Request) {
  if (!rateLimit(`consigna:${clientIp(req)}`, 3, 30 * 60 * 1000)) return tooManyRequests();

  const parsedBody = await readJsonLimited(req, MAX_BYTES);
  if (!parsedBody.ok) return parsedBody.response;
  if (isHoneypotTripped(parsedBody.body)) return honeypotOk();

  const parsed = parseConsigna(parsedBody.body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const data = parsed.data;
  const mensaje = [
    "Consignación",
    `Patente: ${data.patente || "—"}`,
    `Marca: ${data.marca || "—"}`,
    `Modelo: ${data.modelo || "—"}`,
    `Año: ${data.year || "—"}`,
    `Km: ${data.kms || "—"}`,
    `Fotos: ${data.fotos.length}`,
    data.notas,
  ]
    .filter(Boolean)
    .join("\n");

  let saved = false;
  if (isSupabaseConfigured()) {
    try {
      const { createPublicClient } = await import("@/lib/supabase/public");
      const supabase = createPublicClient();
      const { error } = await supabase.from("contact_leads").insert({
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        mensaje,
      });
      if (error) {
        console.error("[consigna]", error.message);
      } else {
        saved = true;
      }
    } catch (err) {
      console.error("[consigna]", err);
    }
  }

  let mailed = false;
  const key = process.env.RESEND_API_KEY?.trim();
  if (key) {
    const to = process.env.CONSIGNA_TO?.trim() || SITE.email;
    const from = process.env.CONSIGNA_FROM?.trim() || `Salgado Automotriz <${SITE.email}>`;
    const titulo = [data.marca, data.modelo, data.year, data.patente].filter(Boolean).join(" ") || "sin ficha";
    const subject = `Consigna: ${titulo} · ${data.nombre}`.replace(/[\r\n]/g, " ").slice(0, 180);
    const payload: Record<string, unknown> = {
      from,
      to: [to],
      subject,
      html: `
        <h2>Nueva consignación — ${escapeHtml(SITE.name)}</h2>
        <p>Un cliente dejó su vehículo para que lo contacten.</p>
        <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
          <tr><td><b>Nombre</b></td><td>${escapeHtml(data.nombre)}</td></tr>
          <tr><td><b>WhatsApp</b></td><td>${escapeHtml(data.telefono)}</td></tr>
          <tr><td><b>Correo</b></td><td>${escapeHtml(data.email || "—")}</td></tr>
          <tr><td><b>Patente</b></td><td>${escapeHtml(data.patente || "—")}</td></tr>
          <tr><td><b>Marca</b></td><td>${escapeHtml(data.marca || "—")}</td></tr>
          <tr><td><b>Modelo</b></td><td>${escapeHtml(data.modelo || "—")}</td></tr>
          <tr><td><b>Año</b></td><td>${escapeHtml(data.year || "—")}</td></tr>
          <tr><td><b>Kilometraje</b></td><td>${escapeHtml(data.kms || "—")}</td></tr>
          <tr><td><b>Notas</b></td><td>${escapeHtml(data.notas || "—")}</td></tr>
          <tr><td><b>Fotos adjuntas</b></td><td>${data.fotos.length}</td></tr>
        </table>
      `,
      text: mensaje,
    };
    if (data.email) payload.reply_to = data.email;
    if (data.fotos.length) payload.attachments = data.fotos;

    try {
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      mailed = sent.ok;
      if (!sent.ok) console.error("[consigna] Resend", sent.status);
    } catch (err) {
      console.error("[consigna] Resend", err);
    }
  }

  if (saved || mailed) return NextResponse.json({ ok: true });

  if (canUseMockFallback()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  return NextResponse.json(
    { ok: false, error: "No se pudo registrar la consignación. Escríbenos por WhatsApp." },
    { status: 503 }
  );
}
