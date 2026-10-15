"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { GOOGLE_REVIEW_URL } from "@/lib/social";
import { cn } from "@/lib/utils";

interface GReview {
  author?: string;
  rating: number;
  date: string;
  text: string;
}

const AUTOPLAY_MS = 6000;

function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "hoy";
  if (days < 7) return days === 1 ? "hace 1 día" : `hace ${days} días`;
  if (days < 30) { const w = Math.floor(days / 7); return w === 1 ? "hace 1 semana" : `hace ${w} semanas`; }
  if (days < 365) { const m = Math.floor(days / 30); return m === 1 ? "hace 1 mes" : `hace ${m} meses`; }
  const y = Math.floor(days / 365);
  return y === 1 ? "hace 1 año" : `hace ${y} años`;
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-label="Google" role="img">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Carrusel de reseñas reales de Google. Lee /reviews.json (editable en el
 * servidor sin recompilar). Si no hay reseñas, no se muestra.
 */
export default function GoogleReviews() {
  const [reviews, setReviews] = useState<GReview[]>([]);
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(1);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    fetch("/reviews.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: GReview[] = Array.isArray(d?.reviews) ? d.reviews : [];
        setReviews(list.filter((r) => r && typeof r.text === "string" && r.text.trim() && r.rating >= 1));
      })
      .catch(() => setReviews([]));
  }, []);

  useEffect(() => {
    const mqMd = window.matchMedia("(min-width: 768px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqRm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setPerView(mqLg.matches ? 3 : mqMd.matches ? 2 : 1);
      setReduced(mqRm.matches);
    };
    update();
    [mqMd, mqLg, mqRm].forEach((m) => m.addEventListener("change", update));
    return () => [mqMd, mqLg, mqRm].forEach((m) => m.removeEventListener("change", update));
  }, []);

  const pages = Math.max(1, reviews.length - perView + 1);
  const current = Math.min(index, pages - 1);
  const go = useCallback((i: number) => setIndex(((i % pages) + pages) % pages), [pages]);

  useEffect(() => {
    if (paused || reduced || pages <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % pages), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, reduced, pages]);

  if (!reviews.length) return null;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Reseñas de clientes en Google"
      className="mx-auto max-w-[1200px] px-5 pt-12 sm:px-6 lg:px-8"
    >
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#00BCFE]">
            <GoogleG className="size-4" /> Reseñas en Google
          </p>
          <h2 className="mt-2 text-[1.45rem] font-black tracking-tight text-white sm:text-3xl">
            Lo que dicen nuestros clientes
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
            className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-white transition hover:border-[#00BCFE] hover:text-[#00BCFE]">
            Ver todas en Google
          </a>
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
            className="rounded-full bg-[#00BCFE] px-4 py-2 text-[13px] font-bold text-white shadow-[0_0_18px_rgba(0,188,254,0.3)] transition hover:bg-[#33cfff]">
            Dejar una reseña
          </a>
        </div>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
        onTouchEnd={(e) => {
          const start = touchX.current; touchX.current = null; setPaused(false);
          if (start == null) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="overflow-hidden">
          <ul
            className={cn("flex", !reduced && "transition-transform duration-500 ease-out")}
            style={{ transform: `translateX(-${(current * 100) / perView}%)` }}
          >
            {reviews.map((r, i) => (
              <li
                key={i}
                className="shrink-0 px-2"
                style={{ width: `${100 / perView}%` }}
                aria-hidden={i < current || i >= current + perView}
              >
                <article className="flex h-full flex-col rounded-2xl border border-white/[0.07] bg-[#0c1828] p-5 sm:p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex gap-0.5" aria-label={`${r.rating} de 5 estrellas`}>
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} size={14} className={s < r.rating ? "fill-[#FBBC04] text-[#FBBC04]" : "text-white/20"} />
                      ))}
                    </div>
                    <GoogleG className="size-5 shrink-0" />
                  </div>
                  <p className="mb-4 flex-1 text-sm leading-relaxed text-white/80 [overflow-wrap:anywhere]">
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-white">{r.author?.trim() || "Cliente en Google"}</span>
                    <span className="shrink-0 text-white/45">{relativeDate(r.date)}</span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>

        {pages > 1 && (
          <>
            <button type="button" onClick={() => go(current - 1)} aria-label="Reseña anterior"
              className="absolute left-0 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#071422]/90 p-2 text-white transition hover:text-[#00BCFE] sm:block lg:-left-4">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => go(current + 1)} aria-label="Reseña siguiente"
              className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/10 bg-[#071422]/90 p-2 text-white transition hover:text-[#00BCFE] sm:block lg:-right-4">
              <ChevronRight size={18} />
            </button>
            <div className="mt-5 flex justify-center gap-2">
              {Array.from({ length: pages }).map((_, i) => (
                <button key={i} type="button" onClick={() => go(i)}
                  aria-label={`Ir a la reseña ${i + 1}`} aria-current={i === current}
                  className={cn("h-2 rounded-full transition-all", i === current ? "w-6 bg-[#00BCFE]" : "w-2 bg-white/25 hover:bg-white/50")} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
