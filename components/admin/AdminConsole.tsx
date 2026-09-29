"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/layout/Logo";
import { formatCLP, slugify } from "@/lib/utils";
import { calcCuota, pieMinimo } from "@/lib/financing";
import { SITE } from "@/lib/site";
import type { AdminLead, AdminVehicle, StockStatus } from "@/lib/admin-store";
import type { Review } from "@/types/database";

type Tab = "dashboard" | "telemetria" | "inventario" | "crm" | "analitica" | "config";
type CrmTab = "leads" | "resenas" | "testdrives" | "reservas" | "creditos";

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard Ejecutivo", icon: "▦" },
  { id: "telemetria", label: "Telemetría & Salud", icon: "◎" },
  { id: "inventario", label: "Inventario & Multimedia", icon: "🚘" },
  { id: "crm", label: "CRM Comercial & Leads", icon: "👥" },
  { id: "analitica", label: "Analítica & Reportes", icon: "📊" },
  { id: "config", label: "Configuración", icon: "⚙" },
];

const TITLES: Record<Tab, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard Ejecutivo",
    subtitle: "Resumen gerencial de inventario, prospectos y reseñas",
  },
  telemetria: {
    title: "Telemetría & Salud del Negocio",
    subtitle: "Estado del catálogo, leads y sistemas — en lenguaje claro",
  },
  inventario: {
    title: "Inventario & Multimedia",
    subtitle: "Administración de vehículos, fichas y fotos",
  },
  crm: {
    title: "Centro Comercial & Oportunidades (CRM)",
    subtitle: "Prospectos, financiamiento y reseñas de clientes",
  },
  analitica: {
    title: "Analítica & Inteligencia de Negocio",
    subtitle: "Composición del stock y origen de los contactos",
  },
  config: {
    title: "Configuración del Negocio",
    subtitle: "Datos de sucursal, contacto y horario publicados en el sitio",
  },
};

const STATUS_CLASS: Record<StockStatus, string> = {
  Disponible: "bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30",
  "En reserva": "bg-amber-400/15 text-amber-300 border-amber-500/30",
  Vendido: "bg-red-400/15 text-red-300 border-red-500/30",
  Borrador: "bg-white/10 text-white/50 border-white/20",
};

export default function AdminConsole({ initialTab = "dashboard" }: { initialTab?: Tab }) {
  const router = useRouter();
  const [active, setActive] = useState<Tab>(initialTab);
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = useCallback(async () => {
    const [v, l, r] = await Promise.all([
      fetch("/api/admin/vehicles").then((res) => (res.ok ? res.json() : { vehicles: [] })),
      fetch("/api/admin/leads").then((res) => (res.ok ? res.json() : { leads: [] })),
      fetch("/api/admin/reviews").then((res) => (res.ok ? res.json() : { reviews: [] })),
    ]);
    setVehicles(v.vehicles || []);
    setLeads(l.leads || []);
    setReviews(r.reviews || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const [v, l, r] = await Promise.all([
        fetch("/api/admin/vehicles").then((res) => (res.ok ? res.json() : { vehicles: [] })),
        fetch("/api/admin/leads").then((res) => (res.ok ? res.json() : { leads: [] })),
        fetch("/api/admin/reviews").then((res) => (res.ok ? res.json() : { reviews: [] })),
      ]);
      if (cancelled) return;
      setVehicles(v.vehicles || []);
      setLeads(l.leads || []);
      setReviews(r.reviews || []);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  };

  const available = vehicles.filter((v) => v.status === "Disponible").length;
  const stockValue = vehicles
    .filter((v) => v.status !== "Vendido")
    .reduce((acc, v) => acc + v.price, 0);
  const unread = leads.filter((l) => !l.read).length;

  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-white/10 bg-[#0c2138]/80 p-4 lg:flex">
          <div>
            <div className="px-2 py-2">
              <Logo height={36} />
            </div>
            <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[#00BCFE]">
              Portal Administrador Salgado
            </p>
            <nav className="mt-4 space-y-1.5">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActive(n.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                    active === n.id
                      ? "bg-[#00BCFE] text-[#041018] shadow-[0_0_18px_rgba(0,188,254,0.35)]"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="w-5 text-center text-sm">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-xs text-white/40 transition hover:text-white"
            >
              ← Volver al sitio público
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-400/80 transition hover:text-red-300"
            >
              ⏻ Cerrar sesión admin
            </button>
          </div>
        </aside>

        <main className="max-w-7xl flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{TITLES[active].title}</h1>
              <p className="mt-0.5 text-xs text-white/50">{TITLES[active].subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0c2138] px-3.5 py-1.5 text-xs">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#00BCFE]/20 font-bold text-[#00BCFE]">
                  A
                </span>
                <span className="font-medium text-white/80">Administrador Salgado</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-red-400/80 lg:hidden"
              >
                Salir
              </button>
            </div>
          </div>

          <div className="mb-6 flex gap-1.5 overflow-x-auto pb-2 lg:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setActive(n.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${
                  active === n.id
                    ? "bg-[#00BCFE] text-[#041018]"
                    : "bg-[#0c2138] text-white/60"
                }`}
              >
                <span>{n.icon}</span> {n.label}
              </button>
            ))}
          </div>

          {active === "dashboard" && (
            <Dashboard
              vehicles={vehicles}
              leads={leads}
              available={available}
              stockValue={stockValue}
              unread={unread}
              onGo={setActive}
            />
          )}
          {active === "telemetria" && (
            <Telemetry
              vehicles={vehicles.length}
              leads={leads.length}
              unread={unread}
              reviews={reviews.length}
            />
          )}
          {active === "inventario" && <Inventory vehicles={vehicles} onChange={load} />}
          {active === "crm" && (
            <Crm leads={leads} reviews={reviews} vehicles={vehicles} onChange={load} />
          )}
          {active === "analitica" && <Analytics vehicles={vehicles} leads={leads} />}
          {active === "config" && <Config />}
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  value,
  label,
  trend,
}: {
  icon: string;
  value: string;
  label: string;
  trend: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c2138]/80 p-5">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#00BCFE]/15 text-lg text-[#00BCFE]">
          {icon}
        </span>
        <span className="text-xs font-medium text-[#25D366]">{trend}</span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-white">{value}</p>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}

function Dashboard({
  vehicles,
  leads,
  available,
  stockValue,
  unread,
  onGo,
}: {
  vehicles: AdminVehicle[];
  leads: AdminLead[];
  available: number;
  stockValue: number;
  unread: number;
  onGo: (t: Tab) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon="🚘" value={String(vehicles.length)} label="Vehículos en Catálogo" trend={`${available} disponibles`} />
        <Kpi icon="👥" value={String(leads.length)} label="Leads comerciales" trend={`${unread} sin leer`} />
        <Kpi icon="💰" value={formatCLP(stockValue)} label="Valorización de Catálogo" trend="Inventario activo" />
        <Kpi
          icon="📦"
          value={String(available)}
          label="Disponibles"
          trend={`${vehicles.length - available} no disponibles`}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c2138]/60 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Accesos Rápidos</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Quick onClick={() => onGo("inventario")} icon="🚘" title="Catálogo & Fotos" hint="Publicar o editar autos" />
          <Quick onClick={() => onGo("crm")} icon="🔥" title="Centro Comercial" hint="Leads y financiamiento" tone="wa" />
          <Quick onClick={() => onGo("analitica")} icon="📊" title="Analítica" hint="Stock por marca" />
          <Quick onClick={() => onGo("telemetria")} icon="◎" title="Telemetría & Salud" hint="Sistemas y avisos" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Últimos leads"
          action={
            <button type="button" onClick={() => onGo("crm")} className="text-xs text-[#00BCFE] hover:underline">
              Ver todas en CRM →
            </button>
          }
        >
          {leads.length === 0 ? (
            <p className="py-4 text-xs text-white/40">Sin leads registrados aún.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-white/10 text-left text-white/40">
                <tr>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.slice(0, 5).map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 font-medium text-white">{l.nombre}</td>
                    <td className="py-2.5 capitalize text-white/70">{l.type}</td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          l.read ? "bg-white/10 text-white/50" : "bg-[#00BCFE]/15 text-[#00BCFE]"
                        }`}
                      >
                        {l.read ? "Leído" : "Nuevo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="Inventario destacado"
          action={
            <button type="button" onClick={() => onGo("inventario")} className="text-xs text-[#00BCFE] hover:underline">
              Gestionar catálogo →
            </button>
          }
        >
          <div className="space-y-3">
            {vehicles.slice(0, 4).map((v, i) => (
              <div key={v.slug} className="flex items-center gap-3">
                <span className="text-xs font-bold text-white/30">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.image} alt="" className="h-10 w-14 rounded-lg border border-white/10 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {v.brand} {v.model}
                  </p>
                  <p className="text-[11px] font-medium text-[#00BCFE]">{formatCLP(v.price)}</p>
                </div>
                <span className="text-xs text-white/50">{v.status}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Quick({
  onClick,
  icon,
  title,
  hint,
  tone = "cyan",
}: {
  onClick: () => void;
  icon: string;
  title: string;
  hint: string;
  tone?: "cyan" | "wa";
}) {
  const border = tone === "wa" ? "border-[#25D366]/25 bg-[#25D366]/10" : "border-[#00BCFE]/25 bg-[#00BCFE]/10";
  const hintColor = tone === "wa" ? "text-[#25D366]" : "text-[#00BCFE]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:brightness-110 ${border}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-black/20 text-lg">{icon}</span>
      <div>
        <p className="text-xs font-bold text-white">{title}</p>
        <p className={`text-[11px] ${hintColor}`}>{hint}</p>
      </div>
    </button>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c2138]/70 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Telemetry({
  vehicles,
  leads,
  unread,
  reviews,
}: {
  vehicles: number;
  leads: number;
  unread: number;
  reviews: number;
}) {
  const rows = [
    { name: "Catálogo", ok: vehicles > 0, detail: `${vehicles} vehículos cargados` },
    { name: "Leads", ok: true, detail: `${leads} registros · ${unread} pendientes` },
    { name: "Reseñas", ok: reviews > 0, detail: `${reviews} opiniones` },
    { name: "Sitio público", ok: true, detail: SITE.url },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.name} className="rounded-2xl border border-white/10 bg-[#0c2138]/70 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">{r.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                r.ok ? "bg-[#25D366]/15 text-[#25D366]" : "bg-amber-400/15 text-amber-300"
              }`}
            >
              {r.ok ? "Operativo" : "Revisar"}
            </span>
          </div>
          <p className="mt-2 text-xs text-white/50">{r.detail}</p>
        </div>
      ))}
    </div>
  );
}

function Inventory({ vehicles, onChange }: { vehicles: AdminVehicle[]; onChange: () => void }) {
  const [sub, setSub] = useState<"catalogo" | "fotos">("catalogo");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminVehicle | "new" | null>(null);
  const [photoSlug, setPhotoSlug] = useState("");

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const hit =
      !q ||
      `${v.brand} ${v.model} ${v.year}`.toLowerCase().includes(q);
    const st = status === "all" || v.status === status;
    return hit && st;
  });

  const setStatusOf = async (v: AdminVehicle, next: StockStatus) => {
    await fetch(`/api/admin/vehicles/${v.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, featured: next === "Disponible" ? v.featured : false }),
    });
    onChange();
  };

  const remove = async (v: AdminVehicle) => {
    if (!confirm(`¿Eliminar "${v.brand} ${v.model}" del catálogo?`)) return;
    await fetch(`/api/admin/vehicles/${v.slug}`, { method: "DELETE" });
    onChange();
  };

  const duplicate = async (v: AdminVehicle) => {
    await fetch("/api/admin/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v,
        id: undefined,
        slug: `${v.slug}-copia-${Date.now().toString().slice(-4)}`,
        model: `${v.model} (Copia)`,
        featured: false,
        status: "Borrador",
      }),
    });
    onChange();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#071422]/80 p-2">
        <div className="flex gap-1.5">
          {(
            [
              ["catalogo", "🚘 Catálogo de Vehículos"],
              ["fotos", "📸 Estudio de Fotos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold ${
                sub === id ? "bg-[#00BCFE] text-[#041018]" : "text-white/60 hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sub === "fotos" ? (
        <Panel title="Estudio de fotos">
          <p className="mb-3 text-xs text-white/50">
            Elige un vehículo para ver la foto de portada publicada en el sitio.
          </p>
          <select
            value={photoSlug}
            onChange={(e) => setPhotoSlug(e.target.value)}
            className="mb-4 w-full max-w-md rounded-xl border border-white/15 bg-[#050a14] px-3 py-2 text-xs text-white outline-none focus:border-[#00BCFE]"
          >
            <option value="">Selecciona un auto</option>
            {vehicles.map((v) => (
              <option key={v.slug} value={v.slug}>
                {v.brand} {v.model} {v.year}
              </option>
            ))}
          </select>
          {vehicles.find((v) => v.slug === photoSlug) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vehicles.find((v) => v.slug === photoSlug)?.image}
              alt=""
              className="max-h-72 rounded-2xl border border-white/10 object-cover"
            />
          )}
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="rounded-xl bg-[#00BCFE] px-5 py-2.5 text-xs font-bold text-[#041018]"
            >
              + Publicar Vehículo
            </button>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#071422]/70 p-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por marca, modelo o año…"
              className="w-full flex-1 rounded-xl border border-white/15 bg-[#050a14] px-4 py-2 text-xs text-white outline-none placeholder:text-white/40 focus:border-[#00BCFE]"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-white/15 bg-[#050a14] px-3 py-2 text-xs text-white outline-none focus:border-[#00BCFE]"
            >
              <option value="all">Todos los estados</option>
              <option value="Disponible">Disponibles</option>
              <option value="En reserva">En reserva</option>
              <option value="Vendido">Vendidos</option>
              <option value="Borrador">Borradores</option>
            </select>
          </div>
          <Panel title="Lista de Inventario">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-white/40">No hay vehículos con ese filtro.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-sm">
                  <thead className="text-left text-white/40">
                    <tr className="border-b border-white/10">
                      <th className="pb-2.5 font-medium">Vehículo</th>
                      <th className="pb-2.5 font-medium">Año / Km</th>
                      <th className="pb-2.5 font-medium">Precio</th>
                      <th className="pb-2.5 font-medium">Estado</th>
                      <th className="pb-2.5 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v) => {
                      const cuota = Math.round(calcCuota(v.price - pieMinimo(v.price), 48));
                      return (
                        <tr key={v.slug} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={v.image} alt="" className="h-11 w-16 rounded-xl border border-white/10 object-cover" />
                              <div>
                                <p className="font-bold text-white">
                                  {v.brand} {v.model}
                                </p>
                                <p className="text-xs text-white/40">
                                  {v.version} · {v.category}
                                  {v.featured ? " · Destacado" : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <p className="font-medium text-white">{v.year}</p>
                            <p className="text-xs text-white/40">
                              {v.mileage != null ? `${v.mileage.toLocaleString("es-CL")} km` : "—"}
                            </p>
                          </td>
                          <td className="py-3">
                            <p className="font-bold text-[#00BCFE]">{formatCLP(v.price)}</p>
                            <p className="text-[10px] text-white/40">Est. {formatCLP(cuota)}/m</p>
                          </td>
                          <td className="py-3">
                            <select
                              value={v.status}
                              onChange={(e) => setStatusOf(v, e.target.value as StockStatus)}
                              className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-semibold outline-none ${STATUS_CLASS[v.status]}`}
                            >
                              <option value="Disponible">Disponible</option>
                              <option value="En reserva">En reserva</option>
                              <option value="Vendido">Vendido</option>
                              <option value="Borrador">Borrador</option>
                            </select>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button type="button" onClick={() => setEditing(v)} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs hover:bg-[#00BCFE] hover:text-[#041018]">
                                Editar
                              </button>
                              <button type="button" onClick={() => { setPhotoSlug(v.slug); setSub("fotos"); }} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-[#00BCFE] hover:text-[#041018]">
                                Fotos
                              </button>
                              <button type="button" onClick={() => duplicate(v)} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60" title="Duplicar">
                                📑
                              </button>
                              <button type="button" onClick={() => remove(v)} className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500 hover:text-white">
                                Eliminar
                              </button>
                              <Link href={`/catalogo/detalle/${v.slug}`} target="_blank" className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-[#00BCFE]">
                                Ficha
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {editing && (
        <VehicleModal
          vehicle={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function VehicleModal({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle: AdminVehicle | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    brand: vehicle?.brand ?? "",
    model: vehicle?.model ?? "",
    year: String(vehicle?.year ?? new Date().getFullYear()),
    version: vehicle?.version ?? "",
    category: vehicle?.category ?? "SUV",
    price: String(vehicle?.price ?? ""),
    mileage: vehicle?.mileage != null ? String(vehicle.mileage) : "",
    fuel: vehicle?.fuel ?? "Bencina",
    transmission: vehicle?.transmission ?? "Automática",
    description: vehicle?.description ?? "",
    featured: vehicle?.featured ?? false,
    status: vehicle?.status ?? ("Disponible" as StockStatus),
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...vehicle,
      brand: form.brand,
      model: form.model,
      year: Number(form.year),
      version: form.version || null,
      category: form.category,
      price: Number(form.price),
      mileage: form.mileage ? Number(form.mileage) : null,
      fuel: form.fuel,
      transmission: form.transmission,
      description: form.description || null,
      featured: form.featured,
      status: form.status,
      slug: vehicle?.slug || slugify(`${form.brand}-${form.model}-${form.year}`),
    };
    const res = vehicle
      ? await fetch(`/api/admin/vehicles/${vehicle.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo guardar");
      return;
    }
    onSaved();
  };

  const field = "w-full rounded-xl border border-white/15 bg-[#050a14] px-3 py-2 text-sm text-white outline-none focus:border-[#00BCFE]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0c2138] p-6">
        <h3 className="mb-4 text-lg font-bold">{vehicle ? "Editar vehículo" : "Publicar vehículo"}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required placeholder="Marca" className={field} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <input required placeholder="Modelo" className={field} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input required placeholder="Año" className={field} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <input required placeholder="Precio" className={field} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input placeholder="Versión" className={field} value={form.version ?? ""} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          <input placeholder="Kilometraje" className={field} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
          <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {["SUV", "Camioneta", "Sedán", "Hatchback", "Citycar"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StockStatus })}>
            <option>Disponible</option>
            <option>En reserva</option>
            <option>Vendido</option>
            <option>Borrador</option>
          </select>
        </div>
        <textarea
          placeholder="Descripción"
          className={`${field} mt-3`}
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <label className="mt-3 flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          Destacado en la portada
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs text-white/60">
            Cancelar
          </button>
          <button type="submit" className="rounded-xl bg-[#00BCFE] px-4 py-2 text-xs font-bold text-[#041018]">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

function Crm({
  leads,
  reviews,
  vehicles,
  onChange,
}: {
  leads: AdminLead[];
  reviews: Review[];
  vehicles: AdminVehicle[];
  onChange: () => void;
}) {
  const [tab, setTab] = useState<CrmTab>("leads");
  const tabs: { id: CrmTab; label: string }[] = [
    { id: "leads", label: "🔥 Leads & Scoring" },
    { id: "resenas", label: "★ Reseñas" },
    { id: "testdrives", label: "🚗 Pruebas de Manejo" },
    { id: "reservas", label: "★ Reservas" },
    { id: "creditos", label: "💳 Créditos" },
  ];

  const mark = async (id: string) => {
    await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onChange();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#071422]/80 p-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold ${
                tab === t.id ? "bg-[#00BCFE] text-[#041018]" : "text-white/60 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "leads" && (
        <Panel title="Leads comerciales">
          <div className="space-y-3">
            {leads.map((l) => {
              const veh = vehicles.find((v) => v.slug === l.vehicle_slug);
              return (
                <div key={l.id} className={`rounded-xl border p-4 ${l.read ? "border-white/10" : "border-[#00BCFE]/40"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{l.nombre}</p>
                      <p className="text-xs text-white/50">
                        {l.email} · {l.telefono}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#00BCFE]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#00BCFE]">
                      {l.score}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/80">{l.mensaje}</p>
                  {veh && (
                    <p className="mt-1 text-xs text-white/40">
                      {veh.brand} {veh.model}
                    </p>
                  )}
                  {!l.read && (
                    <button type="button" onClick={() => mark(l.id)} className="mt-3 text-xs font-semibold text-[#00BCFE]">
                      Marcar leído
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === "resenas" && <ReviewsPanel reviews={reviews} onChange={onChange} />}

      {tab !== "leads" && tab !== "resenas" && (
        <Panel title={tabs.find((t) => t.id === tab)?.label ?? ""}>
          <p className="text-sm text-white/50">
            Este módulo está en el mismo lugar que en RG Motors. En Salgado los contactos de
            visita y financiamiento entran por Leads. Cuando exista el flujo público de{" "}
            {tab === "testdrives" ? "pruebas de manejo" : tab === "reservas" ? "reservas" : "créditos"}
            , aparecerán aquí.
          </p>
        </Panel>
      )}
    </div>
  );
}

function ReviewsPanel({ reviews, onChange }: { reviews: Review[]; onChange: () => void }) {
  const [nombre, setNombre] = useState("");
  const [texto, setTexto] = useState("");
  const [ciudad, setCiudad] = useState("");

  const add = async (e: FormEvent) => {
    e.preventDefault();
    await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, texto, ciudad, rating: 5, published: true }),
    });
    setNombre("");
    setTexto("");
    setCiudad("");
    onChange();
  };

  return (
    <Panel title="Reseñas de clientes">
      <form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-3">
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="rounded-xl border border-white/15 bg-[#050a14] px-3 py-2 text-xs" />
        <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ciudad" className="rounded-xl border border-white/15 bg-[#050a14] px-3 py-2 text-xs" />
        <input required value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Texto" className="rounded-xl border border-white/15 bg-[#050a14] px-3 py-2 text-xs sm:col-span-2" />
        <button type="submit" className="rounded-xl bg-[#00BCFE] px-3 py-2 text-xs font-bold text-[#041018]">
          Publicar reseña
        </button>
      </form>
      <ul className="space-y-2">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl border border-white/10 p-3 text-sm">
            <p className="font-semibold text-white">
              {r.nombre} <span className="text-[#00BCFE]">{"★".repeat(r.rating)}</span>
            </p>
            <p className="text-white/70">{r.texto}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Analytics({ vehicles, leads }: { vehicles: AdminVehicle[]; leads: AdminLead[] }) {
  const byBrand = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vehicles) map.set(v.brand, (map.get(v.brand) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [vehicles]);
  const max = byBrand[0]?.[1] ?? 1;
  const hot = leads.filter((l) => l.score === "caliente").length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Stock por marca">
        <div className="space-y-2">
          {byBrand.map(([brand, n]) => (
            <div key={brand}>
              <div className="mb-1 flex justify-between text-xs text-white/70">
                <span>{brand}</span>
                <span>{n}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-[#00BCFE]" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Pipeline comercial">
        <Kpi icon="🔥" value={String(hot)} label="Leads calientes" trend={`${leads.length} totales`} />
      </Panel>
    </div>
  );
}

function Config() {
  const rows = [
    ["Nombre", SITE.name],
    ["Web", SITE.url],
    ["Teléfono", SITE.phone],
    ["Email", SITE.email],
    ["Dirección", SITE.address],
    ["Semana", SITE.hours.weekdays],
    ["Sábado", SITE.hours.saturday],
    ["Domingo", SITE.hours.sunday],
  ];
  return (
    <Panel title="Datos publicados">
      <p className="mb-4 text-xs text-white/50">
        Estos valores salen de la ficha del negocio y se muestran en el sitio, WhatsApp y el pie.
      </p>
      {SITE.phoneIsPlaceholder && (
        <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          El WhatsApp sigue en el número de ejemplo. Define NEXT_PUBLIC_WHATSAPP_E164 antes de publicar.
        </p>
      )}
      <dl className="divide-y divide-white/10">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 py-3 text-sm">
            <dt className="text-white/40">{k}</dt>
            <dd className="font-medium text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

