"use client";

import { useState } from "react";
import { Send, Check } from "lucide-react";
import WhatsAppCTA from "@/components/shared/WhatsAppCTA";
import HoneypotField from "@/components/shared/HoneypotField";

export default function ContactForm() {
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", mensaje: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const company_website = String(new FormData(e.currentTarget).get("company_website") ?? "");
    try {
      const res = await fetch("/api/contact-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, company_website }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Error al enviar. Por favor intente de nuevo.");
        return;
      }
      setSent(true);
    } catch {
      alert("Error al enviar. Por favor intente de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center bg-[#0C2138] border border-[#25D366]/30 rounded-2xl p-10">
        <div className="w-14 h-14 bg-[#25D366]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={26} className="text-[#25D366]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">¡Mensaje enviado!</h2>
        <p className="text-[#94A3B8] mb-6">Nos pondremos en contacto contigo pronto.</p>
        <WhatsAppCTA label="¿Prefieres WhatsApp?" message="Hola, envié un mensaje de contacto" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative bg-[#0C2138] border border-[#1a3a5c] rounded-2xl p-6 space-y-4">
      <HoneypotField />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[#94A3B8] mb-1.5">Nombre *</label>
          <input required type="text" name="nombre" value={form.nombre} onChange={handleChange}
            className="input-field" placeholder="Tu nombre" />
        </div>
        <div>
          <label className="block text-xs text-[#94A3B8] mb-1.5">Teléfono</label>
          <input type="tel" name="telefono" value={form.telefono} onChange={handleChange}
            className="input-field" placeholder="+56 9 XXXX XXXX" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#94A3B8] mb-1.5">Email *</label>
        <input required type="email" name="email" value={form.email} onChange={handleChange}
          className="input-field" placeholder="tu@email.com" />
      </div>
      <div>
        <label className="block text-xs text-[#94A3B8] mb-1.5">Mensaje *</label>
        <textarea required name="mensaje" value={form.mensaje} onChange={handleChange}
          rows={4} className="input-field resize-none" placeholder="Cuéntanos en qué podemos ayudarte…" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-[#00BCFE] hover:bg-[#00A5EF] disabled:opacity-60 text-[#071422] font-bold text-sm px-6 py-3.5 rounded-xl transition-colors">
          <Send size={16} />
          {loading ? "Enviando…" : "Enviar mensaje"}
        </button>
        <WhatsAppCTA
          message={`Hola, me comuniqué por el formulario. ${form.mensaje}`}
          label="O escribir por WhatsApp"
          className="flex-1 justify-center"
        />
      </div>
    </form>
  );
}
