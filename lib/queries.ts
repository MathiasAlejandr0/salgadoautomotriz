import { cache } from "react";
import type { VehicleWithImages, Review } from "@/types/database";
import { MOCK_REVIEWS, MOCK_VEHICLES } from "@/lib/mock-data";
import { canUseMockFallback, isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { annotateStock, forPublic, onSalgadoSite, type StockUnit } from "@/lib/vehicle-public";

export type VehicleFilters = {
  brand?: string;
  category?: string;
  yearMin?: number;
  yearMax?: number;
  priceMax?: number;
  search?: string;
  sort?: "price-asc" | "price-desc" | "year-desc" | "newest";
};

function applyFilters(
  list: VehicleWithImages[],
  filters?: VehicleFilters
): VehicleWithImages[] {
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

async function loadInventory(): Promise<StockUnit[]> {
  const { loadSalgadoCatalog } = await import("@/lib/inventory/catalog");
  const sheet = await loadSalgadoCatalog();
  if (sheet.length) return sheet;
  if (!canUseMockFallback()) return [];
  return annotateStock(MOCK_VEHICLES);
}

function sortVehicles(
  list: VehicleWithImages[],
  sort?: VehicleFilters["sort"]
): VehicleWithImages[] {
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

async function fromSupabase<T>(
  label: string,
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.error(`[queries:${label}]`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`[queries:${label}]`, err);
    return null;
  }
}

export async function getFeaturedVehicles(limit = 6): Promise<VehicleWithImages[]> {
  const all = await getVehicles();
  return all.filter((v) => v.featured && v.published).slice(0, limit);
}

async function loadAllUnits(): Promise<StockUnit[]> {
  if (!isSupabaseConfigured()) {
    return loadInventory();
  }

  const supabase = createPublicClient();
  const data = await fromSupabase("vehicles", async () =>
    supabase
      .from("vehicles")
      .select("*, vehicle_images(*)")
      .eq("published", true)
      .order("created_at", { ascending: false })
  );
  const remote = data as VehicleWithImages[] | null;
  if (remote && remote.length > 0) return annotateStock(remote);
  return loadInventory();
}

export const getStockUnits = cache(loadAllUnits);

export const getVehicles = cache(async function getVehicles(filters?: VehicleFilters): Promise<VehicleWithImages[]> {
  const list = (await getStockUnits()).filter(onSalgadoSite).map(forPublic);
  return applyFilters(list, filters);
});

export const getVehicleBySlug = cache(async function getVehicleBySlug(slug: string): Promise<VehicleWithImages | null> {
  let key = slug.trim().toLowerCase();
  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  const all = await getVehicles();
  return all.find((vehicle) => vehicle.slug.toLowerCase() === key && vehicle.published) ?? null;
});

export const getPublishedReviews = cache(async function getPublishedReviews(limit = 6): Promise<Review[]> {
  if (!isSupabaseConfigured()) {
    if (!canUseMockFallback()) return [];
    return MOCK_REVIEWS.slice(0, limit);
  }

  const supabase = createPublicClient();
  const data = await fromSupabase("reviews", async () =>
    supabase
      .from("reviews")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit)
  );

  return (data as Review[] | null) ?? [];
});

/** Una sola carga: facets + lista filtrada. */
export async function getCatalogPage(filters?: VehicleFilters): Promise<{
  vehicles: VehicleWithImages[];
  brands: string[];
  categories: string[];
  years: number[];
}> {
  const all = await getVehicles();
  return {
    vehicles: applyFilters(all, filters),
    brands: [...new Set(all.map((v) => v.brand))].sort(),
    categories: [...new Set(all.map((v) => v.category))].sort(),
    years: [...new Set(all.map((v) => v.year))].sort((a, b) => b - a),
  };
}

export async function getCatalogMeta(): Promise<{
  vehicles: VehicleWithImages[];
  brands: string[];
  categories: string[];
  years: number[];
}> {
  return getCatalogPage();
}

export async function getBrands(): Promise<string[]> {
  const { brands } = await getCatalogMeta();
  return brands;
}

export async function getCategories(): Promise<string[]> {
  const { categories } = await getCatalogMeta();
  return categories;
}
