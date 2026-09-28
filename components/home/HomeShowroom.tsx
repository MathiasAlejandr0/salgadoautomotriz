import Link from "next/link";
import { MapPin, MessageCircle, ShieldCheck, Store } from "lucide-react";
import { SITE, waUrl } from "@/lib/site";

export default function HomeShowroom() {
  return (
    <section className="border-t border-white/[0.05] bg-[#070e1a] px-5 py-14 lg:px-6 md:py-16">
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">
            Showroom
          </p>
          <h2 className="mb-4 text-[1.75rem] font-black tracking-tight text-white md:text-[2rem]">
            Visítanos en {SITE.address.split(",")[0]}
          </h2>
          <p className="mb-8 max-w-md text-sm leading-relaxed text-white/55">
            Revisa unidades en persona, agenda tu prueba de manejo y retira tu auto con
            papeles al día.
          </p>

          <ul className="space-y-4">
            <li className="flex gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-brand-accent" />
              <div>
                <p className="text-sm font-semibold text-white">{SITE.address}</p>
                <p className="text-xs text-white/45">Región de Los Lagos, Chile</p>
              </div>
            </li>
            <li className="flex gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-accent" />
              <div>
                <p className="text-sm font-semibold text-white">Horario</p>
                <p className="text-xs text-white/45">
                  {SITE.hours.weekdays} · {SITE.hours.saturday}
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={waUrl("Hola, quiero agendar una visita al showroom")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-wa px-6 py-3 text-sm font-semibold text-white hover:bg-[#1ebe57]"
            >
              <MessageCircle size={16} /> Agendar visita
            </a>
            <Link
              href="/contacto"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:border-brand-accent/40"
            >
              Formulario de contacto
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-[#0c1828] p-8 md:p-10">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent/10">
            <Store size={26} className="text-brand-accent" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">Atención experta</h3>
          <p className="mb-6 text-sm leading-relaxed text-white/55">
            Nuestro equipo te ayuda a elegir el vehículo correcto según tu uso,
            presupuesto y financiamiento.
          </p>
          <a
            href={`tel:${SITE.phoneRaw}`}
            className="text-lg font-bold text-brand-accent hover:underline"
          >
            {SITE.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
