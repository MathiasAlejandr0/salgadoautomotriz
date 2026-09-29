import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import VehicleDetail from "@/components/detail/VehicleDetail";
import JsonLdVehicle from "@/components/seo/JsonLdVehicle";
import { getVehicleBySlug, getVehicles } from "@/lib/queries";
import { absoluteUrl, OG_IMAGE } from "@/lib/seo";
import { resolveVehicleImage } from "@/lib/images";
import { SITE } from "@/lib/site";

export const revalidate = 600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const vehicles = await getVehicles();
  return vehicles.map((vehicle) => ({ slug: vehicle.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) {
    return {
      title: "Vehículo no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const title = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const description =
    vehicle.description ??
    `${vehicle.brand} ${vehicle.model} ${vehicle.year} – ${vehicle.category}. Disponible en ${SITE.name}.`;
  const path = `/catalogo/detalle/${vehicle.slug}`;
  const img = resolveVehicleImage(vehicle);
  const imageUrl = img.startsWith("http") ? img : absoluteUrl(img);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${SITE.name}`,
      description,
      url: absoluteUrl(path),
      siteName: SITE.name,
      locale: "es_CL",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
        OG_IMAGE,
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const waMessage = `Hola, me interesa el ${vehicle.brand} ${vehicle.model} ${vehicle.year} (${vehicle.slug}). ¿Está disponible?`;

  return (
    <>
      <JsonLdVehicle vehicle={vehicle} />
      <Header />
      <main className="flex-1 pt-[76px]">
        <VehicleDetail vehicle={vehicle} waMessage={waMessage} />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
