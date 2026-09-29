export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

function asOptionalString(v: unknown, max = 2000): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length > max) return null;
  return t;
}

function asEmail(v: unknown): string | null {
  const s = asString(v, 254);
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

function asOptionalNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export interface ContactLeadInput {
  nombre: string;
  email: string;
  telefono: string | null;
  mensaje: string | null;
  vehicle_slug: string | null;
}

export function parseContactLead(body: unknown): ParseResult<ContactLeadInput> {
  if (!isRecord(body)) return { ok: false, error: "Cuerpo inválido" };
  const nombre = asString(body.nombre, 120);
  const email = asEmail(body.email);
  if (!nombre || nombre.length < 2 || !email) {
    return { ok: false, error: "Nombre y email válidos son requeridos" };
  }
  return {
    ok: true,
    data: {
      nombre,
      email,
      telefono: asOptionalString(body.telefono, 40),
      mensaje: asOptionalString(body.mensaje, 2000),
      vehicle_slug: asOptionalString(body.vehicle_slug, 120),
    },
  };
}

export interface FinancingLeadInput {
  nombre: string;
  email: string;
  telefono: string;
  vehicle_slug: string | null;
  pie: number | null;
  plazo: number | null;
  renta: number | null;
  mensaje: string | null;
}

export function parseFinancingLead(body: unknown): ParseResult<FinancingLeadInput> {
  if (!isRecord(body)) return { ok: false, error: "Cuerpo inválido" };
  const nombre = asString(body.nombre, 120);
  const email = asEmail(body.email);
  const telefono = asString(body.telefono, 40);
  if (!nombre || nombre.length < 2 || !email || !telefono || telefono.length < 8) {
    return { ok: false, error: "Nombre, email y teléfono son requeridos" };
  }

  const precio = asOptionalNumber(body.precio);
  const mensajeBase = asOptionalString(body.mensaje, 2000);
  const mensaje =
    mensajeBase ??
    (precio != null ? `Precio vehículo: $${Math.round(precio)}` : null);

  const pie = asOptionalNumber(body.pie);
  const plazo = asOptionalNumber(body.plazo);
  const renta = asOptionalNumber(body.renta);
  if (pie != null && (pie < 0 || pie > 500_000_000)) {
    return { ok: false, error: "El pie está fuera de rango" };
  }
  if (plazo != null && (plazo < 6 || plazo > 84)) {
    return { ok: false, error: "El plazo debe estar entre 6 y 84 meses" };
  }
  if (renta != null && (renta < 0 || renta > 500_000_000)) {
    return { ok: false, error: "La renta está fuera de rango" };
  }

  return {
    ok: true,
    data: {
      nombre,
      email,
      telefono,
      vehicle_slug: asOptionalString(body.vehicle_slug, 120),
      pie: pie == null ? null : Math.round(pie),
      plazo: plazo == null ? null : Math.round(plazo),
      renta: renta == null ? null : Math.round(renta),
      mensaje,
    },
  };
}

export function parseSignIn(body: unknown): ParseResult<{ email: string; password: string }> {
  if (!isRecord(body)) return { ok: false, error: "Cuerpo inválido" };
  const email = asEmail(body.email);
  const password = asString(body.password, 128);
  if (!email || !password) {
    return { ok: false, error: "Email y contraseña son requeridos" };
  }
  return { ok: true, data: { email, password } };
}

export interface ConsignaFoto {
  filename: string;
  content: string;
}

export interface ConsignaInput {
  nombre: string;
  telefono: string;
  email: string | null;
  patente: string;
  marca: string;
  modelo: string;
  year: string;
  kms: string;
  notas: string;
  fotos: ConsignaFoto[];
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function parseConsigna(body: unknown): ParseResult<ConsignaInput> {
  if (!isRecord(body)) return { ok: false, error: "Cuerpo inválido" };
  const nombre = asString(body.nombre, 120);
  const telefono = asString(body.telefono, 40);
  if (!nombre || nombre.length < 2 || !telefono || telefono.length < 8) {
    return { ok: false, error: "Faltan nombre o WhatsApp." };
  }

  const emailRaw = asOptionalString(body.email, 254);
  let email: string | null = null;
  if (emailRaw) {
    email = asEmail(emailRaw);
    if (!email) return { ok: false, error: "El correo no es válido." };
  }

  const patente = (asOptionalString(body.patente, 12) ?? "").toUpperCase();
  const marca = asOptionalString(body.marca, 60) ?? "";
  const modelo = asOptionalString(body.modelo, 80) ?? "";
  const year = asOptionalString(body.year, 4) ?? "";
  const kms = asOptionalString(body.kms, 20) ?? "";
  const notas = asOptionalString(body.notas, 2000) ?? "";

  if (!marca && !modelo && !patente) {
    return { ok: false, error: "Indica al menos marca, modelo o patente." };
  }
  if (year && !/^\d{4}$/.test(year)) {
    return { ok: false, error: "El año no es válido." };
  }

  const rawFotos = Array.isArray(body.fotos) ? body.fotos.slice(0, 8) : [];
  const fotos: ConsignaFoto[] = [];
  let total = 0;
  for (const item of rawFotos) {
    if (!isRecord(item)) continue;
    if (typeof item.data !== "string" || !item.data.trim()) continue;
    const data = item.data.trim().replace(/^data:[^;]+;base64,/, "");
    if (!data) continue;
    if (data.length > 900_000 || data.length % 4 !== 0 || !BASE64.test(data)) {
      return { ok: false, error: "Una de las fotos no es válida o pesa demasiado." };
    }
    total += data.length;
    if (total > 6_500_000) {
      return { ok: false, error: "Las fotos pesan demasiado en conjunto." };
    }
    const name = (asOptionalString(item.name, 80) ?? `foto-${fotos.length + 1}`).replace(/[^\w.\- ]+/g, "");
    fotos.push({ filename: name.endsWith(".jpg") ? name : `${name || "foto"}.jpg`, content: data });
  }

  return {
    ok: true,
    data: { nombre, telefono, email, patente, marca, modelo, year, kms, notas, fotos },
  };
}

/** Escapa caracteres peligrosos en filtros PostgREST .or() */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%(),]/g, " ").trim().slice(0, 80);
}
