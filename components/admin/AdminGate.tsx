"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminConsole from "@/components/admin/AdminConsole";

const TABS = ["dashboard", "telemetria", "inventario", "crm", "analitica", "config"] as const;
type Tab = (typeof TABS)[number];

/** Reemplaza al middleware: sin sesión PHP válida vuelve al login. */
export default function AdminGate() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const tab = params.get("tab");
  const initial = TABS.includes(tab as Tab) ? (tab as Tab) : "dashboard";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setReady(true);
        else router.replace("/admin/login");
      })
      .catch(() => router.replace("/admin/login"));
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <div className="min-h-screen bg-[#050a14]" aria-busy="true" />;
  return <AdminConsole initialTab={initial} />;
}