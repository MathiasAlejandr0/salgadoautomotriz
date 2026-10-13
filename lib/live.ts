"use client";

import { useEffect, useState } from "react";
import type { VehicleWithImages } from "@/types/database";

/**
 * Inventario vivo desde el backend PHP (/api/vehicles). El HTML viene con los
 * datos del build; apenas carga la página se reemplazan por los de MySQL.
 */
export function useLiveVehicles(initial: VehicleWithImages[]): VehicleWithImages[] {
  const [vehicles, setVehicles] = useState(initial);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/vehicles", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.vehicles) && data.vehicles.length) {
          setVehicles(data.vehicles);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return vehicles;
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)salgado_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/** fetch para el panel admin: agrega el token CSRF de la sesión PHP. */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") headers.set("X-CSRF-Token", csrfToken());
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}