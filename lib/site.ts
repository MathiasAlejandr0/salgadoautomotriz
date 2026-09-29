/**
 * Ficha pública del negocio.
 *
 * TODO(dueño): el WhatsApp real NO está en el código. Antes de salir a
 * producción define en Vercel:
 *   NEXT_PUBLIC_WHATSAPP_E164=569XXXXXXXX   (solo dígitos, con código de país)
 *   NEXT_PUBLIC_PHONE_DISPLAY="+56 9 XXXX XXXX"
 * Sin esas variables el sitio usa un placeholder (+56 9 1234 5678) que no
 * es el número de Salgado. No inventar el número aquí.
 *
 * La nota de Google solo se publica si el dueño confirma el dato:
 *   NEXT_PUBLIC_GOOGLE_RATING=4.9
 *   NEXT_PUBLIC_GOOGLE_RATING_COUNT=120
 */

const PLACEHOLDER_E164 = "56912345678";

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
const phoneRaw = phoneFromEnv || PLACEHOLDER_E164;

export const phoneIsPlaceholder = phoneFromEnv.length < 8;

export const SITE = {
  name: "Salgado Automotriz",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://salgadoautomotriz.cl").replace(/\/$/, ""),
  phone: process.env.NEXT_PUBLIC_PHONE_DISPLAY?.trim() || formatClPhone(phoneRaw),
  phoneRaw,
  phoneIsPlaceholder,
  email: "contacto@salgadoautomotriz.cl",
  address: "Cardonal #15, Puerto Montt",
  addressLine: "Cardonal #15",
  city: "Puerto Montt",
  region: "Región de Los Lagos",
  mapQuery: "Cardonal 15, Puerto Montt, Chile",
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
