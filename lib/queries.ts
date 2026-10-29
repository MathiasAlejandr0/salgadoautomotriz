import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { VehicleWithImages } from "@/types/database";
import { MOCK_VEHICLES } from "@/lib/mock-data";
import { canUseMockFallback } from "@/lib/env";
import { applyFilters, catalogFacets, type VehicleFilters } from "@/lib/filters";
import { fetchPublicApiVehicles } from "@/lib/inventory/public-api";
import { branchOf } from "@/lib/branch";
import { annotateStock, forPublic, type StockUnit } from "@/lib/vehicle-public";

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

let announcedApiGap = false;

const REDIRECT_START = "# BEGIN plate-redirects";
const REDIRECT_END = "# END plate-redirects";

const RULE_LINE = /^  RewriteRule \^catalogo\/detalle\/([a-z0-9-]+)\$ \/catalogo\/detalle\/([a-z0-9-]+) \[R=301,L\]$/;

type IndexEntry = {
  slug: string;
  legacy: string[];
  brand: string;
  model: string;
  year: number;
  price: number;
};

function sameVehicle(a: Pick<IndexEntry, "brand" | "model" | "year" | "price">, b: Pick<IndexEntry, "brand" | "model" | "year" | "price">): boolean {
  return (
    a.brand.trim().toLowerCase() === b.brand.trim().toLowerCase() &&
    a.model.trim().toLowerCase() === b.model.trim().toLowerCase() &&
    a.year === b.year &&
    a.price === b.price
  );
}

/** El índice anterior guarda el slug con patente. La API pública ya no trae la patente. */
async function readVehicleIndex(): Promise<IndexEntry[]> {
  try {
    const raw = await readFile(path.join(process.cwd(), "hostgator", "public", "vehicle-index.json"), "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Partial<IndexEntry>;
      if (typeof row.slug !== "string") return [];
      const legacy = Array.isArray(row.legacy) ? row.legacy.filter((slug): slug is string => typeof slug === "string") : [];
      return [
        {
          slug: row.slug.toLowerCase(),
          legacy,
          brand: typeof row.brand === "string" ? row.brand : "",
          model: typeof row.model === "string" ? row.model : "",
          year: typeof row.year === "number" ? row.year : 0,
          price: typeof row.price === "number" ? row.price : 0,
        },
      ];
    });
  } catch {
    return [];
  }
}

/** Se lee al cargar el módulo, antes de que otro worker reescriba el archivo. */
const seedIndexPromise = readVehicleIndex();

/** La URL vieja con patente responde 301 en este dominio, aunque quede el HTML anterior. */
async function writePlateRedirects(units: StockUnit[]): Promise<void> {
  const file = path.join(process.cwd(), "hostgator", "public", ".htaccess");
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return;
  }
  if (!text.includes(REDIRECT_START) || !text.includes(REDIRECT_END)) return;
  const previous = await seedIndexPromise;
  // Un worker cuya API falló no debe pisar el índice completo con solo la planilla.
  if (previous.length > 10 && units.length < previous.length * 0.5) {
    console.warn(
      `[salgado] no se recorta vehicle-index (${units.length} autos frente a ${previous.length} ya publicados)`
    );
    return;
  }
  const legacyBySlug = new Map(previous.map((entry) => [entry.slug, entry.legacy]));
  for (const unit of units) {
    if (unit.legacySlugs.length) continue;
    const legacy = legacyBySlug.get(unit.slug) ?? [];
    unit.legacySlugs = legacy.filter((slug) => slug !== unit.slug);
  }
  const current = new Set(units.map((unit) => unit.slug));
  for (const entry of previous) {
    if (current.has(entry.slug)) continue;
    const hits = units.filter((unit) => sameVehicle(unit, entry));
    if (hits.length !== 1 || hits[0].slug === entry.slug) continue;
    if (!hits[0].legacySlugs.includes(entry.slug)) hits[0].legacySlugs.push(entry.slug);
  }
  const generated = units.flatMap((unit) =>
    unit.legacySlugs
      .map((slug) => slug.trim().toLowerCase())
      .filter((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug !== unit.slug)
      .map((slug) => `  RewriteRule ^catalogo/detalle/${slug}$ /catalogo/detalle/${unit.slug} [R=301,L]`)
  );
  // No se borran 301 ya publicados si esta lectura de la planilla no los regenera.
  const bySource = new Map<string, string>();
  const blockStart = text.indexOf(REDIRECT_START);
  const blockEnd = text.indexOf(REDIRECT_END);
  for (const line of text.slice(blockStart, blockEnd).split("\n")) {
    const match = RULE_LINE.exec(line);
    if (match) bySource.set(match[1], line);
  }
  for (const line of generated) {
    const match = RULE_LINE.exec(line);
    if (match) bySource.set(match[1], line);
  }
  const destination = (line: string) => RULE_LINE.exec(line)?.[2] ?? "";
  const resolve = (slug: string, seen = new Set<string>()): string => {
    if (seen.has(slug)) return slug;
    const line = bySource.get(slug);
    if (!line) return slug;
    seen.add(slug);
    return resolve(destination(line), seen);
  };
  for (const [source, line] of bySource) {
    const dest = destination(line);
    const finalDest = resolve(dest);
    if (finalDest && finalDest !== dest && finalDest !== source) {
      bySource.set(source, `  RewriteRule ^catalogo/detalle/${source}$ /catalogo/detalle/${finalDest} [R=301,L]`);
    }
  }
  const rules = [...bySource.values()];
  const block = [REDIRECT_START, ...rules, `  ${REDIRECT_END}`].join("\n");
  const next = text.replace(new RegExp(`${REDIRECT_START}[\\s\\S]*?${REDIRECT_END}`), block);
  if (next !== text) await writeFile(file, next);
  const index = units.map((unit) => ({
    slug: unit.slug,
    legacy: unit.legacySlugs,
    brand: unit.brand,
    model: unit.model,
    year: unit.year,
    price: unit.price,
  }));
  await writeFile(path.join(process.cwd(), "hostgator", "public", "vehicle-index.json"), JSON.stringify(index));
}

async function loadInventoryRaw(): Promise<VehicleWithImages[]> {
  const { loadSalgadoCatalog } = await import("@/lib/inventory/catalog");
  const sheet = await loadSalgadoCatalog();
  const source = sheet.length ? sheet : canUseMockFallback() ? MOCK_VEHICLES : [];
  const units = annotateStock(source.map((vehicle) => ({ ...vehicle, mileage: null })));
  const api = await fetchPublicApiVehicles();
  const bySlug = new Map(units.map((unit) => [unit.slug, unit]));
  let added = 0;
  for (const vehicle of api) {
    if (bySlug.has(vehicle.slug)) continue;
    // El slug ya es el canónico de la API: no se vuelve a calcular.
    const unit: StockUnit = { ...vehicle, legacySlugs: [], branch: branchOf(vehicle.location) };
    bySlug.set(vehicle.slug, unit);
    added++;
  }
  const merged = [...bySlug.values()];
  if (added && !announcedApiGap) {
    announcedApiGap = true;
    console.log(`[salgado] fichas solo en la API (no estaban en la planilla): ${added}`);
  }
  await writePlateRedirects(merged);
  return merged.map(forPublic);
}

const loadInventory = cache(async function loadInventory(): Promise<VehicleWithImages[]> {
  return sinKilometraje(await loadInventoryRaw());
});

/**
 * Todas las fichas del build, también las que el catálogo oculta (`published: false`).
 * Así un auto temporalmente oculto conserva HTML con el CSS de este build y no queda
 * el index.html del export anterior. Si ya no está ni en la planilla ni en la API,
 * el deploy borra esa carpeta y Apache cae en la plantilla PHP.
 */
export const getDetailStaticVehicles = cache(async function getDetailStaticVehicles(): Promise<VehicleWithImages[]> {
  return loadInventory();
});

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