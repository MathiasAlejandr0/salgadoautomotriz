import Link from "next/link";
import { waUrl } from "@/lib/site";

const PILLARS = [
  {
    n: "01",
    title: "Inspección previa",
    desc: "Revisamos cada unidad antes de publicarla. Se vende en el estado inspeccionado.",
  },
  {
    n: "02",
    title: "Papeles al día",
    desc: "Dominio, kilometraje y antecedentes claros: sin deudas ni multas que te sorprendan.",
  },
  {
    n: "03",
    title: "Entrega en patio",
    desc: "Visita y retiro en Cardonal #15, Puerto Montt, con asesoría de punta a punta.",
  },
];

export default function HomeTrust() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.07] bg-[#060b14]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(0,188,254,0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1200px] px-5 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#102033] to-[#071018] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
          <div className="max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#00BCFE]">Financiamiento</p>
            <h2 className="mt-2 text-[1.45rem] font-black uppercase tracking-tight text-white sm:text-[1.75rem]">
              Simula tu cuota en minutos
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Pie, plazo y cuota referencial. En sucursal, según tu evaluación, la cuota puede mantenerse o mejorar.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/financiamiento"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#00BCFE] px-6 py-3 text-sm font-bold text-[#041018]"
            >
              Ir al simulador
            </Link>
            <Link
              href="/catalogo"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:text-white"
            >
              Ver vehículos
            </Link>
          </div>
        </div>

        <div className="mt-14 sm:mt-16">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gradient-to-r from-[#00BCFE] to-transparent" />
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#00BCFE]">Transparencia</p>
          </div>
          <h2 className="mt-4 max-w-lg text-[1.85rem] font-black uppercase leading-[1.1] text-white sm:text-[2.15rem]">
            Claridad en cada
            <br />
            etapa de la compra
          </h2>
          <p className="mt-3 max-w-lg text-sm text-white/45">
            Sabes qué estás comprando: inspección, papeles y entrega en un solo lugar.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3">
            {PILLARS.map((p) => (
              <article key={p.n} className="bg-[#0c1626] px-6 py-7 sm:px-7 sm:py-8">
                <p className="text-sm tracking-[0.2em] text-[#00BCFE]">{p.n}</p>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{p.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-white/50">{p.desc}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#00BCFE]/20 via-[#102033] to-[#060b14] sm:mt-16">
          <div className="px-6 py-10 text-center sm:px-12 sm:py-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#00BCFE]">Siguiente paso</p>
            <h2 className="mt-3 text-[clamp(1.35rem,5vw,2rem)] font-black uppercase text-white">
              ¿Listo para tu próximo vehículo?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/55">
              Explora el stock, simula el crédito o escribe a un asesor en Puerto Montt.
            </p>
            <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Link
                href="/catalogo"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#00BCFE] px-7 py-3.5 text-sm font-bold text-[#041018]"
              >
                Explorar catálogo
              </Link>
              <a
                href={waUrl("Hola, quiero información sobre un vehículo de Salgado Automotriz.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-7 py-3.5 text-sm font-semibold text-white hover:bg-[#25D366]/20"
              >
                Hablar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
