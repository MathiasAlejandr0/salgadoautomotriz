import type { VehicleWithImages } from "@/types/database";
import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/seo";
import { jsonLd } from "@/lib/html";
import { resolveVehicleImage } from "@/lib/images";

interface Props {
  vehicle: VehicleWithImages;
}

/** JSON-LD Vehicle / Car para fichas de catálogo. */
export default function JsonLdVehicle({ vehicle }: Props) {
  const url = absoluteUrl(`/catalogo/detalle/${vehicle.slug}`);
  const image = resolveVehicleImage(vehicle);
  const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);

  const data = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    brand: { "@type": "Brand", name: vehicle.brand },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    itemCondition: "https://schema.org/UsedCondition",
    mileageFromOdometer:
      vehicle.mileage != null
        ? {
            "@type": "QuantitativeValue",
            value: vehicle.mileage,
            unitCode: "KMT",
          }
        : undefined,
    fuelType: vehicle.fuel ?? undefined,
    vehicleTransmission: vehicle.transmission ?? undefined,
    color: vehicle.color ?? undefined,
    numberOfDoors: vehicle.doors ?? undefined,
    description:
      vehicle.description ??
      `${vehicle.brand} ${vehicle.model} ${vehicle.year} disponible en ${SITE.name}.`,
    image: [imageUrl],
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "CLP",
      price: vehicle.price,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "CarDealer",
        name: SITE.name,
        url: SITE.url,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}
