import type { VehicleWithImages } from "@/types/database";
import { DEMO_IMAGES } from "@/lib/mock-data";
import { canUseMockFallback } from "@/lib/env";

const FALLBACK =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

export function getStorageImageUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/vehicle-photos/${storagePath}`;
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
