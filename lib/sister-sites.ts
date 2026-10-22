import { modelYearSlug, type StockUnit } from "@/lib/vehicle-public";
import { stripTrailingPlate } from "@/lib/plates";
import { unidadesPageFor } from "@/lib/unidades-pages";

const RG_SITEMAP = "https://www.rgmotorschile.cl/sitemap.xml";

let rgCache: { savedAt: number; urls: string[] } | null = null;
const TTL_MS = 60 * 60 * 1000;

async function rgUrls(): Promise<string[]> {
  if (rgCache && Date.now() - rgCache.savedAt < TTL_MS) return rgCache.urls;
  try {
    const response = await fetch(RG_SITEMAP, {
      headers: { "User-Agent": "SalgadoAutomotriz/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
    rgCache = { savedAt: Date.now(), urls };
    return urls;
  } catch {
    return rgCache?.urls ?? [];
  }
}

function matchUrl(urls: string[], plate: string, identity: string): string | null {
  if (plate) {
    const byPlate = urls.find((url) => url.toLowerCase().includes(plate.toLowerCase()));
    if (byPlate) return byPlate;
  }
  const byModel = urls.filter((url) => {
    const slug = decodeURIComponent(url.split("/").pop() ?? "").toLowerCase();
    return stripTrailingPlate(slug).bare === identity;
  });
  return byModel.length === 1 ? byModel[0] : null;
}

export async function sisterUrlFor(unit: StockUnit): Promise<string | null> {
  if (unit.branch === "unidades") return unidadesPageFor(unit);
  if (unit.branch !== "rg") return null;
  return matchUrl(await rgUrls(), unit.plate ?? "", modelYearSlug(unit.brand, unit.model, unit.year));
}

/** Auto que ya no está en esta planilla, pero sigue publicado en otra sucursal. */
export async function sisterUrlByPlate(plate: string): Promise<string | null> {
  const onUnidades = unidadesPageFor({
    plate,
    brand: "",
    model: "",
    year: 0,
    price: 0,
  });
  if (onUnidades) return onUnidades;
  return matchUrl(await rgUrls(), plate, "");
}
