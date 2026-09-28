import type { Metadata } from "next";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import FinancingCalculator, {
  FinancingTrustCards,
} from "@/components/financiamiento/FinancingCalculator";
import { getVehicles } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Financiamiento",
  description: "Simula pie y plazo. Un asesor te confirma por WhatsApp.",
  path: "/financiamiento",
});

const SHOWROOM =
  "https://images.unsplash.com/photo-1563720223185-11003d516935?w=1600&q=85";

export default async function FinanciamientoPage() {
  const vehicles = await getVehicles();

  return (
    <>
      <Header />
      <main className="flex-1 pt-[76px]">
        <section className="relative min-h-[calc(100svh-76px)] overflow-hidden">
          <Image
            src={SHOWROOM}
            alt="Showroom Salgado Automotriz"
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
            quality={90}
          />
          <div className="absolute inset-0 bg-brand-bg/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-bg/95 via-brand-bg/70 to-brand-bg/40" />

          <div className="relative mx-auto max-w-[1280px] px-5 py-12 lg:px-8 lg:py-16">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <FinancingCalculator vehicles={vehicles} />
              <div className="order-first lg:order-last lg:pl-2">
                <h1 className="mb-5 text-4xl font-black leading-[1.05] tracking-tight md:text-5xl lg:text-[3.25rem]">
                  <span className="text-white">Financiamiento claro.</span>
                  <br />
                  <span className="text-brand-accent drop-shadow-[0_0_24px_rgba(0,188,254,0.3)]">
                    Cuotas que se entienden
                  </span>
                </h1>
                <p className="max-w-md text-lg leading-relaxed text-[#a8b8c8]">
                  Simula pie y plazo. Un asesor te confirma por WhatsApp.
                </p>
              </div>
            </div>
            <FinancingTrustCards />
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
