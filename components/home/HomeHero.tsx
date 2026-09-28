import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { SearchOptions } from "@/lib/search-options";
import Header from "@/components/layout/Header";
import HeroSearchForm from "@/components/home/HeroSearchForm";
import { waUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

interface Props {
  options: SearchOptions;
}

/**
 * Shell del hero (server-friendly layout + Header).
 * El buscador es el único island client (HeroSearchForm).
 * Nota: Header también es client; el título/CTAs quedan aquí por composición visual.
 */
export default function HomeHero({ options }: Props) {
  return (
    <section
      className={cn(
        "relative w-full overflow-hidden bg-brand-bg",
        "min-h-[100svh] md:min-h-0 md:flex-1"
      )}
    >
      <Image
        src="/hero-bg.png?v=41"
        alt=""
        fill
        priority
        unoptimized
        className="object-cover object-[78%_50%] sm:object-[88%_48%] lg:object-[90%_46%]"
        sizes="100vw"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(95deg,rgba(5,10,20,0.88)_0%,rgba(5,10,20,0.52)_30%,rgba(5,10,20,0.12)_50%,transparent_64%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-brand-bg/40 to-transparent"
      />

      <Header variant="hero" />

      <div className="absolute inset-x-0 top-[28%] z-10 px-5 sm:top-[26%] sm:px-6 md:top-[24%] lg:top-[22%] lg:px-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="w-full max-w-[16rem] sm:max-w-[18.5rem] lg:max-w-[20.5rem]">
            <p className="mb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.28em] text-brand-accent sm:text-[0.6875rem]">
              Automotora certificada
            </p>

            <h1 className="text-[clamp(1.65rem,3.2vw,2.55rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-white">
              <span className="block">Tu próximo auto</span>
              <span className="mt-0.5 block text-brand-accent">Empieza aquí</span>
            </h1>

            <p className="mt-2.5 text-[0.8125rem] font-medium leading-snug text-white/75 sm:text-[0.875rem]">
              Vehículos verificados, financiamiento claro y entrega inmediata.
            </p>

            <div className="sa-cta-row mt-6 sm:mt-7">
              <Link
                href="/catalogo"
                className={cn(
                  "btn-hero-cyan inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-5",
                  "text-[0.8125rem] font-bold sm:text-[0.875rem]"
                )}
              >
                Ver inventario
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </Link>
              <a
                href={waUrl(
                  "Hola, quiero conocer el inventario de Salgado Automotriz"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "btn-hero-wa inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-5",
                  "text-[0.8125rem] font-bold sm:text-[0.875rem]"
                )}
              >
                <MessageCircle className="size-3.5" strokeWidth={2.25} />
                Hablar ahora
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-1 sm:px-6 lg:px-8">
        <HeroSearchForm options={options} />
      </div>
    </section>
  );
}
