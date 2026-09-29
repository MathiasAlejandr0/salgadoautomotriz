import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getVehicles } from "@/lib/queries";

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url;
  const staticPages = [
    "",
    "/catalogo",
    "/financiamiento",
    "/consigna",
    "/nosotros",
    "/contacto",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const vehicles = (await getVehicles()).map((v) => ({
    url: `${base}/catalogo/detalle/${v.slug}`,
    lastModified: new Date(v.updated_at || v.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...vehicles];
}
