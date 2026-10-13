import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import CompareLive from "@/components/compare/CompareLive";
import { getVehicles } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Comparador de vehículos",
  description: "Compara precio, año, kilometraje y ficha técnica de hasta 3 vehículos lado a lado.",
  path: "/comparador",
});

export default async function ComparadorPage() {
  const vehicles = await getVehicles();
  return (
    <>
      <Header />
      <main className="flex-1 pt-[76px]">
        <section className="border-b border-brand-border/60">
          <div className="mx-auto max-w-[1280px] px-5 py-12 lg:px-8 md:py-14">
            <h1 className="mb-3 text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
              Comparador
            </h1>
            <p className="text-base text-brand-muted md:text-lg">
              Compara hasta <span className="font-semibold text-brand-accent">3 vehículos</span> lado a lado.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8">
          <Suspense fallback={null}>
            <CompareLive initial={vehicles} />
          </Suspense>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
