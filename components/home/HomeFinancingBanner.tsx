import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { waUrl } from "@/lib/site";

export default function HomeFinancingBanner() {
  return (
    <section className="px-5 py-6 lg:px-6">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl border border-brand-accent/20 bg-gradient-to-r from-[#0c2138] to-[#071422] px-8 py-12 md:px-12 md:py-14">
        <div className="absolute -right-10 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-brand-accent/10 blur-[80px]" />
        <div className="relative max-w-lg">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">
            Financiamiento
          </p>
          <h2 className="mb-4 text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
            Financiamiento claro.{" "}
            <span className="text-brand-accent">Cuotas que se entienden</span>
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-white/60 md:text-base">
            Simula pie y plazo en minutos. Un asesor te confirma por WhatsApp el mismo día.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/financiamiento"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-accent px-6 py-3 text-sm font-bold text-[#041018] transition-colors hover:bg-brand-accent2"
            >
              Simular mi crédito <ArrowRight size={16} />
            </Link>
            <a
              href={waUrl("Hola, me interesa cotizar un financiamiento")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-brand-accent/40"
            >
              <MessageCircle size={16} /> Consultar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
