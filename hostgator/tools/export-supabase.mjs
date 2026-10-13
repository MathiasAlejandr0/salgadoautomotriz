// Exportación única y de SOLO LECTURA de Supabase → INSERTs MySQL.
// Uso: node hostgator/tools/export-supabase.mjs [salida.sql]
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o, si falta, la anon key)
// desde el entorno o .env.local. No imprime ninguna clave. La salida trae datos
// personales (leads): no la subas a git.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const role = process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role" : "anon (solo datos públicos)";
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y una clave de Supabase");
  process.exit(1);
}
const out = process.argv[2] || "hostgator/dist/migration-data.sql";

async function all(table, order = "created_at") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&order=${order}.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function q(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\0/g, "") + "'";
}
function dt(v) {
  if (!v) return "UTC_TIMESTAMP(3)";
  return q(new Date(v).toISOString().replace("T", " ").replace("Z", ""));
}
function img(p) {
  if (!p) return p;
  if (/^https?:\/\//.test(p) || p.startsWith("/")) return p;
  // Supabase Storage: la foto se sirve desde su URL pública hasta copiarla a /uploads.
  return `${url}/storage/v1/object/public/vehicle-photos/${p}`;
}

const lines = ["-- Datos migrados desde Supabase (" + new Date().toISOString() + ", rol " + role + ")", "SET NAMES utf8mb4;", "START TRANSACTION;"];
const counts = {};
async function dump(table, fn, order) {
  try {
    const rows = await all(table, order);
    counts[table] = rows.length;
    for (const r of rows) lines.push(fn(r));
  } catch (err) {
    counts[table] = `error: ${err.message}`;
  }
}

await dump("vehicles", (r) =>
  `INSERT IGNORE INTO vehicles (id, source, stock_id, plate, slug, brand, model, year, version, category, fuel, transmission, mileage, color, doors, engine, price, description, location, origin, status, published, featured, created_at, updated_at) VALUES (${[
    q(r.id), "'admin'", q(r.stock_id), q(r.plate), q(r.slug), q(r.brand), q(r.model), q(r.year), q(r.version), q(r.category), q(r.fuel),
    q(r.transmission), q(r.mileage), q(r.color), q(r.doors), q(r.engine), q(r.price), q(r.description), q(r.location), q(r.origin),
    q(r.status ?? "Disponible"), q(r.published), q(r.featured), dt(r.created_at), dt(r.updated_at),
  ].join(", ")});`);
await dump("vehicle_images", (r) =>
  `INSERT IGNORE INTO vehicle_images (id, vehicle_id, storage_path, sort_order, created_at) VALUES (${[q(r.id), q(r.vehicle_id), q(img(r.storage_path)), q(r.sort_order), dt(r.created_at)].join(", ")});`);
await dump("contact_leads", (r) =>
  `INSERT IGNORE INTO contact_leads (id, nombre, email, telefono, mensaje, vehicle_slug, is_read, created_at) VALUES (${[q(r.id), q(r.nombre), q(r.email), q(r.telefono), q(r.mensaje), q(r.vehicle_slug), q(r.read), dt(r.created_at)].join(", ")});`);
await dump("financing_leads", (r) =>
  `INSERT IGNORE INTO financing_leads (id, nombre, email, telefono, vehicle_slug, pie, plazo, renta, mensaje, is_read, created_at) VALUES (${[q(r.id), q(r.nombre), q(r.email), q(r.telefono), q(r.vehicle_slug), q(r.pie), q(r.plazo), q(r.renta), q(r.mensaje), q(r.read), dt(r.created_at)].join(", ")});`);
await dump("reviews", (r) =>
  `INSERT IGNORE INTO reviews (id, nombre, ciudad, rating, texto, published, created_at) VALUES (${[q(r.id), q(r.nombre), q(r.ciudad), q(r.rating), q(r.texto), q(r.published), dt(r.created_at)].join(", ")});`);
lines.push("COMMIT;");
writeFileSync(out, lines.join("\n") + "\n");
console.log(JSON.stringify({ out, role, counts }));