import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/seo";
import { jsonLd } from "@/lib/html";

export default function JsonLdCarDealer() {
  const dealerId = `${SITE.url}/#dealer`;
  const websiteId = `${SITE.url}/#website`;
  const dealer: Record<string, unknown> = {
    "@type": "AutoDealer",
    "@id": dealerId,
    name: SITE.name,
    url: SITE.url,
    telephone: SITE.phone,
    email: SITE.email,
    image: absoluteUrl("/og.png"),
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.addressLine,
      addressLocality: SITE.city,
      addressRegion: "Los Lagos",
      addressCountry: "CL",
    },
    areaServed: "Puerto Montt",
    sameAs: [
      "https://instagram.com/salgadoautomotriz",
      "https://facebook.com/salgadoautomotriz",
    ],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "10:00",
        closes: "17:00",
      },
    ],
  };

  if (SITE.googleRating && SITE.googleRatingCount) {
    dealer.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: SITE.googleRating,
      bestRating: "5",
      ratingCount: String(SITE.googleRatingCount),
    };
  }

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      dealer,
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SITE.name,
        url: SITE.url,
        inLanguage: "es-CL",
        publisher: { "@id": dealerId },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE.url}/catalogo?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script type="application/ld+json">{jsonLd(data)}</script>
  );
}
