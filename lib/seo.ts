import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: `${SITE.name} – Autos verificados en Puerto Montt`,
} as const;

const verification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ?? "";
export const googleVerification = /^[A-Za-z0-9_-]{10,128}$/.test(verification) ? verification : "";

const GOOGLE_BOT = {
  index: true,
  follow: true,
  "max-image-preview": "large" as const,
  "max-snippet": -1,
  "max-video-preview": -1,
};

const DEFAULT_DESCRIPTION =
  "Encuentra tu próximo auto con Salgado Automotriz. Vehículos verificados, financiamiento claro y entrega inmediata en Puerto Montt.";

export function absoluteUrl(path = "/"): string {
  const base = SITE.url.replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Metadata SEO + OG + canónico por ruta. */
export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image,
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const ogImage = image
    ? { url: image, width: 1200, height: 630, alt: title }
    : OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: "es_CL",
      type: "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [typeof ogImage.url === "string" ? ogImage.url : OG_IMAGE.url],
    },
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true, googleBot: GOOGLE_BOT },
  };
}
