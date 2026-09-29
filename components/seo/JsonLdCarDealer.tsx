import { SITE } from "@/lib/site";
import { jsonLd } from "@/lib/html";

export default function JsonLdCarDealer() {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CarDealer",
    name: SITE.name,
    url: SITE.url,
    telephone: SITE.phone,
    email: SITE.email,
    image: `${SITE.url}/og.png`,
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
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: SITE.googleRating,
      bestRating: "5",
      ratingCount: String(SITE.googleRatingCount),
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}
