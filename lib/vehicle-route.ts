import { loadStockRecords } from "@/lib/inventory/catalog";
import { normalizePlate, stripTrailingPlate } from "@/lib/plates";
import { sisterUrlByPlate, sisterUrlFor } from "@/lib/sister-sites";
import { modelYearSlug, onSalgadoSite, type StockUnit } from "@/lib/vehicle-public";

export type VehicleDecision =
  | { action: "render" }
  | { action: "redirect"; location: string }
  | { action: "gone" }
  | { action: "missing" };

function decide(unit: StockUnit, requested: string, sister: string | null): VehicleDecision {
  if (!onSalgadoSite(unit)) {
    return sister ? { action: "redirect", location: sister } : { action: "gone" };
  }
  if (requested !== unit.slug) {
    return { action: "redirect", location: `/catalogo/detalle/${unit.slug}` };
  }
  return { action: "render" };
}

export async function decideVehicleRoute(rawSlug: string): Promise<VehicleDecision> {
  let requested = rawSlug.trim();
  try {
    requested = decodeURIComponent(requested);
  } catch {
    return { action: "missing" };
  }
  const slug = requested.toLowerCase();

  const units = await loadStockRecords();
  const exact = units.find((unit) => unit.slug === slug || unit.legacySlugs.includes(slug));
  if (exact) {
    const sister = onSalgadoSite(exact) ? null : sisterUrlFor(exact);
    return decide(exact, requested, sister);
  }

  const { bare, plate } = stripTrailingPlate(slug);
  if (plate && bare && bare !== slug) {
    const matches = units.filter((unit) => modelYearSlug(unit.brand, unit.model, unit.year) === bare);
    if (matches.length === 1) {
      const sister = onSalgadoSite(matches[0]) ? null : sisterUrlFor(matches[0]);
      return decide(matches[0], slug, sister);
    }
  }

  if (plate) {
    const byPlate = units.filter((unit) => normalizePlate(unit.plate ?? "") === normalizePlate(plate));
    if (byPlate.length === 1) {
      const sister = onSalgadoSite(byPlate[0]) ? null : sisterUrlFor(byPlate[0]);
      return decide(byPlate[0], requested, sister);
    }
    const sister = sisterUrlByPlate(plate);
    if (sister) return { action: "redirect", location: sister };
  }

  return { action: "missing" };
}
