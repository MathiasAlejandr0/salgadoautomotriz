import { Star } from "lucide-react";
import { SITE } from "@/lib/site";
import type { Review } from "@/types/database";

interface Props {
  reviews: Review[];
}

export default function HomeReviews({ reviews }: Props) {
  if (!reviews.length) return null;

  return (
    <section className="px-5 py-14 lg:px-6 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">
            {SITE.googleRating} ★ en Google
          </p>
          <h2 className="text-[1.75rem] font-black text-white md:text-[2rem]">
            Clientes reales
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/[0.07] bg-[#0c1828] p-6"
            >
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className="fill-brand-accent text-brand-accent"
                  />
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-white/80">
                &ldquo;{r.texto}&rdquo;
              </p>
              <p className="text-sm font-semibold text-white">{r.nombre}</p>
              {r.ciudad && <p className="text-xs text-white/45">{r.ciudad}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
