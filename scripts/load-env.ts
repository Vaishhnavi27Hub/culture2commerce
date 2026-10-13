import fs from "node:fs";
import path from "node:path";

/**
 * Loads KEY=value pairs from .env.local into process.env for scripts and live tests.
 * (Next.js does this itself for the app.) Existing variables win. Values are never printed.
 */
export function loadEnvLocal(rootDir: string = process.cwd()): void {
  const file = path.join(rootDir, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1] as string;
    const value = (match[2] ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = value;
  }
}
