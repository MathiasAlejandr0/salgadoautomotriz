import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Home, MessageCircle } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import { pageMetadata } from "@/lib/seo";
import { waUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Página no encontrada",
  description: "La página que buscas no existe o fue movida.",
  path: "/404",
  noIndex: true,
});

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-20 pt-[96px] text-center">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-accent">
          Error 404
        </p>
        <h1 className="mb-4 max-w-lg text-3xl font-black tracking-tight text-white md:text-4xl">
          Esta página no existe
        </h1>
        <p className="mb-10 max-w-md text-sm leading-relaxed text-white/55">
          El enlace puede estar mal escrito o el vehículo ya no está publicado.
          Vuelve al inicio o revisa el inventario.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-accent px-6 py-3 text-sm font-bold text-[#041018] hover:bg-brand-accent2"
          >
            <Home size={16} /> Ir al inicio
          </Link>
          <Link
            href="/catalogo"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:border-brand-accent/40"
          >
            Ver inventario <ArrowRight size={16} />
          </Link>
          <a
            href={waUrl("Hola, llegué a una página 404 y necesito ayuda")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-wa px-6 py-3 text-sm font-semibold text-white hover:bg-[#1ebe57]"
          >
            <MessageCircle size={16} /> WhatsApp
          </a>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
