import { normalizePlate } from "@/lib/plates";
import { slugify } from "@/lib/utils";

/**
 * Fichas confirmadas en https://www.rgmotorschile.cl.
 *
 * El Ranger 4x4 2023 (SHYL53) está en RG Motors. La planilla de Salgado
 * lo marca Uni Chile y no trae patente, así que el match es marca-modelo-año.
 * El destino es el slug sin patente de
 * https://github.com/RgMotorsChile/RgMotorsChileWeb/pull/34
 * (`lib/vehicles/publicSlug.ts`, `publicVehicleSlug`):
 * ford-ranger-4x4-2023-shyl53 → ford-ranger-4x4-rojo-2023-7cm3a8.
 * La versión aporta el tramo "rojo". El id corto no es la patente.
 */
export type RgPage = {
  url: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export const RG_CONFIRMED_PAGES: RgPage[] = [
  {
    url: "https://www.rgmotorschile.cl/vehiculo/ford-ranger-4x4-rojo-2023-7cm3a8",
    plate: "SHYL53",
    brand: "Ford",
    model: "RANGER 4X4",
    year: 2023,
  },
];

function identity(brand: string, model: string, year: number): string {
  return slugify(`${brand} ${model} ${year}`);
}

/** URL confirmada en RG Motors, o null si este auto no tiene destino ahí. */
export function rgConfirmedPageFor(unit: {
  plate?: string | null;
  brand: string;
  model: string;
  year: number;
}): string | null {
  const plate = normalizePlate(unit.plate ?? "");
  if (plate) {
    const byPlate = RG_CONFIRMED_PAGES.find((page) => page.plate === plate);
    if (byPlate) return byPlate.url;
  }

  if (!unit.brand || !unit.model || !unit.year) return null;
  const key = identity(unit.brand, unit.model, unit.year);
  const sameCar = RG_CONFIRMED_PAGES.filter(
    (page) => identity(page.brand, page.model, page.year) === key
  );
  return sameCar.length === 1 ? sameCar[0].url : null;
}
