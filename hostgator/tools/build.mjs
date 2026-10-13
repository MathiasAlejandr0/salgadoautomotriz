// Build de producción para HostGator: fija la URL pública (ignora .env.local) y empaqueta.
import { execSync } from "node:child_process";

const env = { ...process.env, NEXT_PUBLIC_SITE_URL: "https://salgadoautomotriz.cl" };
execSync("npx next build", { stdio: "inherit", env });
execSync("node hostgator/tools/package.mjs", { stdio: "inherit", env });
