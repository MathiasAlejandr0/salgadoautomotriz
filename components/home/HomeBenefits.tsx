import {
  Calculator,
  FileSearch,
  Camera,
  BadgeCheck,
  Wrench,
  Handshake,
  Car,
  Store,
} from "lucide-react";
import { SITE } from "@/lib/site";

const BENEFITS = [
  {
    icon: Calculator,
    title: "Financiamiento claro",
    desc: "Simula pie y plazo. Un asesor te confirma por WhatsApp.",
  },
  {
    icon: FileSearch,
    title: "Historial al día",
    desc: "Revisamos papeles, multas y dominio antes de publicar.",
  },
  {
    icon: Wrench,
    title: "Revisión mecánica",
    desc: "Cada unidad pasa por inspección previa a la venta.",
  },
  {
    icon: Camera,
    title: "Fotos reales",
    desc: "Lo que ves en la ficha es lo que ves en el patio.",
  },
  {
    icon: Store,
    title: "Showroom local",
    desc: `Visita y retiro en ${SITE.address}.`,
  },
  {
    icon: BadgeCheck,
    title: "Stock verificado",
    desc: "Kilometraje y estado auditados, sin sorpresas.",
  },
  {
    icon: Handshake,
    title: "Asesoría personalizada",
    desc: "Te acompañamos de punta a punta en la compra.",
  },
  {
    icon: Car,
    title: "Prueba de manejo",
    desc: "Agenda tu test drive cuando quieras.",
  },
];

export default function HomeBenefits() {
  return (
    <section className="relative border-y border-white/[0.04] bg-[#060c18] px-5 py-16 lg:px-6 md:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent/40 to-transparent"
      />
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12 max-w-xl">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-accent">
            Por qué elegirnos
          </p>
          <h2 className="text-[1.85rem] font-black tracking-tight text-white md:text-[2.15rem]">
            Claridad en cada etapa de la compra
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/50">
            Sabes qué estás comprando: inspección, papeles y entrega en un solo lugar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 ring-1 ring-brand-accent/20 transition group-hover:bg-brand-accent/15 group-hover:ring-brand-accent/35">
                <Icon size={18} className="text-brand-accent" />
              </div>
              <h3 className="mb-1.5 text-[15px] font-bold text-white">{title}</h3>
              <p className="text-[13px] leading-relaxed text-white/45">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
