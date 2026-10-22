import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import VehicleDetail from "@/components/detail/VehicleDetail";
import JsonLdVehicle from "@/components/seo/JsonLdVehicle";
import JsonLdBreadcrumb from "@/components/seo/JsonLdBreadcrumb";
import { getStockUnits, getVehicleBySlug } from "@/lib/queries";
import { absoluteUrl } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { decideVehicleRoute } from "@/lib/vehicle-route";
import {
  headingsAreUnique,
  onSalgadoSite,
  vehicleAlt,
  vehicleHeading,
  vehicleMetaDescription,
} from "@/lib/vehicle-public";

export const revalidate = 600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const vehicles = (await getStockUnits()).filter(onSalgadoSite);
  return vehicles.map((vehicle) => ({ slug: vehicle.slug }));
}

async function publishedVehicle(slug: string) {
  const decision = await decideVehicleRoute(slug);
  if (decision.action !== "render") return null;
  return getVehicleBySlug(slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await publishedVehicle(slug);
  if (!vehicle) notFound();

  const titles = headingsAreUnique((await getStockUnits()).filter(onSalgadoSite));
  const title = titles.get(vehicle.slug) ?? vehicleHeading(vehicle);
  const description = vehicleMetaDescription(vehicle);
  const path = `/catalogo/detalle/${vehicle.slug}`;
  const image = absoluteUrl(`/og/vehiculo/${vehicle.slug}`);
  const alt = vehicleAlt(vehicle);

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: `${title} | ${SITE.name}`,
      description,
      url: absoluteUrl(path),
      siteName: SITE.name,
      locale: "es_CL",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const vehicle = await publishedVehicle(slug);
  if (!vehicle) notFound();

  const titles = headingsAreUnique((await getStockUnits()).filter(onSalgadoSite));
  const heading = titles.get(vehicle.slug) ?? vehicleHeading(vehicle);
  const waMessage = `Hola, me interesa el ${vehicle.brand} ${vehicle.model} ${vehicle.year}. ¿Está disponible?`;
  const path = `/catalogo/detalle/${vehicle.slug}`;

  return (
    <>
      <JsonLdVehicle vehicle={vehicle} heading={heading} />
      <JsonLdBreadcrumb
        items={[
          { name: "Inicio", path: "/" },
          { name: "Catálogo", path: "/catalogo" },
          { name: heading, path },
        ]}
      />
      <Header />
      <main className="flex-1 pt-[76px]">
        <VehicleDetail vehicle={vehicle} heading={heading} waMessage={waMessage} />
      </main>
      <Footer />
    </>
  );
}
