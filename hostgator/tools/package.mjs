// Arma el paquete para HostGator: hostgator/dist/salgado-hostgator.zip
// public_html/ = export estático de Next (out/) + API PHP + .htaccess
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "hostgator", "dist", "salgado-hostgator");
const pub = path.join(dist, "public_html");
if (!existsSync(path.join(root, "out", "index.html"))) throw new Error("Falta out/: corre next build");
// Canónicos/OG: el build debe apuntar al dominio real, nunca a localhost (.env.local).
if (/localhost:\d+/.test(readFileSync(path.join(root, "out", "index.html"), "utf8"))) {
  throw new Error("out/ tiene URLs de localhost: usa `npm run build:hostgator` (fija NEXT_PUBLIC_SITE_URL)");
}
rmSync(dist, { recursive: true, force: true });
mkdirSync(pub, { recursive: true });
cpSync(path.join(root, "out"), pub, { recursive: true });
cpSync(path.join(root, "hostgator", "public"), pub, { recursive: true });
cpSync(path.join(root, "hostgator", "api"), path.join(pub, "api"), { recursive: true });
mkdirSync(path.join(pub, "uploads"), { recursive: true });
// Next 16 exporta los segmentos RSC como carpetas (catalogo/__next.catalogo/__PAGE__.txt)
// pero el cliente los pide con puntos (catalogo/__next.catalogo.__PAGE__.txt): sin esta
// copia cada prefetch da 404 en Apache.
let flattened = 0;
function flattenRsc(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      const walk = (d, prefix) => {
        for (const n of readdirSync(d)) {
          const f = path.join(d, n);
          if (statSync(f).isDirectory()) walk(f, `${prefix}.${n}`);
          else if (n.endsWith(".txt")) {
            cpSync(f, path.join(dir, `${prefix}.${n}`));
            flattened++;
          }
        }
      };
      walk(full, name);
    } else if (name !== "_next" && name !== "api" && name !== "uploads") {
      flattenRsc(full);
    }
  }
}
flattenRsc(pub);
console.log("Segmentos RSC aplanados:", flattened);
if (existsSync(path.join(pub, "salgado-config.php"))) throw new Error("salgado-config.php no puede ir en el paquete");
cpSync(path.join(root, "hostgator", "sql"), path.join(dist, "sql"), { recursive: true });
cpSync(path.join(root, "hostgator", "config.sample.php"), path.join(dist, "salgado-config.sample.php"));
cpSync(path.join(root, "hostgator", "tools", "hash-password.php"), path.join(dist, "hash-password.php"));
const zip = path.join(root, "hostgator", "dist", "salgado-hostgator.zip");
rmSync(zip, { force: true });
if (process.platform === "win32") {
  execFileSync("tar.exe", ["-a", "-c", "-f", zip, "-C", dist, "."], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-qr", zip, "."], { cwd: dist, stdio: "inherit" });
}
console.log("Paquete:", zip);
