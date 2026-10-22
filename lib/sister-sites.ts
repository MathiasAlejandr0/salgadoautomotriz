import { modelYearSlug, type StockUnit } from "@/lib/vehicle-public";
import { stripTrailingPlate } from "@/lib/plates";

const SITES = {
  rg: "https://www.rgmotorschile.cl",
  unidades: "https://www.unidadeschile.cl",
} as const;

type SisterKey = keyof typeof SITES;

let cache: { savedAt: number; lists: Record<SisterKey, string[]> } | null = null;
const TTL_MS = 60 * 60 * 1000;

async function loadList(origin: string): Promise<string[]> {
  const response = await fetch(`${origin}/sitemap.xml`, {
    headers: { "User-Agent": "SalgadoAutomotriz/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
}

async function lists(): Promise<Record<SisterKey, string[]>> {
  if (cache && Date.now() - cache.savedAt < TTL_MS) return cache.lists;
  const [rg, unidades] = await Promise.all([
    loadList(SITES.rg).catch(() => [] as string[]),
    loadList(SITES.unidades).catch(() => [] as string[]),
  ]);
  cache = { savedAt: Date.now(), lists: { rg, unidades } };
  return cache.lists;
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
  if (unit.branch !== "rg" && unit.branch !== "unidades") return null;
  const all = await lists();
  return matchUrl(all[unit.branch], unit.plate ?? "", modelYearSlug(unit.brand, unit.model, unit.year));
}

/** Auto que ya no está en esta planilla, pero sigue publicado en otra sucursal. */
export async function sisterUrlByPlate(plate: string): Promise<string | null> {
  const all = await lists();
  const rg = matchUrl(all.rg, plate, "");
  if (rg) return rg;
  return matchUrl(all.unidades, plate, "");
}
