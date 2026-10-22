import { loadRetiredSlugs, loadStockRecords } from "@/lib/inventory/catalog";
import { normalizePlate, stripTrailingPlate } from "@/lib/plates";
import { modelYearSlug, type StockUnit } from "@/lib/vehicle-public";

export type VehicleDecision =
  | { action: "render" }
  | { action: "redirect"; location: string }
  | { action: "gone" }
  | { action: "missing" };

/** 301 solo dentro de este dominio: la URL vieja apunta al slug sin patente. */
function decide(unit: StockUnit, requested: string): VehicleDecision {
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
  const retired = await loadRetiredSlugs();
  const exact = units.find((unit) => unit.slug === slug || unit.legacySlugs.includes(slug));
  if (exact) return decide(exact, requested);

  const { bare, plate } = stripTrailingPlate(slug);
  if (plate && bare && bare !== slug) {
    const matches = units.filter((unit) => modelYearSlug(unit.brand, unit.model, unit.year) === bare);
    if (matches.length === 1) return decide(matches[0], slug);
  }

  if (plate) {
    const byPlate = units.filter((unit) => normalizePlate(unit.plate ?? "") === normalizePlate(plate));
    if (byPlate.length === 1) return decide(byPlate[0], requested);
  }

  if (retired.has(slug)) return { action: "gone" };
  return { action: "missing" };
}
