import { NextResponse } from "next/server";

type Bucket = number[];

const hits = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return raw.slice(0, 64);
}

/**
 * Límite por instancia de serverless. En Vercel no es global: Cloudflare
 * debe limitar /api/* además de esto.
 * Devuelve true si la petición está permitida.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  if (!hits.has(key) && hits.size >= MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest) hits.delete(oldest);
  }
  hits.set(key, recent);
  return true;
}

export function tooManyRequests() {
  return NextResponse.json(
    { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
    { status: 429 }
  );
}

class PayloadTooLarge extends Error {}

async function readBody(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PayloadTooLarge();
  }
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLarge();
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buf);
}

export async function readJsonLimited(
  req: Request,
  maxBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    const text = await readBody(req, maxBytes);
    if (!text.trim()) {
      return { ok: false, response: NextResponse.json({ error: "JSON inválido" }, { status: 400 }) };
    }
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch (err) {
    if (err instanceof PayloadTooLarge) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 }),
      };
    }
    return { ok: false, response: NextResponse.json({ error: "JSON inválido" }, { status: 400 }) };
  }
}

export function isHoneypotTripped(body: unknown): boolean {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const value = (body as Record<string, unknown>).company_website;
  return typeof value === "string" && value.trim().length > 0;
}

/** Respuesta silenciosa: no confirma al bot que el campo fue detectado. */
export function honeypotOk() {
  return NextResponse.json({ ok: true });
}
