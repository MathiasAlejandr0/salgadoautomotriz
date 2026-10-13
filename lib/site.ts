/**
 * Ficha pública del negocio.
 *
 * WhatsApp/teléfono: +56 9 9418 8305 (se puede sobrescribir con
 *   NEXT_PUBLIC_WHATSAPP_E164 y NEXT_PUBLIC_PHONE_DISPLAY).
 *
 * La nota de Google solo se publica si el dueño confirma el dato:
 *   NEXT_PUBLIC_GOOGLE_RATING=4.9
 *   NEXT_PUBLIC_GOOGLE_RATING_COUNT=120
 */

const DEFAULT_E164 = "56994188305";

function digits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function formatClPhone(e164: string): string {
  if (e164.startsWith("56") && e164.length === 11) {
    return `+56 ${e164.slice(2, 3)} ${e164.slice(3, 7)} ${e164.slice(7)}`;
  }
  return e164 ? `+${e164}` : "";
}

function readRating(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_RATING?.trim() ?? "";
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return raw;
}

function readRatingCount(): number | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_RATING_COUNT?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

const phoneFromEnv = digits(process.env.NEXT_PUBLIC_WHATSAPP_E164);
const phoneRaw = phoneFromEnv || DEFAULT_E164;

export const phoneIsPlaceholder = phoneRaw.length < 8;

export const SITE = {
  name: "Salgado Automotriz",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://salgadoautomotriz.cl").replace(/\/$/, ""),
  phone: process.env.NEXT_PUBLIC_PHONE_DISPLAY?.trim() || formatClPhone(phoneRaw),
  phoneRaw,
  phoneIsPlaceholder,
  email: "contacto@salgadoautomotriz.cl",
  address: "Av. Cardonal (ex Banco de Chile), Puerto Montt",
  addressLine: "Av. Cardonal (ex Banco de Chile)",
  city: "Puerto Montt",
  region: "Región de Los Lagos",
  mapQuery: "Av. Cardonal 15, Puerto Montt, Chile",
  googleRating: readRating(),
  googleRatingCount: readRatingCount(),
  hours: {
    weekdays: "Lun – Vie 9:00 – 19:00",
    saturday: "Sábado 10:00 – 17:00",
    sunday: "Domingo cerrado",
  },
};

export function waUrl(message: string): string {
  return `https://wa.me/${SITE.phoneRaw}?text=${encodeURIComponent(message)}`;
}
