import { SITE, waUrl } from "@/lib/site";

export default function ShowroomMap() {
  const q = encodeURIComponent(SITE.mapQuery);
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const wazeUrl = `https://waze.com/ul?q=${q}&navigate=yes`;
  const visit = waUrl("Hola, quiero coordinar una visita al showroom de Salgado Automotriz en Cardonal #15, Puerto Montt.");

  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gradient-to-r from-[#00BCFE] to-transparent" />
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#00BCFE]">Showroom</p>
          </div>
          <h2 className="mt-4 text-[clamp(1.75rem,6vw,2.6rem)] font-black uppercase leading-[1.05] tracking-tight text-white">
            Visítanos en
            <br />
            Puerto Montt
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/50">
            {SITE.addressLine}. Revisa las unidades en persona y agenda tu visita.
          </p>
        </div>
        <a
          href={visit}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#00BCFE] px-7 py-3.5 text-sm font-bold text-[#041018] sm:w-fit"
        >
          Coordinar visita
        </a>
      </div>

      <div className="mt-8 grid overflow-hidden rounded-2xl border border-white/[0.08] lg:mt-10 lg:grid-cols-[1.55fr_1fr]">
        <div className="relative min-h-[260px] bg-[#e8eaed] sm:min-h-[320px] lg:min-h-[420px]">
          <iframe
            title="Salgado Automotriz — Cardonal #15, Puerto Montt"
            src={`https://maps.google.com/maps?q=${q}&z=16&hl=es&output=embed`}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute bottom-4 left-4 z-[1] flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3.5 py-2 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00BCFE] shadow-[0_0_8px_rgba(0,188,254,0.8)]" />
            <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-white/80 hover:text-white">
              Salgado · abrir mapa
            </a>
          </div>
        </div>

        <aside className="flex flex-col justify-between border-t border-white/[0.08] bg-gradient-to-b from-[#121a2a] to-[#070e1a] px-5 py-7 sm:px-9 sm:py-10 lg:border-l lg:border-t-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#00BCFE]">Dirección</p>
            <h3 className="mt-3 text-[1.7rem] font-black uppercase leading-none tracking-tight text-white sm:text-[1.9rem]">
              {SITE.addressLine}
            </h3>
            <p className="mt-2 text-sm text-white/45">
              {SITE.city} · {SITE.region}
            </p>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/55">
              Showroom en Cardonal #15. Vehículos verificados listos para ver, probar y retirar.
            </p>
          </div>

          <div className="mt-8 space-y-4 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Horario</p>
              <p className="mt-0.5 text-white/75">
                {SITE.hours.weekdays}
                <br />
                {SITE.hours.saturday}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Teléfono</p>
              <a href={`tel:${SITE.phoneRaw}`} className="mt-0.5 block text-white/75 hover:text-white">
                {SITE.phone}
              </a>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.08] pt-6">
            <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-white/70 underline decoration-white/20 underline-offset-4 hover:text-white">
              Abrir en Google Maps
            </a>
            <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-white/70 underline decoration-white/20 underline-offset-4 hover:text-white">
              Abrir en Waze
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
