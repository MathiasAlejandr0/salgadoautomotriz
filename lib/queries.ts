import type { VehicleWithImages, Review } from "@/types/database";
import { MOCK_REVIEWS, MOCK_VEHICLES } from "@/lib/mock-data";
import { canUseMockFallback, isSupabaseConfigured } from "@/lib/env";
import { sanitizeSearchTerm } from "@/lib/validation";

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

async function loadInventory(): Promise<VehicleWithImages[]> {
  const { loadSalgadoCatalog } = await import("@/lib/inventory/catalog");
  const sheet = await loadSalgadoCatalog();
  if (sheet.length) return sheet;
  if (!canUseMockFallback()) return [];
  return MOCK_VEHICLES;
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

function hasActiveFilters(filters?: VehicleFilters): boolean {
  return Boolean(
    filters?.brand ||
      filters?.category ||
      filters?.yearMin ||
      filters?.yearMax ||
      filters?.priceMax ||
      filters?.search
  );
}

/** Planilla solo si la tabla no existe o todavía no hay ninguna unidad. */
async function inventoryOrSheet(
  remote: VehicleWithImages[] | null,
  filters: VehicleFilters | undefined,
  probeEmpty: () => Promise<boolean>
): Promise<VehicleWithImages[]> {
  if (remote && remote.length > 0) return remote;
  if (remote && hasActiveFilters(filters)) {
    const emptyTable = await probeEmpty();
    if (!emptyTable) return [];
  }
  return applyFilters(await loadInventory(), filters);
}

export async function getFeaturedVehicles(limit = 6): Promise<VehicleWithImages[]> {
  const all = await getVehicles();
  return all.filter((v) => v.featured && v.published).slice(0, limit);
}

export async function getVehicles(filters?: VehicleFilters): Promise<VehicleWithImages[]> {
  if (!isSupabaseConfigured()) {
    return applyFilters(await loadInventory(), filters);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select("*, vehicle_images(*)")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (filters?.brand) query = query.eq("brand", filters.brand);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.yearMin) query = query.gte("year", filters.yearMin);
  if (filters?.yearMax) query = query.lte("year", filters.yearMax);
  if (filters?.priceMax) query = query.lte("price", filters.priceMax);
  if (filters?.search) {
    const q = sanitizeSearchTerm(filters.search);
    if (q) {
      query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%`);
    }
  }

  const data = await fromSupabase("vehicles", async () => query);
  const list = await inventoryOrSheet(data as VehicleWithImages[] | null, filters, async () => {
    const probe = await fromSupabase("vehicles-probe", async () =>
      supabase.from("vehicles").select("id").limit(1)
    );
    return !probe || (probe as { id: string }[]).length === 0;
  });
  return sortVehicles(list, filters?.sort);
}

export async function getVehicleBySlug(slug: string): Promise<VehicleWithImages | null> {
  const all = await getVehicles();
  return all.find((v) => v.slug === slug && v.published) ?? null;
}

export async function getPublishedReviews(limit = 6): Promise<Review[]> {
  if (!isSupabaseConfigured()) {
    if (!canUseMockFallback()) return [];
    return MOCK_REVIEWS.slice(0, limit);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const data = await fromSupabase("reviews", async () =>
    supabase
      .from("reviews")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit)
  );

  return (data as Review[] | null) ?? [];
}

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
