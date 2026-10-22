import type { Metadata } from "next";
import { Shield, Award, Users, Clock, MapPin, Phone, Mail } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppCTA, { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 600;

export const metadata: Metadata = pageMetadata({
  title: "Nosotros",
  description:
    "Conoce la historia de Salgado Automotriz. Más de 10 años de experiencia vendiendo vehículos usados certificados en Chile.",
  path: "/nosotros",
});

const VALUES = [
  { icon: Shield, title: "Honestidad", desc: "Sin letra chica ni sorpresas. Precios transparentes." },
  { icon: Award, title: "Calidad", desc: "Cada vehículo pasa una revisión técnica completa antes de la venta." },
  { icon: Users, title: "Servicio", desc: "Atención personalizada para encontrar el auto ideal." },
  { icon: Clock, title: "Experiencia", desc: "Más de 10 años en el mercado automotriz chileno." },
];

export default function NosotrosPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-20">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-[#0C2138] to-[#071422] border-b border-[#1a3a5c] py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-[#00BCFE]/5 rounded-full blur-[80px]" />
          <div className="max-w-4xl mx-auto relative">
            <p className="text-[#00BCFE] text-xs font-bold uppercase tracking-widest mb-3">Nosotros</p>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-5 leading-tight">
              Tu concesionario de{" "}
              <span className="text-gradient">confianza</span>
            </h1>
            <p className="text-lg text-[#94A3B8] leading-relaxed max-w-2xl">
              Somos Salgado Automotriz, una empresa familiar con más de 10 años de experiencia en la
              venta de vehículos usados certificados. Nuestro compromiso es brindarte la mejor
              atención y encontrar el auto que se adapte a tu vida y presupuesto.
            </p>
          </div>
        </section>

        {/* Valores */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[#00BCFE] text-xs font-bold uppercase tracking-widest mb-2">Valores</p>
              <h2 className="text-3xl font-black text-white">Lo que nos define</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {VALUES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-[#0C2138] border border-[#1a3a5c] rounded-2xl p-6 hover:border-[#00BCFE]/30 transition-colors">
                  <div className="w-12 h-12 bg-[#071422] rounded-xl flex items-center justify-center mb-4">
                    <Icon size={20} className="text-[#00BCFE]" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{title}</h3>
                  <p className="text-sm text-[#94A3B8]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Historia */}
        <section className="py-16 bg-[#0C2138]/40 border-y border-[#1a3a5c] px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-white mb-5">Nuestra historia</h2>
            <div className="prose prose-invert max-w-none text-[#94A3B8] leading-relaxed space-y-4">
              <p>
                Salgado Automotriz nació de la pasión por los autos y el deseo de ofrecer un servicio
                diferente en el mercado de vehículos usados chileno. Desde nuestros inicios, hemos
                priorizado la transparencia y la satisfacción de cada cliente.
              </p>
              <p>
                Con el tiempo, fuimos creciendo y consolidando una reputación basada en el trato
                justo, los precios honestos y la calidad de nuestros vehículos. Hoy contamos con
                cientos de autos vendidos y clientes que nos recomiendan con orgullo.
              </p>
              <p>
                Nuestro equipo de asesores está siempre disponible para orientarte en cada paso del
                proceso de compra, desde la elección del vehículo hasta el financiamiento.
              </p>
            </div>
          </div>
        </section>

        {/* Contacto info */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-white mb-8">Encuéntranos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: MapPin, label: "Dirección", value: "Santiago, Chile" },
                { icon: Phone, label: "Teléfono", value: "+56 9 1234 5678" },
                { icon: Mail, label: "Email", value: "contacto@salgadoautomotriz.cl" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4 bg-[#0C2138] border border-[#1a3a5c] rounded-2xl p-5">
                  <div className="w-10 h-10 bg-[#071422] rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[#00BCFE]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <WhatsAppCTA
                size="lg"
                label="Hablar con nosotros"
                message="Hola, quiero conocer más sobre Salgado Automotriz"
              />
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
