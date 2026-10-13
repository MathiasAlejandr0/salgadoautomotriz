import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import CatalogLive, { CatalogCount } from "@/components/catalog/CatalogLive";
import { getVehicles } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Catálogo",
  description: `Catálogo de autos usados certificados en ${SITE.address}.`,
  path: "/catalogo",
});

export default async function CatalogoPage() {
  const vehicles = await getVehicles();

  return (
    <>
      <Header />
      <main className="flex-1 pt-[76px]">
        <section className="relative overflow-hidden border-b border-brand-border/60">
          <div className="pointer-events-none absolute right-[-40px] top-[-20px] select-none opacity-[0.07]">
            <Image
              src="/logo-salgado.png"
              alt=""
              width={320}
              height={240}
              className="object-contain"
            />
          </div>
          <div className="relative mx-auto max-w-[1280px] px-5 py-12 lg:px-8 md:py-14">
            <h1 className="mb-3 text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
              Catálogo
            </h1>
            <p className="text-base text-brand-muted md:text-lg">
              <Suspense fallback={<span className="font-bold text-brand-accent">{vehicles.length}</span>}>
                <CatalogCount initial={vehicles} />
              </Suspense>{" "}
              vehículos publicados en{" "}
              <span className="font-semibold text-brand-accent">
                {SITE.address.split(",")[0]}
              </span>
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8">
          <Suspense fallback={null}>
            <CatalogLive initial={vehicles} />
          </Suspense>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}