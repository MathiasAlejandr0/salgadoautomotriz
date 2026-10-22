import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { VehicleWithImages } from "@/types/database";
import { slugify } from "@/lib/utils";
import { annotateStock, type StockUnit } from "@/lib/vehicle-public";
import { drivePhotosFolderId, fetchSalgadoSheet, type SheetVehicle } from "@/lib/inventory/sheet";
import { indexPhotoFolders, listDriveFolder, photoUrlsForFolder } from "@/lib/inventory/drive";

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
};

let memory: CacheFile | null = null;
let inflight: Promise<StockUnit[]> | null = null;
let stockMemory: { savedAt: number; units: StockUnit[] } | null = null;

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

    const vehicles = assemble(rows, photos);
    await writeCache({ savedAt: Date.now(), vehicles });
    stockMemory = { savedAt: Date.now(), units: assemble(rows, new Map()) };
    return vehicles;
  } catch (err) {
    console.error("[salgado] sync", err);
    if (previous?.vehicles.length) return previous.vehicles;
    return [];
  }
}

/** Fichas sin fotos. Sirve para redirects: no espera a Drive. */
export async function loadStockRecords(): Promise<StockUnit[]> {
  if (stockMemory && Date.now() - stockMemory.savedAt < TTL_MS && stockMemory.units.length) {
    return stockMemory.units;
  }
  try {
    const { vehicles: rows } = await fetchSalgadoSheet();
    const units = assemble(rows, new Map());
    stockMemory = { savedAt: Date.now(), units };
    return units;
  } catch (err) {
    console.error("[salgado] stock", err);
    if (stockMemory?.units.length) return stockMemory.units;
    return [];
  }
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
