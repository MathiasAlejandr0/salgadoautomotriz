import type { VehicleWithImages } from "@/types/database";
import { getVehicles } from "@/lib/queries";

export interface SearchOptions {
  brands: string[];
  modelsByBrand: Record<string, string[]>;
  allModels: string[];
  years: number[];
}

export function buildSearchOptions(vehicles: VehicleWithImages[]): SearchOptions {
  const brands = [...new Set(vehicles.map((v) => v.brand))].sort();
  const modelsByBrand: Record<string, string[]> = {};
  const years = [...new Set(vehicles.map((v) => v.year))].sort((a, b) => b - a);

  for (const v of vehicles) {
    if (!modelsByBrand[v.brand]) modelsByBrand[v.brand] = [];
    if (!modelsByBrand[v.brand].includes(v.model)) {
      modelsByBrand[v.brand].push(v.model);
    }
  }
  for (const brand of Object.keys(modelsByBrand)) {
    modelsByBrand[brand].sort();
  }

  const allModels = [...new Set(vehicles.map((v) => v.model))].sort();
  return { brands, modelsByBrand, allModels, years };
}

/** Opciones del buscador desde el inventario real (o mock si demo). */
export async function getSearchOptions(): Promise<SearchOptions> {
  const vehicles = await getVehicles();
  return buildSearchOptions(vehicles);
}
