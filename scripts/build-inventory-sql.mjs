import fs from "node:fs";

const cache = JSON.parse(fs.readFileSync(".cache/salgado-inventory.json", "utf8"));
const vehicles = cache.vehicles;
if (!Array.isArray(vehicles) || !vehicles.length) {
  throw new Error("El cache de inventario está vacío");
}

const q = (value) => {
  if (value == null || value === "") return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
};

const fuelOk = new Set(["Bencina", "Diésel", "Híbrido", "Eléctrico"]);
const transOk = new Set(["Manual", "Automática"]);

const rows = vehicles.map((v) => {
  const fuel = fuelOk.has(v.fuel) ? v.fuel : null;
  const transmission = transOk.has(v.transmission) ? v.transmission : null;
  return `(${[
    q(v.stock_id),
    q(v.plate),
    q(v.slug),
    q(v.brand),
    q(v.model),
    Number(v.year),
    q(v.version),
    q(v.category),
    q(fuel),
    q(transmission),
    v.mileage == null ? "null" : Number(v.mileage),
    q(v.color),
    Number(v.price),
    q(v.description),
    q(v.location),
    q(v.origin),
    q("Disponible"),
    v.published === false ? "false" : "true",
    v.featured ? "true" : "false",
  ].join(", ")})`;
});

const photos = [];
for (const v of vehicles) {
  for (const img of v.vehicle_images ?? []) {
    if (!img?.storage_path) continue;
    photos.push(`(${q(v.slug)}, ${q(img.storage_path)}, ${Number(img.sort_order) || 0})`);
  }
}

const slugs = vehicles.map((v) => q(v.slug)).join(", ");

const sql = `
begin;

insert into public.vehicles (
  stock_id, plate, slug, brand, model, year, version, category,
  fuel, transmission, mileage, color, price, description,
  location, origin, status, published, featured
) values
${rows.join(",\n")}
on conflict (slug) do update set
  stock_id = excluded.stock_id,
  plate = excluded.plate,
  brand = excluded.brand,
  model = excluded.model,
  year = excluded.year,
  version = excluded.version,
  category = excluded.category,
  fuel = excluded.fuel,
  transmission = excluded.transmission,
  mileage = excluded.mileage,
  color = excluded.color,
  price = excluded.price,
  description = excluded.description,
  location = excluded.location,
  origin = excluded.origin,
  status = excluded.status,
  published = excluded.published,
  featured = excluded.featured,
  updated_at = now();

delete from public.vehicle_images
where vehicle_id in (select id from public.vehicles where slug in (${slugs}));

insert into public.vehicle_images (vehicle_id, storage_path, sort_order)
select v.id, x.path, x.sort_order
from (values
${photos.join(",\n")}
) as x(slug, path, sort_order)
join public.vehicles v on v.slug = x.slug;

commit;
`;

fs.mkdirSync(".cache", { recursive: true });
fs.writeFileSync(".cache/load-inventory.sql", sql);
console.log(`sql vehicles=${vehicles.length} photos=${photos.length} bytes=${sql.length}`);
