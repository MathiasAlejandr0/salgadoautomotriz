import type { VehicleWithImages } from "@/types/database";

/** Sin foto real: placeholder propio (nunca una foto de stock que parezca inventario). */
const FALLBACK = "/placeholder-car.svg";

export function getStorageImageUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  return `/uploads/${storagePath.replace(/^\/+/, "")}`;
}

/**
 * Solo se muestran fotos alojadas en el sitio (/uploads/...). Las URLs remotas
 * (p. ej. lh3.googleusercontent.com de Drive) se ignoran: fallan con frecuencia
 * y el sync ya copia cada foto válida a /uploads.
 */
function isLocal(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//") && !path.includes("placeholder");
}

function localImages(vehicle: VehicleWithImages) {
  return (vehicle.vehicle_images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((img) => isLocal(img.storage_path));
}

export function resolveVehicleImage(vehicle: VehicleWithImages): string {
  return localImages(vehicle)[0]?.storage_path ?? FALLBACK;
}

/** Miniatura WebP (generada por el backend) para tarjetas y tiras; si no hay, la foto grande. */
export function resolveVehicleThumb(vehicle: VehicleWithImages): string {
  const first = localImages(vehicle)[0];
  if (!first) return FALLBACK;
  return isLocal(first.thumb_path) ? first.thumb_path : first.storage_path;
}

/** Miniaturas de la galería, alineadas con resolveVehicleGallery. */
export function resolveVehicleGalleryThumbs(vehicle: VehicleWithImages): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const img of localImages(vehicle)) {
    if (seen.has(img.storage_path)) continue;
    seen.add(img.storage_path);
    out.push(isLocal(img.thumb_path) ? img.thumb_path : img.storage_path);
  }
  return out.length ? out : [FALLBACK];
}

/** Galería real (solo fotos locales, sin duplicar). */
export function resolveVehicleGallery(vehicle: VehicleWithImages): string[] {
  const unique = [...new Set(localImages(vehicle).map((img) => img.storage_path))];
  return unique.length ? unique : [FALLBACK];
}
