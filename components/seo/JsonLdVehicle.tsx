import type { VehicleWithImages } from "@/types/database";
import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/seo";
import { jsonLd } from "@/lib/html";
import { resolveVehicleImage } from "@/lib/images";
import { stripPlateMentions } from "@/lib/plates";

interface Props {
  vehicle: VehicleWithImages;
  heading: string;
}

function rasterImage(vehicle: VehicleWithImages): string {
  const image = resolveVehicleImage(vehicle);
  if (!image || image.endsWith(".svg") || image.includes("placeholder-car")) {
    return absoluteUrl("/og.png");
  }
  return image.startsWith("http") ? image : absoluteUrl(image);
}

/** JSON-LD Car + Offer. Sin patente. */
export default function JsonLdVehicle({ vehicle, heading }: Props) {
  const url = absoluteUrl(`/catalogo/detalle/${vehicle.slug}`);
  const image = rasterImage(vehicle);
  const description = stripPlateMentions(
    vehicle.description || `${heading} disponible en ${SITE.name}.`
  );

  const data = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: heading,
    brand: { "@type": "Brand", name: vehicle.brand },
    model: vehicle.model,
    modelDate: String(vehicle.year),
    vehicleModelDate: String(vehicle.year),
    vehicleCondition: "https://schema.org/UsedCondition",
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
    description,
    image: [image],
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "CLP",
      price: vehicle.price,
      availability:
        vehicle.status === "Vendido"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: {
        "@type": "AutoDealer",
        name: SITE.name,
        url: SITE.url,
      },
    },
  };

  return (
    <script type="application/ld+json">{jsonLd(data)}</script>
  );
}
