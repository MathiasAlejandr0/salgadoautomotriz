import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VehicleWithImages } from "@/types/database";
import { slugify } from "@/lib/utils";
import { drivePhotosFolderId, fetchSalgadoSheet, type SheetVehicle } from "@/lib/inventory/sheet";
import { indexPhotoFolders, listDriveFolder, photoUrlsForFolder } from "@/lib/inventory/drive";

const CACHE_PATH = path.join(process.cwd(), ".cache", "salgado-inventory.json");
const TTL_MS = 10 * 60 * 1000;
const PLACEHOLDER = "/placeholder-car.svg";

type CacheFile = {
  savedAt: number;
  vehicles: VehicleWithImages[];
};

let memory: CacheFile | null = null;
let inflight: Promise<VehicleWithImages[]> | null = null;

function locationRank(location: string): number {
  const value = location.toUpperCase();
  if (value.includes("PATIO")) return 0;
  if (value.includes("UNIDAD")) return 1;
  if (value.includes("CLIENTE")) return 2;
  return 3;
}

function markFeatured(list: VehicleWithImages[]): VehicleWithImages[] {
  const patio = list.filter((v) => /patio/i.test(v.description ?? ""));
  const pool = (patio.length >= 3 ? patio : list).slice().sort((a, b) => b.price - a.price);
  const featured = new Set(pool.slice(0, 3).map((v) => v.id));
  return list.map((v) => ({ ...v, featured: featured.has(v.id) }));
}

function toVehicle(row: SheetVehicle, photos: string[], now: string): VehicleWithImages {
  const slug = slugify(`${row.brand} ${row.model} ${row.year} ${row.plate}`);
  const id = `sa-${row.stockId}`;
  const images = (photos.length ? photos : [PLACEHOLDER]).map((storagePath, index) => ({
    id: `${id}-img-${index}`,
    vehicle_id: id,
    storage_path: storagePath,
    sort_order: index,
    created_at: now,
  }));

  return {
    id,
    slug,
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
    description: `Patente ${row.plate}. Ubicación: ${row.location}. Origen: ${row.origin}.`,
    plate: row.plate,
    stock_id: row.stockId,
    location: row.location,
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

async function readCache(): Promise<CacheFile | null> {
  if (memory) return memory;
  try {
    const raw = await readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (!Array.isArray(parsed.vehicles) || typeof parsed.savedAt !== "number") return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(file: CacheFile): Promise<void> {
  memory = file;
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(file));
}

async function refresh(): Promise<VehicleWithImages[]> {
  const previous = await readCache();
  try {
    const { vehicles: rows, driveFolderId } = await fetchSalgadoSheet();
    const folderId = driveFolderId || drivePhotosFolderId();
    const now = new Date().toISOString();
    let photos = new Map<string, string[]>();
    try {
      photos = await photosByStockId(rows, folderId);
    } catch (err) {
      console.error("[drive] índice de fotos", err);
    }

    const ordered = rows
      .slice()
      .sort((a, b) => locationRank(a.location) - locationRank(b.location));
    const vehicles = markFeatured(ordered.map((row) => toVehicle(row, photos.get(row.stockId) ?? [], now)));
    if (!vehicles.length) throw new Error("La pestaña Salgado no tiene unidades vendibles");
    await writeCache({ savedAt: Date.now(), vehicles });
    console.log(`[salgado] ${vehicles.length} unidades desde la pestaña ${process.env.SALGADO_SHEET_TAB || "SALGADO AUTOMOTRIZ"}`);
    return vehicles;
  } catch (err) {
    console.error("[salgado] sync", err);
    if (previous?.vehicles.length) return previous.vehicles;
    return [];
  }
}

/** Inventario vivo: pestaña SALGADO AUTOMOTRIZ + fotos Drive por ID. */
export async function loadSalgadoCatalog(): Promise<VehicleWithImages[]> {
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
