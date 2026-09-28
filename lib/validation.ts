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
  if (!nombre || !email) {
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
  if (!nombre || !email || !telefono) {
    return { ok: false, error: "Nombre, email y teléfono son requeridos" };
  }

  const precio = asOptionalNumber(body.precio);
  const mensajeBase = asOptionalString(body.mensaje, 2000);
  const mensaje =
    mensajeBase ??
    (precio != null ? `Precio vehículo: $${Math.round(precio)}` : null);

  return {
    ok: true,
    data: {
      nombre,
      email,
      telefono,
      vehicle_slug: asOptionalString(body.vehicle_slug, 120),
      pie: asOptionalNumber(body.pie),
      plazo: asOptionalNumber(body.plazo),
      renta: asOptionalNumber(body.renta),
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

/** Escapa caracteres peligrosos en filtros PostgREST .or() */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%(),]/g, " ").trim().slice(0, 80);
}
