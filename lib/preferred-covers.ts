import tokens from "@/hostgator/api/_lib/preferred_covers.json";
import type { VehicleImage } from "@/types/database";

/**
 * Misma regla que hostgator/api/_lib/preferred_covers.php.
 * La portada de tarjetas y ficha es la primera foto local; aquí la elegida
 * pasa a sort_order 0 sin borrar el resto.
 */
const COVERS = tokens as Record<string, string>;

const TOKEN = /^(?:drive:[A-Za-z0-9_-]{16,128}|curated:[a-f0-9]{12}\/\d{2})$/;

export type CoverImage = {
  storage_path: string;
  thumb_path?: string | null;
  drive_file_id?: string | null;
  sort_order: number;
};

export function preferredCoverToken(stockId: string | null | undefined): string | null {
  if (!stockId) return null;
  const token = COVERS[stockId];
  return typeof token === "string" && TOKEN.test(token) ? token : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pathHasDriveId(path: string, id: string): boolean {
  if (!path || !id) return false;
  const q = escapeRegExp(id);
  return (
    new RegExp(`/uploads/drive/${q}(?:_t)?\\.(?:webp|jpe?g|png)(?:$|[?#])`, "i").test(path) ||
    new RegExp(`googleusercontent\\.com/d/${q}(?:[=/?#]|$)`).test(path) ||
    new RegExp(`[?&]id=${q}(?:&|$)`).test(path)
  );
}

export function pathHasCuratedFile(path: string, rel: string): boolean {
  if (!path || !rel) return false;
  const q = escapeRegExp(rel);
  return new RegExp(`/uploads/curated/${q}(?:_t)?\\.webp(?:$|[?#])`, "i").test(path);
}

export function imageMatchesCoverToken(
  img: {
    storage_path?: string | null;
    thumb_path?: string | null;
    drive_file_id?: string | null;
  },
  token: string
): boolean {
  if (token.startsWith("drive:")) {
    const id = token.slice("drive:".length);
    if (img.drive_file_id && img.drive_file_id === id) return true;
    return [img.storage_path, img.thumb_path].some((path) => (path ? pathHasDriveId(path, id) : false));
  }
  if (token.startsWith("curated:")) {
    const rel = token.slice("curated:".length);
    return [img.storage_path, img.thumb_path].some((path) => (path ? pathHasCuratedFile(path, rel) : false));
  }
  return false;
}

function sortOrder(img: CoverImage): number {
  const n = Number(img.sort_order);
  return Number.isFinite(n) ? n : 0;
}

/** Orden de galería. La foto preferida, si está, queda primera. */
export function withPreferredCover<T extends CoverImage>(
  images: readonly T[],
  stockId: string | null | undefined
): T[] {
  const sorted = images
    .map((img, seq) => ({ img, seq }))
    .sort((a, b) => sortOrder(a.img) - sortOrder(b.img) || a.seq - b.seq)
    .map((row) => row.img);
  const token = preferredCoverToken(stockId);
  if (!token) return sorted;
  const idx = sorted.findIndex((img) => imageMatchesCoverToken(img, token));
  if (idx < 0) return sorted;
  const next = idx === 0 ? sorted.slice() : [sorted[idx], ...sorted.slice(0, idx), ...sorted.slice(idx + 1)];
  return next.map((img, sort_order) => ({ ...img, sort_order }));
}

export function hasLocalGallery(images: { storage_path?: string | null }[] | null | undefined): boolean {
  return (images ?? []).some((img) => {
    const path = img.storage_path ?? "";
    return path.startsWith("/") && !path.startsWith("//") && !path.includes("placeholder");
  });
}

/**
 * El build arma la ficha con la planilla, pero la galería publicada es la de
 * /api/vehicles (rutas /uploads). Si esa galería tiene fotos locales, reemplaza
 * a las URLs de Drive y aplica la portada preferida.
 */
export function takePublishedGallery<T extends { stock_id: string | null; vehicle_images: VehicleImage[] }>(
  current: T,
  published: { stock_id?: string | null; vehicle_images?: VehicleImage[] | null }
): T {
  const images = published.vehicle_images ?? [];
  if (!hasLocalGallery(images)) return current;
  const stockId = current.stock_id || published.stock_id || null;
  return {
    ...current,
    stock_id: current.stock_id ?? published.stock_id ?? null,
    vehicle_images: withPreferredCover(images, stockId),
  };
}
