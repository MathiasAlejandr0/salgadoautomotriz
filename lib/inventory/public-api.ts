import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import type { Vehicle, VehicleImage, VehicleWithImages } from "@/types/database";

const STATUSES = ["Disponible", "En reserva", "Vendido", "Borrador"] as const;

/**
 * La planilla es la fuente del build, pero MySQL puede publicar un auto que
 * esa lectura no traía (oculto o ausente el día del export). Sin esta unión
 * la ficha no se regenera y queda el HTML viejo, con un CSS que el deploy
 * siguiente ya borró.
 */
function apiOrigin(): string {
  const configured = (process.env.SALGADO_PUBLIC_API || process.env.NEXT_PUBLIC_SITE_URL || "https://salgadoautomotriz.cl")
    .trim()
    .replace(/\/$/, "");
  if (!configured || /localhost|127\.0\.0\.1/i.test(configured)) return "https://salgadoautomotriz.cl";
  return configured;
}

function asStatus(value: unknown, published: boolean): Vehicle["status"] {
  if (typeof value === "string" && (STATUSES as readonly string[]).includes(value)) {
    return value as Vehicle["status"];
  }
  return published ? "Disponible" : "Borrador";
}

function asImages(vehicleId: string, value: unknown): VehicleImage[] {
  if (!Array.isArray(value)) return [];
  const images: VehicleImage[] = [];
  value.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const img = row as Record<string, unknown>;
    const raw = typeof img.storage_path === "string" ? img.storage_path.trim() : "";
    if (!raw) return;
    const storage_path = raw.startsWith("http") || raw.startsWith("/") ? raw : `/uploads/${raw.replace(/^\/+/, "")}`;
    const thumb = typeof img.thumb_path === "string" ? img.thumb_path.trim() : "";
    images.push({
      id: typeof img.id === "string" && img.id ? img.id : `${vehicleId}-img-${index}`,
      vehicle_id: vehicleId,
      storage_path,
      thumb_path: thumb || null,
      sort_order: typeof img.sort_order === "number" ? img.sort_order : index,
      created_at: typeof img.created_at === "string" ? img.created_at : new Date(0).toISOString(),
    });
  });
  return images;
}

function normalizeApiVehicle(row: unknown): VehicleWithImages | null {
  if (!row || typeof row !== "object") return null;
  const v = row as Record<string, unknown>;
  const slug = typeof v.slug === "string" ? v.slug.trim().toLowerCase() : "";
  const brand = typeof v.brand === "string" ? v.brand.trim() : "";
  const model = typeof v.model === "string" ? v.model.trim() : "";
  const year = typeof v.year === "number" ? v.year : Number(v.year);
  const price = typeof v.price === "number" ? v.price : Number(v.price);
  if (!/^[a-z0-9-]+$/.test(slug) || !brand || !model || !Number.isFinite(year) || !Number.isFinite(price)) {
    return null;
  }
  const published = v.published !== false;
  const id = typeof v.id === "string" && v.id ? v.id : `api-${slug}`;
  const now = new Date(0).toISOString();
  return {
    id,
    slug,
    brand,
    model,
    year,
    version: typeof v.version === "string" ? v.version : null,
    category: typeof v.category === "string" && v.category ? v.category : "Automóvil",
    fuel: typeof v.fuel === "string" ? v.fuel : null,
    transmission: typeof v.transmission === "string" ? v.transmission : null,
    mileage: null,
    color: typeof v.color === "string" ? v.color : null,
    doors: typeof v.doors === "number" ? v.doors : null,
    engine: typeof v.engine === "string" ? v.engine : null,
    price,
    description: typeof v.description === "string" ? v.description : null,
    plate: null,
    stock_id: typeof v.stock_id === "string" ? v.stock_id : null,
    location: typeof v.location === "string" ? v.location : null,
    origin: typeof v.origin === "string" ? v.origin : null,
    status: asStatus(v.status, published),
    published,
    featured: v.featured === true,
    created_at: typeof v.created_at === "string" ? v.created_at : now,
    updated_at: typeof v.updated_at === "string" ? v.updated_at : now,
    vehicle_images: asImages(id, v.vehicle_images),
  };
}

let pending: Promise<VehicleWithImages[]> | null = null;

/**
 * `fetch` de Next con `no-store` marca la ruta como dinámica y el export estático
 * aborta la ficha. node:https no pasa por ese parche: es una foto al momento del build.
 */
function fetchText(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("http:") ? httpGet : httpsGet;
    const req = get(
      url,
      { headers: { Accept: "application/json", "User-Agent": "SalgadoAutomotriz/1.0" } },
      (res) => {
        const status = res.statusCode ?? 500;
        if (status >= 300 && status < 400 && res.headers.location && redirects < 3) {
          res.resume();
          const next = new URL(res.headers.location, url).href;
          resolve(fetchText(next, redirects + 1));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if (status >= 400) {
            reject(new Error(`API pública respondió ${status}`));
            return;
          }
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      }
    );
    req.setTimeout(20_000, () => req.destroy(new Error("timeout API pública")));
    req.on("error", reject);
  });
}

/** Vehículos que /api/vehicles publica ahora. Vacío si la API no responde: el build no se cae. */
export function fetchPublicApiVehicles(): Promise<VehicleWithImages[]> {
  if (!pending) pending = loadPublicApiVehicles();
  return pending;
}

async function loadPublicApiVehicles(): Promise<VehicleWithImages[]> {
  const url = `${apiOrigin()}/api/vehicles`;
  try {
    const data = JSON.parse(await fetchText(url)) as { vehicles?: unknown };
    if (!Array.isArray(data.vehicles)) return [];
    const vehicles = data.vehicles.flatMap((row) => {
      const vehicle = normalizeApiVehicle(row);
      return vehicle ? [vehicle] : [];
    });
    console.log(`[salgado] API pública: ${vehicles.length} vehículos publicados`);
    return vehicles;
  } catch (err) {
    console.warn("[salgado] API pública no disponible; el build sigue con la planilla", err);
    return [];
  }
}
