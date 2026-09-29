"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE, waUrl } from "@/lib/site";
import Logo from "./Logo";

const NAV_LINKS = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/consigna", label: "Consigna tu vehículo" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/contacto", label: "Contacto" },
];

interface HeaderProps {
  variant?: "default" | "hero";
}

export default function Header({ variant = "default" }: HeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const isHero = variant === "hero";

  return (
    <header
      className={cn(
        "inset-x-0 top-0 z-50",
        isHero
          ? "absolute border-b border-transparent bg-transparent"
          : "fixed border-b border-white/[0.06] bg-brand-bg/85 backdrop-blur-xl"
      )}
    >
      <div className={cn(
        "mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-5 sm:gap-4 sm:px-6 lg:px-8",
        isHero
          ? "h-16 pt-2.5 sm:h-[4.75rem] sm:pt-3"
          : "h-14 sm:h-[4.5rem]"
      )}>
        {/* Logo: leve indent; en hero un poco más abajo */}
        <div
          className={cn(
            "flex shrink-0 items-center",
            isHero && "ml-1 sm:ml-2"
          )}
        >
          <Logo height={isHero ? 56 : 44} className="sm:hidden" />
          <Logo height={isHero ? 64 : 52} className="hidden sm:inline-flex" />
        </div>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-[13px] font-medium tracking-wide transition-colors xl:text-[14px]",
                isActive(link.href)
                  ? "text-white"
                  : "text-white/80 hover:text-white"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {SITE.googleRating && (
          <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-black/30 py-1 pl-2 pr-2.5 backdrop-blur-md">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-[#4285F4]">
              G
            </span>
            <span className="text-[12px] font-semibold text-white">
              {SITE.googleRating}
            </span>
            <div className="flex gap-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={9}
                  className="fill-[#FBBC04] text-[#FBBC04]"
                />
              ))}
            </div>
            <span className="hidden text-[10px] font-medium text-white/45 xl:inline">
              Google
            </span>
          </div>
          )}

          <a
            href={waUrl("Hola, quiero agendar una visita a Salgado Automotriz")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#00BCFE] px-4 py-2 text-[12px] font-bold text-white shadow-[0_0_18px_rgba(0,188,254,0.35)] transition hover:bg-[#33cfff]"
          >
            Agendar visita
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-full border border-white/10 bg-black/30 p-2 text-white/80 backdrop-blur lg:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-white/10 bg-[#0a1525]/95 backdrop-blur-xl lg:hidden"
        >
          <nav className="flex flex-col gap-1 px-5 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-medium text-white"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={waUrl("Hola, quiero agendar una visita")}
              className="mt-2 rounded-lg bg-[#00BCFE] py-2.5 text-center text-sm font-bold text-white"
            >
              Agendar visita
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
