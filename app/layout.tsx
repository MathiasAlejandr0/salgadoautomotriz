import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import JsonLdCarDealer from "@/components/seo/JsonLdCarDealer";
import GoogleAnalytics from "@/components/seo/GoogleAnalytics";
import { SITE } from "@/lib/site";
import { OG_IMAGE, googleVerification } from "@/lib/seo";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const description =
  "Encuentra tu próximo auto con Salgado Automotriz. Vehículos verificados, financiamiento claro y entrega inmediata en Puerto Montt.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} – Venta de Autos Usados en Chile`,
    template: `%s | ${SITE.name}`,
  },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    siteName: SITE.name,
    locale: "es_CL",
    type: "website",
    url: SITE.url,
    title: SITE.name,
    description,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: "Tu próximo auto empieza aquí.",
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: googleVerification ? { google: googleVerification } : undefined,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${montserrat.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-brand-bg text-brand-text">
        <JsonLdCarDealer />
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
