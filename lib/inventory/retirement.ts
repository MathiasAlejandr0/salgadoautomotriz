/**
 * Un auto que ya no está en la planilla sale del catálogo.
 * Sus URLs conocidas responden 410 en este dominio.
 * Fotos y recorridos se borran del almacenamiento en esa misma lectura.
 */

export type MediaKind = "photo" | "tour";

export type StoredMedia = {
  kind: MediaKind;
  url: string;
  driveFileId: string | null;
  storagePath: string | null;
};

export type PublicationRecord = {
  slug: string;
  legacySlugs?: string[];
  stock_id?: string | null;
  plate?: string | null;
  vehicle_images?: { storage_path: string }[];
};

export type RetiredCar = {
  slugs: string[];
  media: StoredMedia[];
};

const PLACEHOLDER = "placeholder-car.svg";
const TOUR = /(^|[^a-z0-9])(360|tour|recorrido|spin)([^a-z0-9]|$)/i;

export function driveFileId(url: string): string | null {
  const fromHost = url.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  if (fromHost) return fromHost[1];
  const fromPath = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (fromPath) return fromPath[1];
  const fromQuery = url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return fromQuery ? fromQuery[1] : null;
}

export function mediaOf(unit: PublicationRecord): StoredMedia[] {
  const media: StoredMedia[] = [];
  for (const image of unit.vehicle_images ?? []) {
    const url = image.storage_path?.trim() ?? "";
    if (!url || url.includes(PLACEHOLDER)) continue;
    const remote = url.startsWith("http");
    media.push({
      kind: TOUR.test(url) ? "tour" : "photo",
      url,
      driveFileId: remote ? driveFileId(url) : null,
      storagePath: remote || url.startsWith("/") ? null : url,
    });
  }
  return media;
}

function keysOf(unit: PublicationRecord): string[] {
  const keys = [unit.slug, ...(unit.legacySlugs ?? [])];
  if (unit.stock_id) keys.push(`id:${unit.stock_id}`);
  if (unit.plate) keys.push(`plate:${unit.plate}`);
  return keys.map((key) => key.trim().toLowerCase()).filter(Boolean);
}

export function slugsOf(unit: PublicationRecord): string[] {
  return [...new Set([unit.slug, ...(unit.legacySlugs ?? [])].map((slug) => slug.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Compara la publicación anterior con la planilla nueva.
 * Una planilla vacía no retira nada: es un fallo de lectura, no un stock en cero.
 */
export function planRetirement(previous: PublicationRecord[], current: PublicationRecord[]): RetiredCar[] {
  if (!current.length) return [];
  const live = new Set(current.flatMap(keysOf));
  const retired: RetiredCar[] = [];
  for (const unit of previous) {
    if (keysOf(unit).some((key) => live.has(key))) continue;
    retired.push({ slugs: slugsOf(unit), media: mediaOf(unit) });
  }
  return retired;
}

export function mergeRetiredSlugs(previous: readonly string[], retired: RetiredCar[], current: PublicationRecord[]): string[] {
  const live = new Set(current.flatMap(slugsOf));
  const slugs = new Set(previous.map((slug) => slug.toLowerCase()));
  for (const car of retired) {
    for (const slug of car.slugs) slugs.add(slug);
  }
  return [...slugs].filter((slug) => !live.has(slug));
}

export async function purgeRetiredMedia(
  retired: RetiredCar[],
  remove: (media: StoredMedia) => Promise<void>
): Promise<StoredMedia[]> {
  const removed: StoredMedia[] = [];
  for (const car of retired) {
    for (const media of car.media) {
      await remove(media);
      removed.push(media);
    }
  }
  return removed;
}

/** Borra el archivo donde esté: Drive si hay token, y el objeto de Storage si la ruta es del bucket. */
export async function deleteStoredMedia(media: StoredMedia): Promise<void> {
  if (media.driveFileId) await trashDriveFile(media.driveFileId);
  if (media.storagePath) await removeStorageObject(media.storagePath);
}

async function trashDriveFile(id: string): Promise<void> {
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error(`[inventario] sin GOOGLE_DRIVE_ACCESS_TOKEN; la foto ${id} salió del sitio pero sigue en Drive`);
    return;
  }
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok && response.status !== 404) {
    console.error(`[inventario] Drive no borró ${id}: ${response.status}`);
  }
}

async function removeStorageObject(objectPath: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || url.includes("YOUR_PROJECT")) return;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const removed = await supabase.storage.from("vehicle-photos").remove([objectPath]);
  if (removed.error) console.error("[inventario] storage", objectPath, removed.error.message);
}

/** Saca de Postgres las fichas que ya no están en la planilla. Las fotos en cascada se van con la fila. */
export async function deleteRetiredRecords(slugs: string[]): Promise<void> {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!unique.length) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || url.includes("YOUR_PROJECT")) return;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("vehicles").delete().in("slug", unique);
  if (error) console.error("[inventario] no se pudo borrar la ficha retirada", error.message);
}
