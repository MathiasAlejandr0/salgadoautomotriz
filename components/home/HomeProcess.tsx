const STEPS = [
  { n: "01", title: "Explora el stock", text: "Filtra vehículos verificados con ficha clara y fotos reales." },
  { n: "02", title: "Revisa en detalle", text: "Galería, especificaciones y precio transparente." },
  { n: "03", title: "Simula tu cuota", text: "Elige pie y plazo. Te respondemos el mismo día hábil." },
  { n: "04", title: "Visita el showroom", text: "Coordinamos la visita en Cardonal #15, Puerto Montt." },
];

export default function HomeProcess() {
  return (
    <section className="border-y border-white/[0.08] bg-[#070e1a] py-12 sm:py-16">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-[#00BCFE] to-transparent" />
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#00BCFE]">Proceso</p>
        </div>
        <h2 className="mt-4 text-[1.55rem] font-black uppercase tracking-tight text-white sm:text-[2.15rem]">
          Comprar en cuatro pasos
        </h2>
        <p className="mt-3 max-w-xl text-sm text-white/50">
          Del catálogo al showroom, con atención en Cardonal #15.
        </p>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="h-full border border-white/[0.08] bg-[#0c1626] px-5 py-5 transition hover:border-[#00BCFE]/35"
            >
              <span className="text-sm tracking-[0.18em] text-[#00BCFE]">{s.n}</span>
              <h3 className="mt-3 text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/50">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
