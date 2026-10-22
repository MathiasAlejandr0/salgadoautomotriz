import { normalizePlate } from "@/lib/plates";
import { slugify } from "@/lib/utils";

/**
 * Fichas reales de https://www.unidadeschile.cl/catalogo.
 *
 * El sitemap de ese sitio no lista autos y el <link rel="canonical">
 * del HTML apunta al inicio. La ficha igual existe: la ruta es
 * /catalogo/:id y el id es el slug publicado.
 *
 * Hoy ese slug es marca-modelo-año-patente. El cambio en curso de
 * Unidades Chile (agente bc-24cd35e6) lo va a dejar en
 * marca-modelo-versión-año más un id corto, sin patente. Ese slug
 * todavía no está en el repositorio ni responde en el sitio: una URL
 * armada así muestra "Unidad no encontrada". Por eso cada destino de
 * abajo es la ficha que el catálogo enlaza hoy. Cuando publiquen el
 * id nuevo, se cambia solo el campo `url`.
 */
export type UnidadesPage = {
  url: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  price: number;
};

export const UNIDADES_PAGES: UnidadesPage[] = [
  {
    url: "https://www.unidadeschile.cl/catalogo/mitsubishi-l200-katana-crt-4x4-2019-lpcg80",
    plate: "LPCG80",
    brand: "Mitsubishi",
    model: "L200 KATANA CRT 4X4",
    year: 2019,
    price: 11_990_000,
  },
  {
    url: "https://www.unidadeschile.cl/catalogo/nissan-navara-4x2-2023-sjtd29",
    plate: "SJTD29",
    brand: "Nissan",
    model: "NAVARA 4X2",
    year: 2023,
    price: 15_990_000,
  },
  {
    url: "https://www.unidadeschile.cl/catalogo/suzuki-jimny-mt-4x4-1-5-2023-sxkk11",
    plate: "SXKK11",
    brand: "Suzuki",
    model: "JIMNY MT 4X4 1.5",
    year: 2023,
    price: 12_490_000,
  },
];

function identity(brand: string, model: string, year: number): string {
  return slugify(`${brand} ${model} ${year}`);
}

/** URL de la ficha en Unidades Chile, o null si ese auto no está publicado ahí. */
export function unidadesPageFor(unit: {
  plate?: string | null;
  brand: string;
  model: string;
  year: number;
  price: number;
}): string | null {
  const plate = normalizePlate(unit.plate ?? "");
  if (plate) {
    const byPlate = UNIDADES_PAGES.find((page) => page.plate === plate);
    if (byPlate) return byPlate.url;
  }

  const key = identity(unit.brand, unit.model, unit.year);
  const sameCar = UNIDADES_PAGES.filter(
    (page) => identity(page.brand, page.model, page.year) === key
  );
  if (sameCar.length === 1) return sameCar[0].url;
  const samePrice = sameCar.filter((page) => page.price === unit.price);
  return samePrice.length === 1 ? samePrice[0].url : null;
}
