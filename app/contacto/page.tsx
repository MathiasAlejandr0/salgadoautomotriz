import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import ContactForm from "@/components/contacto/ContactForm";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contacto",
  description:
    "Contáctanos en Salgado Automotriz. Estamos para ayudarte a encontrar tu próximo vehículo.",
  path: "/contacto",
});

const INFO = [
  { icon: Phone, label: "Teléfono", value: "+56 9 1234 5678", href: "tel:+56912345678" },
  { icon: Mail, label: "Email", value: "contacto@salgadoautomotriz.cl", href: "mailto:contacto@salgadoautomotriz.cl" },
  { icon: MapPin, label: "Dirección", value: "Santiago, Chile", href: undefined },
  { icon: Clock, label: "Horario", value: "Lun–Vie 9–19h · Sáb 10–17h", href: undefined },
];

export default function ContactoPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-20">
        <section className="bg-[#0C2138]/60 border-b border-[#1a3a5c] py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <p className="text-[#00BCFE] text-xs font-bold uppercase tracking-widest mb-2">Contacto</p>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-1">Escríbenos</h1>
            <p className="text-[#94A3B8]">
              Completa el formulario y un asesor se pondrá en contacto contigo.
            </p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Info */}
            <div className="lg:col-span-2 space-y-4">
              {INFO.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-4 bg-[#0C2138] border border-[#1a3a5c] rounded-2xl p-5">
                  <div className="w-10 h-10 bg-[#071422] rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[#00BCFE]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-0.5">{label}</p>
                    {href ? (
                      <a href={href} className="text-sm font-semibold text-white hover:text-[#00BCFE] transition-colors">
                        {value}
                      </a>
                    ) : (
                      <p className="text-sm font-semibold text-white">{value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              <ContactForm />
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
