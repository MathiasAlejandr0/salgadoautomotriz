// Next (trailingSlash: false) escribe catalogo/detalle/<slug>.html.
// El servidor todavía tiene carpetas <slug>/index.html de un export anterior:
// Apache las sirve con DirectoryIndex y el CSS de ese HTML ya no existe.
// Esta copia deja el mismo HTML vigente en esa ruta para que el deploy la pise.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "out", "catalogo", "detalle");
let entries;
try {
  entries = readdirSync(dir);
} catch {
  console.error("No está out/catalogo/detalle. Corre next build antes.");
  process.exit(1);
}

const htmlFiles = entries.filter((name) => name.endsWith(".html") && statSync(path.join(dir, name)).isFile());
let copied = 0;
for (const name of htmlFiles) {
  const slug = name.slice(0, -".html".length);
  if (!/^[a-z0-9_-]+$/.test(slug)) continue;
  const destDir = path.join(dir, slug);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(path.join(dir, name), path.join(destDir, "index.html"));
  copied++;
}
console.log(`Fichas espejo index.html: ${copied}`);
