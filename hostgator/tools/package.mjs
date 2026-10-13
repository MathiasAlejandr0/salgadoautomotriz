// Arma el paquete para HostGator: hostgator/dist/salgado-hostgator.zip
// public_html/ = export estático de Next (out/) + API PHP + .htaccess
import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "hostgator", "dist", "salgado-hostgator");
const pub = path.join(dist, "public_html");
if (!existsSync(path.join(root, "out", "index.html"))) throw new Error("Falta out/: corre next build");
rmSync(dist, { recursive: true, force: true });
mkdirSync(pub, { recursive: true });
cpSync(path.join(root, "out"), pub, { recursive: true });
cpSync(path.join(root, "hostgator", "public"), pub, { recursive: true });
cpSync(path.join(root, "hostgator", "api"), path.join(pub, "api"), { recursive: true });
mkdirSync(path.join(pub, "uploads"), { recursive: true });
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
