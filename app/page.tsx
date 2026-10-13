import HomeProcess from "@/components/home/HomeProcess";
import ShowroomMap from "@/components/home/ShowroomMap";
import HomeTrust from "@/components/home/HomeTrust";
import { HomeTop } from "@/components/home/HomeLive";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import { getVehicles } from "@/lib/queries";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Salgado Automotriz - Tu próximo auto empieza aquí",
  description:
    "Vehículos verificados, financiamiento claro y entrega inmediata. Automotora certificada en Puerto Montt.",
  path: "/",
});

export default async function HomePage() {
  const catalog = await getVehicles();

  return (
    <>
      <main className="min-w-0 flex-1 overflow-x-hidden bg-brand-bg">
        <HomeTop initial={catalog} />
        <HomeProcess />
        <ShowroomMap />
        <HomeTrust />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}