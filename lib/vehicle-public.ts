import { createHash } from "node:crypto";
import type { VehicleWithImages } from "@/types/database";
import type { Branch } from "@/lib/branch";
import { branchOf } from "@/lib/branch";
import { isPlateToken, stripPlateMentions, stripTrailingPlate } from "@/lib/plates";
import { formatCLP, slugify } from "@/lib/utils";

export type StockUnit = VehicleWithImages & {
  branch: Branch;
  legacySlugs: string[];
};

export function modelYearSlug(brand: string, model: string, year: number): string {
  return slugify(`${brand} ${model} ${year}`);
}

export function vehicleHeading(vehicle: Pick<VehicleWithImages, "brand" | "model" | "year" | "color">): string {
  return [vehicle.brand, vehicle.model, vehicle.color, vehicle.year].filter(Boolean).join(" ");
}

export function vehicleAlt(vehicle: Pick<VehicleWithImages, "brand" | "model" | "year">): string {
  return stripPlateMentions([vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" "));
}

export function vehicleMetaDescription(
  vehicle: Pick<VehicleWithImages, "brand" | "model" | "year" | "price">
): string {
  const name = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  return stripPlateMentions(
    `${name} por ${formatCLP(vehicle.price)} en Salgado Automotriz. Escríbenos por WhatsApp y agenda tu visita en Cardonal 15, Puerto Montt.`
  );
}

export function publicDescription(vehicle: VehicleWithImages): string {
  const raw = vehicle.description?.trim() ?? "";
  const generated = generatedDescription(vehicle);
  if (!raw || /\bpatente\b/i.test(raw)) return generated;
  const stripped = stripPlateMentions(raw);
  return stripped || generated;
}

function generatedDescription(vehicle: VehicleWithImages): string {
  const name = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const details = [vehicle.color ? `color ${vehicle.color}` : null, vehicle.category]
    .filter(Boolean)
    .join(", ");
  const km =
    vehicle.mileage != null ? `${vehicle.mileage.toLocaleString("es-CL")} km.` : null;
  const place = /cliente/i.test(vehicle.location ?? "")
    ? "Unidad en consignación publicada por Salgado Automotriz, Puerto Montt."
    : "Disponible en Salgado Automotriz, Cardonal 15, Puerto Montt.";
  return [details ? `${name}, ${details}.` : `${name}.`, km, `Precio ${formatCLP(vehicle.price)}.`, place]
    .filter(Boolean)
    .join(" ");
}

function numericStock(vehicle: VehicleWithImages): string {
  const stock = (vehicle.stock_id ?? "").replace(/\D/g, "");
  if (!stock) return "";
  if (vehicle.plate && stock.toUpperCase() === vehicle.plate.toUpperCase()) return "";
  return stock;
}

function shortId(vehicle: VehicleWithImages, stockCounts: Map<string, number>): string {
  const stock = numericStock(vehicle);
  const hash = createHash("sha256")
    .update(
      `${vehicle.brand}|${vehicle.model}|${vehicle.year}|${vehicle.color ?? ""}|${stock}|${vehicle.price}`
    )
    .digest("hex")
    .slice(0, 6);
  if (stock && stockCounts.get(stock) === 1 && !isPlateToken(stock)) return stock;
  return `n${hash}`;
}

function needsPublicSlug(vehicle: VehicleWithImages): boolean {
  if (vehicle.id.startsWith("sa-")) return true;
  if (vehicle.plate && isPlateToken(vehicle.plate)) return true;
  const { plate } = stripTrailingPlate(vehicle.slug);
  return Boolean(plate);
}

/** Slug público: marca-modelo-versión-año-id. La patente no entra. */
export function annotateStock(list: VehicleWithImages[]): StockUnit[] {
  const counts = new Map<string, number>();
  for (const vehicle of list) {
    const stock = numericStock(vehicle);
    if (!stock) continue;
    counts.set(stock, (counts.get(stock) ?? 0) + 1);
  }

  const used = new Set<string>();
  return list.map((vehicle) => {
    const legacy = new Set<string>();
    if (vehicle.slug) legacy.add(vehicle.slug.toLowerCase());
    if (vehicle.plate && isPlateToken(vehicle.plate)) {
      legacy.add(slugify(`${vehicle.brand} ${vehicle.model} ${vehicle.year} ${vehicle.plate}`));
    }

    let slug = vehicle.slug.toLowerCase();
    if (needsPublicSlug(vehicle)) {
      const id = shortId(vehicle, counts);
      const version = vehicle.version || vehicle.color;
      slug = slugify(
        [vehicle.brand, vehicle.model, version, vehicle.year, id].filter(Boolean).join(" ")
      );
      if (used.has(slug)) slug = `${slug}-${id}`;
    }
    used.add(slug);
    legacy.delete(slug);

    return {
      ...vehicle,
      slug,
      branch: branchOf(vehicle.location),
      legacySlugs: [...legacy],
      description: publicDescription(vehicle),
    };
  });
}

export function forPublic(unit: StockUnit): VehicleWithImages {
  const { legacySlugs, branch, ...vehicle } = unit;
  void legacySlugs;
  void branch;
  return {
    ...vehicle,
    plate: null,
    description: stripPlateMentions(vehicle.description ?? ""),
  };
}

/** Toda fila de esta planilla se publica aquí. Ningún auto sale a otro sitio. */
export function onSalgadoSite(
  _unit: Pick<StockUnit, "plate" | "brand" | "model" | "year">
): boolean {
  return true;
}

export function headingsAreUnique(units: StockUnit[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const unit of units) {
    const heading = vehicleHeading(unit);
    counts.set(heading, (counts.get(heading) ?? 0) + 1);
  }
  const titles = new Map<string, string>();
  for (const unit of units) {
    const heading = vehicleHeading(unit);
    titles.set(unit.slug, counts.get(heading)! > 1 ? `${heading} ${unit.slug.split("-").at(-1)}` : heading);
  }
  return titles;
}
