export const SITE = {
  name: "Salgado Automotriz",
  url: "https://salgadoautomotriz.cl",
  phone: "+56 9 1234 5678",
  phoneRaw: "56912345678",
  email: "contacto@salgadoautomotriz.cl",
  address: "Cardonal #15, Puerto Montt",
  addressLine: "Cardonal #15",
  city: "Puerto Montt",
  region: "Región de Los Lagos",
  mapQuery: "Cardonal 15, Puerto Montt, Chile",
  googleRating: "4.9",
  hours: {
    weekdays: "Lun – Vie 9:00 – 19:00",
    saturday: "Sábado 10:00 – 17:00",
    sunday: "Domingo cerrado",
  },
} as const;

export function waUrl(message: string): string {
  return `https://wa.me/${SITE.phoneRaw}?text=${encodeURIComponent(message)}`;
}
