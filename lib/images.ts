import type { VehicleWithImages } from "@/types/database";
import { DEMO_IMAGES } from "@/lib/mock-data";
import { canUseMockFallback } from "@/lib/env";

/** Sin foto real: placeholder propio (nunca una foto de stock que parezca inventario). */
const FALLBACK = "/placeholder-car.svg";

export function getStorageImageUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  return `/uploads/${storagePath.replace(/^\/+/, "")}`;
}

function resolveImagePath(storagePath: string, slug: string): string {
  if (storagePath.startsWith("http") || storagePath.startsWith("/")) return storagePath;
  if (storagePath.startsWith("demo/")) {
    return canUseMockFallback() ? (DEMO_IMAGES[slug] ?? FALLBACK) : FALLBACK;
  }
  return getStorageImageUrl(storagePath);
}

export function resolveVehicleImage(vehicle: VehicleWithImages): string {
  const first = vehicle.vehicle_images?.[0];
  if (first) {
    const resolved = resolveImagePath(first.storage_path, vehicle.slug);
    if (resolved !== FALLBACK || first.storage_path.startsWith("http")) {
      return resolved;
    }
    if (!first.storage_path.startsWith("demo/")) return resolved;
  }

  // Demo assets solo cuando el fallback mock está permitido
  if (canUseMockFallback() && DEMO_IMAGES[vehicle.slug]) {
    return DEMO_IMAGES[vehicle.slug];
  }

  return FALLBACK;
}

/** Miniatura WebP (generada por el backend) para tarjetas y tiras; si no hay, la foto grande. */
export function resolveVehicleThumb(vehicle: VehicleWithImages): string {
  const first = (vehicle.vehicle_images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  if (first?.thumb_path) return first.thumb_path;
  return resolveVehicleImage(vehicle);
}

/** Miniaturas de la galería, alineadas con resolveVehicleGallery. */
export function resolveVehicleGalleryThumbs(vehicle: VehicleWithImages): string[] {
  const images = (vehicle.vehicle_images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const img of images) {
    const full = resolveImagePath(img.storage_path, vehicle.slug);
    if (!full || seen.has(full)) continue;
    seen.add(full);
    out.push(img.thumb_path || full);
  }
  return out.length ? out : [resolveVehicleImage(vehicle)];
}

/** Galería real (sin duplicar ni badges inventados). */
export function resolveVehicleGallery(vehicle: VehicleWithImages): string[] {
  const images = (vehicle.vehicle_images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => resolveImagePath(img.storage_path, vehicle.slug));

  const unique = [...new Set(images.filter(Boolean))];
  if (unique.length > 0) return unique;
  return [resolveVehicleImage(vehicle)];
}
