import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import ConsignaForm from "@/components/consigna/ConsignaForm";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Consigna tu vehículo",
  description: `Deja tu auto en consignación en ${SITE.address}. Carga los datos y fotos; te contactamos.`,
  path: "/consigna",
});

const STEPS = [
  ["01", "Datos y fotos", "Patente, ficha y fotos del auto."],
  ["02", "Lo revisamos", "El equipo de Salgado Automotriz recibe tu información."],
  ["03", "Te contactamos", "Te escribimos por WhatsApp para coordinar."],
] as const;

export default function ConsignaPage() {
  return (
    <>
      <Header />
      <main className="relative flex-1 overflow-x-clip bg-brand-bg pb-28 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,188,254,0.14),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-[1280px] items-start gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:px-8">
          <div className="pt-1 sm:pt-4">
            <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-white sm:text-[40px] lg:text-5xl">
              Consigna tu
              <br />
              vehículo
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
              Lo revisamos, lo publicamos y te contactamos. Tú decides si avanzamos.
            </p>
            <ol className="mt-8 space-y-6 sm:mt-10">
              {STEPS.map(([n, title, detail], i) => (
                <li key={n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#00BCFE] text-sm font-bold text-[#041018]">
                      {n}
                    </span>
                    {i < 2 && <span className="mt-1 h-8 w-px bg-white/20" />}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white sm:text-xl">{title}</p>
                    <p className="text-sm text-white/55">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <ConsignaForm />
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
