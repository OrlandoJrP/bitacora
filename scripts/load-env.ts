/**
 * Carga .env.local y .env (sin dependencias) para los scripts one-off ejecutados
 * con tsx (migrate/seed) en local. En DigitalOcean las variables ya vienen
 * inyectadas en el entorno, así que este loader no las sobrescribe.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadFile(path: string): void {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadFile(resolve(process.cwd(), ".env.local"));
loadFile(resolve(process.cwd(), ".env"));
