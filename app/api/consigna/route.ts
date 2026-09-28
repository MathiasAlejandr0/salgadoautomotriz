import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SITE } from "@/lib/site";

type FotoIn = { name?: string; type?: string; data?: string };

type Body = {
  nombre?: string;
  telefono?: string;
  email?: string;
  patente?: string;
  marca?: string;
  modelo?: string;
  year?: string;
  kms?: string;
  notas?: string;
  fotos?: FotoIn[];
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const nombre = text(body.nombre);
  const telefono = text(body.telefono);
  const email = text(body.email);
  const patente = text(body.patente).toUpperCase();
  const marca = text(body.marca);
  const modelo = text(body.modelo);
  const year = text(body.year);
  const kms = text(body.kms);
  const notas = text(body.notas);

  if (!nombre || !telefono) {
    return NextResponse.json({ ok: false, error: "Faltan nombre o WhatsApp." }, { status: 400 });
  }
  if (!marca && !modelo && !patente) {
    return NextResponse.json({ ok: false, error: "Indica al menos marca, modelo o patente." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "El correo no es válido." }, { status: 400 });
  }

  const rawFotos = Array.isArray(body.fotos) ? body.fotos.slice(0, 8) : [];
  const attachments = rawFotos
    .map((f, i) => {
      const data = text(f.data).replace(/^data:[^;]+;base64,/, "");
      if (!data || data.length > 900_000) return null;
      return { filename: text(f.name) || `foto-${i + 1}.jpg`, content: data };
    })
    .filter((x): x is { filename: string; content: string } => Boolean(x));

  const mensaje = [
    "Consignación",
    `Patente: ${patente || "—"}`,
    `Marca: ${marca || "—"}`,
    `Modelo: ${modelo || "—"}`,
    `Año: ${year || "—"}`,
    `Km: ${kms || "—"}`,
    `Fotos: ${attachments.length}`,
    notas,
  ]
    .filter(Boolean)
    .join("\n");

  if (isSupabaseConfigured()) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.from("contact_leads").insert({
      nombre,
      email: email || "sin-correo@salgadoautomotriz.cl",
      telefono,
      mensaje,
    });
    if (error) {
      console.error("[consigna]", error.message);
      return NextResponse.json({ ok: false, error: "No se pudo guardar la consignación." }, { status: 500 });
    }
  }

  const key = process.env.RESEND_API_KEY?.trim();
  if (key) {
    const to = process.env.CONSIGNA_TO?.trim() || SITE.email;
    const from = process.env.CONSIGNA_FROM?.trim() || `Salgado Automotriz <${SITE.email}>`;
    const titulo = [marca, modelo, year, patente].filter(Boolean).join(" ") || "sin ficha";
    const payload: Record<string, unknown> = {
      from,
      to: [to],
      subject: `Consigna: ${titulo} · ${nombre}`,
      html: `
        <h2>Nueva consignación — ${esc(SITE.name)}</h2>
        <p>Un cliente dejó su vehículo para que lo contacten.</p>
        <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
          <tr><td><b>Nombre</b></td><td>${esc(nombre)}</td></tr>
          <tr><td><b>WhatsApp</b></td><td>${esc(telefono)}</td></tr>
          <tr><td><b>Correo</b></td><td>${esc(email || "—")}</td></tr>
          <tr><td><b>Patente</b></td><td>${esc(patente || "—")}</td></tr>
          <tr><td><b>Marca</b></td><td>${esc(marca || "—")}</td></tr>
          <tr><td><b>Modelo</b></td><td>${esc(modelo || "—")}</td></tr>
          <tr><td><b>Año</b></td><td>${esc(year || "—")}</td></tr>
          <tr><td><b>Kilometraje</b></td><td>${esc(kms || "—")}</td></tr>
          <tr><td><b>Notas</b></td><td>${esc(notas || "—")}</td></tr>
          <tr><td><b>Fotos adjuntas</b></td><td>${attachments.length}</td></tr>
        </table>
      `,
      text: mensaje,
    };
    if (email) payload.reply_to = email;
    if (attachments.length) payload.attachments = attachments;

    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!sent.ok) {
      console.error("[consigna] Resend", sent.status);
    }
  }

  return NextResponse.json({ ok: true });
}
