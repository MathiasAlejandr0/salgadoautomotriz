"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import HoneypotField from "@/components/shared/HoneypotField";

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/contact-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: String(form.get("nombre") ?? ""),
          email: String(form.get("email") ?? ""),
          telefono: String(form.get("telefono") ?? ""),
          mensaje: String(form.get("mensaje") ?? ""),
          company_website: String(form.get("company_website") ?? ""),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      setSent(true);
    } catch {
      setError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="support-chat">
      {open && (
        <section
          className="support-chat-panel"
          role="dialog"
          aria-labelledby={titleId}
        >
          <p className="support-chat-kicker">Asesor de salón</p>
          <h2 id={titleId} className="support-chat-title">
            ¿En qué te ayudamos?
          </h2>
          <p className="support-chat-copy">
            Escríbenos por un auto, un crédito o una visita en Cardonal 15. Te respondemos en horario de salón.
          </p>
          {sent ? (
            <p className="support-chat-copy">Recibimos tu mensaje. Un asesor te contacta a la brevedad.</p>
          ) : (
            <form className="support-chat-form" onSubmit={onSubmit}>
              <HoneypotField />
              <input className="input-field" name="nombre" required minLength={2} placeholder="Nombre" aria-label="Nombre" />
              <input className="input-field" name="email" type="email" required placeholder="Email" aria-label="Email" />
              <input className="input-field" name="telefono" type="tel" placeholder="Teléfono (opcional)" aria-label="Teléfono" />
              <textarea className="input-field resize-none" name="mensaje" required rows={3} placeholder="Tu consulta" aria-label="Mensaje" />
              {error && <p className="support-chat-error">{error}</p>}
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? "Enviando…" : "Enviar al asesor"}
              </button>
            </form>
          )}
        </section>
      )}
      <button
        type="button"
        className="support-chat-launcher"
        aria-label={open ? "Cerrar chat de soporte" : "Abrir chat de soporte"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={18} strokeWidth={1.75} /> : <MessageCircle size={18} strokeWidth={1.75} />}
      </button>
    </div>
  );
}
