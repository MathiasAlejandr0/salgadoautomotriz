import {
  ClipboardList,
  FileSearch,
  Calculator,
  MapPin,
} from "lucide-react";
import { SITE } from "@/lib/site";

const STEPS = [
  {
    n: "01",
    icon: ClipboardList,
    title: "Explora el stock",
    desc: "Filtra vehículos publicados con ficha clara y fotos reales.",
  },
  {
    n: "02",
    icon: FileSearch,
    title: "Revisa en detalle",
    desc: "Galería, especificaciones y precio transparente.",
  },
  {
    n: "03",
    icon: Calculator,
    title: "Simula tu cuota",
    desc: "Elige pie y plazo. Te respondemos el mismo día hábil.",
  },
  {
    n: "04",
    icon: MapPin,
    title: "Visita el showroom",
    desc: "Coordinamos entrega o visita al patio en Puerto Montt.",
  },
];

export default function HomeSteps() {
  return (
    <section className="px-5 py-16 lg:px-6 md:py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-accent">
            Proceso
          </p>
          <h2 className="text-[1.85rem] font-black tracking-tight text-white md:text-[2.15rem]">
            Del catálogo al showroom
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] text-white/50">
            Atención en {SITE.address}. Cuatro pasos simples.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div
            aria-hidden
            className="pointer-events-none absolute left-[12%] right-[12%] top-5 hidden h-px bg-gradient-to-r from-transparent via-brand-accent/35 to-transparent lg:block"
          />
          {STEPS.map(({ n, icon: Icon, title, desc }) => (
            <div key={n} className="relative text-center lg:text-left">
              <span className="mb-3 block text-4xl font-black tracking-tighter text-brand-accent/20">
                {n}
              </span>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent/10 ring-1 ring-brand-accent/25 lg:mx-0">
                <Icon size={16} className="text-brand-accent" />
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
