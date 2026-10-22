import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { waUrl } from "@/lib/site";

export default function HomeFinalCta() {
  return (
    <section className="px-5 py-16 text-center lg:px-6 md:py-20">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">
        ¿Listo para manejar?
      </p>
      <h2 className="mb-4 text-3xl font-black text-white md:text-4xl">Hablemos ahora</h2>
      <p className="mx-auto mb-8 max-w-md text-sm text-white/55">
        Escríbenos por WhatsApp o revisa el inventario completo. Estamos para ayudarte.
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <a
          href={waUrl("Hola, quiero consultar sobre un vehículo")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-wa px-7"
        >
          <MessageCircle size={18} /> Escribir por WhatsApp
        </a>
        <Link
          href="/catalogo"
          className="btn btn-ghost px-7"
        >
          Ver inventario <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
