import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { VehicleWithImages } from "@/types/database";
import { slugify } from "@/lib/utils";
import { annotateStock, type StockUnit } from "@/lib/vehicle-public";
import { drivePhotosFolderId, fetchSalgadoSheet, type SheetVehicle } from "@/lib/inventory/sheet";
import { indexPhotoFolders, listDriveFolder, photoUrlsForFolder } from "@/lib/inventory/drive";
import {
  deleteRetiredRecords,
  deleteStoredMedia,
  mergeRetiredSlugs,
  planRetirement,
  purgeRetiredMedia,
} from "@/lib/inventory/retirement";

const CACHE_PATHS = [
  path.join(os.tmpdir(), "salgado-inventory.json"),
  ...(process.env.NODE_ENV === "production"
    ? []
    : [path.join(process.cwd(), ".cache", "salgado-inventory.json")]),
];
const TTL_MS = 10 * 60 * 1000;
const PLACEHOLDER = "/placeholder-car.svg";

type CacheFile = {
  savedAt: number;
  vehicles: StockUnit[];
  retiredSlugs?: string[];
};

let memory: CacheFile | null = null;
let inflight: Promise<StockUnit[]> | null = null;
let stockMemory: { savedAt: number; units: StockUnit[] } | null = null;
let retiredMemory: string[] | null = null;

function locationRank(location: string): number {
  const value = location.toUpperCase();
  if (value.includes("PATIO")) return 0;
  if (value.includes("UNIDAD")) return 1;
  if (value.includes("CLIENTE")) return 2;
  return 3;
}

function markFeatured(list: VehicleWithImages[]): VehicleWithImages[] {
  const patio = list.filter((v) => /patio|cardonal|salgado/i.test(v.location ?? ""));
  const pool = (patio.length >= 3 ? patio : list).slice().sort((a, b) => b.price - a.price);
  const featured = new Set(pool.slice(0, 3).map((v) => v.id));
  return list.map((v) => ({ ...v, featured: featured.has(v.id) }));
}

function toVehicle(row: SheetVehicle, photos: string[], now: string, sequence: number): VehicleWithImages {
  const legacy = row.plate
    ? slugify(`${row.brand} ${row.model} ${row.year} ${row.plate}`)
    : slugify(`${row.brand} ${row.model} ${row.year}`);
  const id = `sa-${row.stockId || "x"}-${sequence}`;
  const images = (photos.length ? photos : [PLACEHOLDER]).map((storagePath, index) => ({
    id: `${id}-img-${index}`,
    vehicle_id: id,
    storage_path: storagePath,
    sort_order: index,
    created_at: now,
  }));

  return {
    id,
    slug: legacy,
    brand: row.brand,
    model: row.model,
    year: row.year,
    version: row.color || null,
    category: row.category,
    fuel: row.fuel,
    transmission: row.transmission,
    mileage: row.mileage,
    color: row.color || null,
    doors: null,
    engine: null,
    price: row.price,
    description: "",
    plate: row.plate || null,
    stock_id: row.stockId || null,
    location: row.location || null,
    origin: row.origin,
    status: "Disponible",
    published: true,
    featured: false,
    created_at: now,
    updated_at: now,
    vehicle_images: images,
  };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

async function photosByStockId(rows: SheetVehicle[], folderId: string): Promise<Map<string, string[]>> {
  const listing = await listDriveFolder(folderId);
  const folders = indexPhotoFolders(listing);
  const uniqueIds = [...new Set(rows.map((row) => row.stockId))];

  const pairs = await mapPool(uniqueIds, 8, async (stockId) => {
    const candidates = folders.get(stockId) ?? [];
    let best: string[] = [];
    for (const candidate of candidates) {
      try {
        const urls = await photoUrlsForFolder(candidate);
        if (urls.length > best.length) best = urls;
        if (best.length >= 4) break;
      } catch (err) {
        console.error(`[drive] ID ${stockId}`, err);
      }
    }
    return [stockId, best] as const;
  });

  return new Map(pairs);
}

function asStock(vehicles: VehicleWithImages[]): StockUnit[] | null {
  if (!vehicles.length) return null;
  const ready = vehicles.every(
    (vehicle) =>
      typeof (vehicle as StockUnit).branch === "string" &&
      Array.isArray((vehicle as StockUnit).legacySlugs)
  );
  return ready ? (vehicles as StockUnit[]) : null;
}

async function readCache(): Promise<CacheFile | null> {
  if (memory && Date.now() - memory.savedAt < TTL_MS && memory.vehicles.length) return memory;
  for (const filePath of CACHE_PATHS) {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as CacheFile;
      if (!Array.isArray(parsed.vehicles) || typeof parsed.savedAt !== "number") continue;
      if (!parsed.vehicles.length) continue;
      const stock = asStock(parsed.vehicles);
      if (!stock) continue;
      memory = { savedAt: parsed.savedAt, vehicles: stock };
      return memory;
    } catch {
      // el disco de la función puede ser de solo lectura
    }
  }
  return memory;
}

async function writeCache(file: CacheFile): Promise<void> {
  memory = file;
  for (const filePath of CACHE_PATHS) {
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(file));
    } catch (err) {
      console.error("[salgado] no se pudo guardar caché", err);
    }
  }
}

function preserveKnownPhotos(previous: StockUnit[] | undefined, next: StockUnit[]): StockUnit[] {
  if (!previous?.length) return next;
  const prior = new Map(previous.map((unit) => [unit.slug, unit]));
  return next.map((unit) => {
    const old = prior.get(unit.slug);
    const hadPhoto = old?.vehicle_images?.some(
      (image) => image.storage_path && !image.storage_path.includes("placeholder-car.svg")
    );
    return old && hadPhoto ? { ...unit, vehicle_images: old.vehicle_images } : unit;
  });
}

/** La planilla manda. Lo que falta sale del sitio. Drive no se borra. */
async function commitSheet(rows: SheetVehicle[], photos: Map<string, string[]> | null): Promise<StockUnit[]> {
  const previous = (await readCache()) ?? memory;
  const assembled = assemble(rows, photos ?? new Map());
  if (!assembled.length) {
    if (previous?.vehicles.length) return previous.vehicles;
    return [];
  }
  const retired = planRetirement(previous?.vehicles ?? [], assembled);
  if (retired.length) {
    await purgeRetiredMedia(retired, deleteStoredMedia);
    await deleteRetiredRecords(retired.flatMap((car) => car.slugs));
  }
  const retiredSlugs = mergeRetiredSlugs(previous?.retiredSlugs ?? [], retired, assembled);
  const vehicles = photos ? assembled : preserveKnownPhotos(previous?.vehicles, assembled);
  const savedAt = photos || !previous ? Date.now() : previous.savedAt;
  await writeCache({ savedAt, vehicles, retiredSlugs });
  retiredMemory = retiredSlugs;
  stockMemory = { savedAt: Date.now(), units: assembled };
  return vehicles;
}

function assemble(rows: SheetVehicle[], photos: Map<string, string[]>): StockUnit[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.stockId) continue;
    counts.set(row.stockId, (counts.get(row.stockId) ?? 0) + 1);
  }
  const now = new Date().toISOString();
  const ordered = rows.slice().sort((a, b) => locationRank(a.location) - locationRank(b.location));
  const vehicles = markFeatured(
    ordered.map((row, index) => {
      const ownPhotos =
        row.stockId && counts.get(row.stockId) === 1 ? (photos.get(row.stockId) ?? []) : [];
      return toVehicle(row, ownPhotos, now, index);
    })
  );
  if (!vehicles.length) throw new Error("La pestaña Salgado no tiene unidades vendibles");
  return annotateStock(vehicles);
}

async function refresh(): Promise<StockUnit[]> {
  const previous = await readCache();
  try {
    const { vehicles: rows, driveFolderId } = await fetchSalgadoSheet();
    const folderId = driveFolderId || drivePhotosFolderId();
    let photos = new Map<string, string[]>();
    try {
      photos = await photosByStockId(rows, folderId);
    } catch (err) {
      console.error("[drive] índice de fotos", err);
    }
    return await commitSheet(rows, photos);
  } catch (err) {
    console.error("[salgado] sync", err);
    if (previous?.vehicles.length) return previous.vehicles;
    return [];
  }
}

/** Fichas sin esperar a Drive. También retira lo que ya no está en la planilla. */
export async function loadStockRecords(): Promise<StockUnit[]> {
  if (stockMemory && Date.now() - stockMemory.savedAt < TTL_MS && stockMemory.units.length) {
    return stockMemory.units;
  }
  try {
    const { vehicles: rows } = await fetchSalgadoSheet();
    const published = await commitSheet(rows, null);
    return published.length ? assemble(rows, new Map()) : published;
  } catch (err) {
    console.error("[salgado] stock", err);
    if (stockMemory?.units.length) return stockMemory.units;
    return [];
  }
}

export async function loadRetiredSlugs(): Promise<Set<string>> {
  if (retiredMemory) return new Set(retiredMemory);
  const cached = await readCache();
  retiredMemory = cached?.retiredSlugs ?? [];
  return new Set(retiredMemory);
}

/** Inventario vivo: pestaña SALGADO AUTOMOTRIZ + fotos Drive por ID. */
export async function loadSalgadoCatalog(): Promise<StockUnit[]> {
  const cached = await readCache();
  if (cached && Date.now() - cached.savedAt < TTL_MS && cached.vehicles.length) {
    return cached.vehicles;
  }
  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
