import { cache } from "react";
import type { VehicleWithImages } from "@/types/database";
import { MOCK_VEHICLES } from "@/lib/mock-data";
import { canUseMockFallback } from "@/lib/env";
import { applyFilters, catalogFacets, type VehicleFilters } from "@/lib/filters";

export type { VehicleFilters };

/**
 * Datos de BUILD (export estático para HostGator): la planilla manda.
 * En el sitio publicado los componentes vuelven a pedir /api/vehicles (PHP + MySQL),
 * así que precios, ventas y autos nuevos se ven sin recompilar.
 */
/** El sitio público nunca muestra kilometraje: se borra antes de llegar a páginas/RSC. */
function sinKilometraje(list: VehicleWithImages[]): VehicleWithImages[] {
  return list.map((v) => ({ ...v, mileage: null }));
}

async function loadInventoryRaw(): Promise<VehicleWithImages[]> {
  const { loadSalgadoCatalog } = await import("@/lib/inventory/catalog");
  const sheet = await loadSalgadoCatalog();
  if (sheet.length) return sheet;
  if (!canUseMockFallback()) return [];
  return MOCK_VEHICLES;
}

async function loadInventory(): Promise<VehicleWithImages[]> {
  return sinKilometraje(await loadInventoryRaw());
}

export const getVehicles = cache(async function getVehicles(filters?: VehicleFilters): Promise<VehicleWithImages[]> {
  return applyFilters(await loadInventory(), filters);
});

export async function getFeaturedVehicles(limit = 6): Promise<VehicleWithImages[]> {
  const all = await getVehicles();
  return all.filter((v) => v.featured && v.published).slice(0, limit);
}

export const getVehicleBySlug = cache(async function getVehicleBySlug(slug: string): Promise<VehicleWithImages | null> {
  const all = await getVehicles();
  return all.find((v) => v.slug === slug && v.published) ?? null;
});

export async function getCatalogPage(filters?: VehicleFilters) {
  const all = await getVehicles();
  return { vehicles: applyFilters(all, filters), ...catalogFacets(all) };
}