"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __GA4_ID?: string;
  }
}

/**
 * GA4 configurable en el servidor: /api/analytics.js lee 'ga4_id' de
 * salgado-config.php (vacío = no carga nada). No mide el panel admin.
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  const search = useSearchParams();
  const skip = pathname.startsWith("/admin");
  const first = useRef(true);

  useEffect(() => {
    if (skip) return;
    if (first.current) {
      first.current = false; // la primera vista la registra analytics.js
      return;
    }
    const id = window.__GA4_ID;
    if (!id || typeof window.gtag !== "function") return;
    const query = search.toString();
    window.gtag("config", id, { page_path: query ? `${pathname}?${query}` : pathname, anonymize_ip: true });
  }, [pathname, search, skip]);

  if (skip) return null;
  return <Script src="/api/analytics.js" strategy="afterInteractive" />;
}
