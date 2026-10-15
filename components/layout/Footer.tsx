import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import Logo from "./Logo";
import { SITE } from "@/lib/site";
import SocialIcons from "@/components/shared/SocialIcons";

export default function Footer() {
  return (
    <footer className="bg-[#0C2138] border-t border-[#1a3a5c] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Logo height={56} className="mb-4" />
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Tu concesionario de confianza en {SITE.address}. Vehículos verificados,
              financiamiento claro y atención experta.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              Páginas
            </h3>
            <ul className="space-y-2">
              {[
                { href: "/catalogo", label: "Catálogo" },
                { href: "/consigna", label: "Consigna tu vehículo" },
                { href: "/nosotros", label: "Nosotros" },
                { href: "/contacto", label: "Contacto" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#94A3B8] hover:text-[#00BCFE] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              Contacto
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-[#94A3B8]">
                <Phone size={14} className="mt-0.5 shrink-0 text-[#00BCFE]" />
                <a href={`tel:+${SITE.phoneRaw}`} className="hover:text-white">
                  {SITE.phone}
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-[#94A3B8]">
                <Mail size={14} className="mt-0.5 shrink-0 text-[#00BCFE]" />
                <a href={`mailto:${SITE.email}`} className="hover:text-white">
                  {SITE.email}
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-[#94A3B8]">
                <MapPin size={14} className="mt-0.5 shrink-0 text-[#00BCFE]" />
                <span>{SITE.address}</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              Horario
            </h3>
            <ul className="space-y-2 text-sm text-[#94A3B8]">
              <li>{SITE.hours.weekdays}</li>
              <li>{SITE.hours.saturday}</li>
              <li>{SITE.hours.sunday}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1a3a5c] flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-[#94A3B8]">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Todos los derechos reservados.
          </p>
          <SocialIcons size={18} className="gap-3" itemClassName="h-9 w-9 bg-[#071422] text-[#94A3B8] hover:bg-[#1a3a5c]" />
        </div>
      </div>
    </footer>
  );
}
