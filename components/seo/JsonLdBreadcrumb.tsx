import { absoluteUrl } from "@/lib/seo";
import { jsonLd } from "@/lib/html";

export default function JsonLdBreadcrumb({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };

  return (
    <script type="application/ld+json">{jsonLd(data)}</script>
  );
}
