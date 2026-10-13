import type { VehicleWithImages } from "@/types/database";

export type VehicleFilters = {
  brand?: string;
  category?: string;
  yearMin?: number;
  yearMax?: number;
  priceMax?: number;
  search?: string;
  sort?: "price-asc" | "price-desc" | "year-desc" | "newest";
};

export function sortVehicles(list: VehicleWithImages[], sort?: VehicleFilters["sort"]): VehicleWithImages[] {
  const next = [...list];
  switch (sort) {
    case "price-asc":
      return next.sort((a, b) => a.price - b.price);
    case "price-desc":
      return next.sort((a, b) => b.price - a.price);
    case "year-desc":
      return next.sort((a, b) => b.year - a.year);
    default:
      return next;
  }
}

export function applyFilters(list: VehicleWithImages[], filters?: VehicleFilters): VehicleWithImages[] {
  const next = list.filter((v) => {
    if (!v.published) return false;
    if (filters?.brand && v.brand !== filters.brand) return false;
    if (filters?.category && v.category !== filters.category) return false;
    if (filters?.yearMin && v.year < filters.yearMin) return false;
    if (filters?.yearMax && v.year > filters.yearMax) return false;
    if (filters?.priceMax && v.price > filters.priceMax) return false;
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      if (!`${v.brand} ${v.model}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  return sortVehicles(next, filters?.sort);
}

export function parseSort(sort?: string | null): VehicleFilters["sort"] {
  if (sort === "price-asc" || sort === "price-desc" || sort === "year-desc") return sort;
  return undefined;
}

export function catalogFacets(all: VehicleWithImages[]) {
  return {
    brands: [...new Set(all.map((v) => v.brand))].sort(),
    categories: [...new Set(all.map((v) => v.category))].sort(),
    years: [...new Set(all.map((v) => v.year))].sort((a, b) => b - a),
  };
}