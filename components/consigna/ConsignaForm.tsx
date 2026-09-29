"use client";

import { useState, type FormEvent } from "react";
import { ImagePlus, Lock, X } from "lucide-react";
import { waUrl } from "@/lib/site";
import HoneypotField from "@/components/shared/HoneypotField";

export const MAX_FOTOS = 8;

const MARCAS = [
  "BMW",
  "Chery",
  "Chevrolet",
  "Dongfeng",
  "Ford",
  "Foton",
  "Geely",
  "Great Wall",
  "Hyundai",
  "JAC",
  "Jetour",
  "Kia",
  "Maxus",
  "Mercedes-Benz",
  "MG",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "SsangYong",
  "Suzuki",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => new Date().getFullYear() - i);

const field =
  "mt-1 w-full rounded-[10px] border border-white/10 bg-[#0c1628] px-3.5 py-3 text-[16px] text-white outline-none placeholder:text-white/30 focus:border-[#00BCFE] sm:py-2.5 sm:text-sm";

type FotoPayload = { name: string; type: string; data: string };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la foto."));
    };
    img.src = url;
  });
}

async function compressFoto(file: File): Promise<FotoPayload> {
  const img = await loadImage(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  return {
    name: file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg",
    type: "image/jpeg",
    data: dataUrl.replace(/^data:[^;]+;base64,/, ""),
  };
}

export default function ConsignaForm() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [patente, setPatente] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [year, setYear] = useState("");
  const [kms, setKms] = useState("");
  const [notas, setNotas] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].filter((f) => f.type.startsWith("image/")).slice(0, MAX_FOTOS);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const company_website = String(new FormData(e.currentTarget).get("company_website") ?? "");
    try {
      const fotos = [];
      for (const file of files) fotos.push(await compressFoto(file));
      const res = await fetch("/api/consigna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          telefono,
          email,
          patente,
          marca,
          modelo,
          year,
          kms,
          notas,
          fotos,
          company_website,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      setSent(true);
    } catch {
      setError("No se pudo enviar. Revisa las fotos e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-brand-accent/50 bg-brand-bg/80 p-6 shadow-[0_0_50px_rgba(0,188,254,0.16)] backdrop-blur sm:p-8">
        <h2 className="text-2xl font-semibold text-white">Recibimos tu consignación</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Salgado Automotriz ya tiene tus datos
          {files.length ? ` y ${files.length} foto${files.length === 1 ? "" : "s"}` : ""}. Te contactamos a la brevedad.
        </p>
        <a
          href={waUrl(
            `Hola, soy ${nombre}. Dejé en consignación ${marca || "mi auto"} ${modelo} ${year}, patente ${patente}.`
          )}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex rounded-xl bg-brand-accent px-5 py-3 text-sm font-semibold text-[#041018] hover:bg-[#33c9fe]"
        >
          Escribir por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      className="rounded-3xl border border-brand-accent/50 bg-brand-bg/80 p-5 shadow-[0_0_50px_rgba(0,188,254,0.16)] backdrop-blur sm:p-6"
      onSubmit={(e) => void onSubmit(e)}
    >
      <HoneypotField />
      <h2 className="text-2xl font-semibold text-white">Datos del vehículo</h2>
      <div className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-white/55">
            Nombre
            <input className={field} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </label>
          <label className="text-xs text-white/55">
            WhatsApp
            <input className={field} placeholder="9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
          </label>
        </div>
        <label className="text-xs text-white/55">
          Correo (opcional)
          <input className={field} type="email" placeholder="ivan.p@example.net" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="text-xs text-white/55">
          Patente
          <input className={field} placeholder="Ej: ABCD12" value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} />
        </label>
        <label className="text-xs text-white/55">
          Marca
          <select className={field} value={marca} onChange={(e) => setMarca(e.target.value)} required>
            <option value="">Selecciona</option>
            {MARCAS.map((m) => (
              <option key={m}>{m}</option>
            ))}
            <option>Otra</option>
          </select>
        </label>
        <label className="text-xs text-white/55">
          Modelo
          <input className={field} placeholder="Ej: CX-5" value={modelo} onChange={(e) => setModelo(e.target.value)} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-white/55">
            Año
            <select className={field} value={year} onChange={(e) => setYear(e.target.value)} required>
              <option value="">Año</option>
              {YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/55">
            Kilometraje
            <input className={field} placeholder="Ej: 85.000" value={kms} onChange={(e) => setKms(e.target.value)} />
          </label>
        </div>
        <label className="text-xs text-white/55">
          Comentarios
          <textarea
            className={`${field} min-h-24 resize-y`}
            placeholder="Estado, dueños, papeles, lo que quieras que sepamos."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>
        <div>
          <p className="text-xs text-white/55">Fotos del vehículo (hasta {MAX_FOTOS})</p>
          <label className="mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-6 text-center text-sm text-white/70 hover:border-brand-accent/50">
            <ImagePlus size={20} className="text-brand-accent" />
            <span>Sube fotos o suéltalas aquí</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {previews.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <li key={src} className="relative">
                  {/* blob: URL local; el optimizador de next/image no aplica */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-bg text-white"
                    onClick={() => removeFile(i)}
                    aria-label="Quitar foto"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p className="text-sm text-[#ff6b81]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-accent py-3.5 font-semibold text-[#041018] hover:bg-[#33c9fe] disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Enviar consignación"}
        </button>
        <p className="flex items-center justify-center gap-2 text-xs text-white/45">
          <Lock size={12} /> Sin compromiso · 100% confidencial
        </p>
      </div>
    </form>
  );
}
