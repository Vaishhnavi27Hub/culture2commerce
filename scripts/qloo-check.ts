/**
 * npm run qloo:check
 * Makes three small live Qloo calls and prints pass/fail with latency.
 * Never prints the API key. Writes the result to .dev-status/qloo-check.json for the /dev page.
 */
import fs from "node:fs";
import path from "node:path";
import { readServerEnv } from "../src/server/env";
import { createLiveQlooClient, getLastQlooQuota } from "../src/server/qloo/live";
import { QlooError } from "../src/server/qloo/types";
import { loadEnvLocal } from "./load-env";

interface CheckResult {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
}

async function main() {
  loadEnvLocal();
  const env = readServerEnv();
  const results: CheckResult[] = [];

  if (!env.qlooApiKey) {
    console.log("FAIL  QLOO_API_KEY is empty. Paste your key into .env.local (QLOO_API_KEY=...).");
    writeStatus({ ok: false, results, note: "QLOO_API_KEY is not set" });
    process.exitCode = 1;
    return;
  }

  const client = createLiveQlooClient({ apiKey: env.qlooApiKey, baseUrl: env.qlooApiUrl, cacheTtlMs: 0 });
  let anchorIds: string[] = [];

  async function check(name: string, fn: () => Promise<string>) {
    const started = Date.now();
    try {
      const detail = await fn();
      results.push({ name, ok: true, ms: Date.now() - started, detail });
    } catch (err) {
      const detail = err instanceof QlooError ? err.message : "unexpected error";
      results.push({ name, ok: false, ms: Date.now() - started, detail });
    }
  }

  await check("GET /v2/tags (tag search: coffee)", async () => {
    const r = await client.searchTags({ query: "coffee", take: 3 });
    if (r.data.length === 0) throw new QlooError("invalid_response", "no tags returned");
    return `${r.data.length} tags`;
  });

  await check("GET /v2/insights (places in Indiranagar, Bengaluru)", async () => {
    const r = await client.getLocalityPlaces({ locality: "Indiranagar", city: "Bengaluru", take: 5 });
    if (r.data.places.length === 0) throw new QlooError("invalid_response", "no places returned");
    anchorIds = r.data.places.slice(0, 3).map((p) => p.id);
    return `${r.data.places.length} places, resolved to "${r.data.resolved?.name ?? "unresolved"}"`;
  });

  await check("GET /v2/insights (taste tags for those venues)", async () => {
    if (anchorIds.length === 0) throw new QlooError("invalid_response", "skipped: no anchor venues from previous check");
    const r = await client.getTasteTags({ anchorIds, tagTypes: ["urn:tag:genre:place"], take: 5 });
    if (r.data.length === 0) throw new QlooError("invalid_response", "no taste tags returned");
    return `${r.data.length} tags with affinity`;
  });

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.ms} ms  ${r.detail}`);
  }
  const ok = results.every((r) => r.ok);
  const quota = getLastQlooQuota();
  if (quota?.monthRemaining !== undefined) {
    console.log(`Quota: ${quota.monthRemaining} of ${quota.monthLimit ?? "?"} monthly calls remaining`);
  }
  console.log(ok ? "Qloo check: ALL PASSED" : "Qloo check: FAILED");
  writeStatus({ ok, results, ...(quota?.monthRemaining !== undefined ? { monthRemaining: quota.monthRemaining } : {}) });
  if (!ok) process.exitCode = 1;
}

function writeStatus(status: Record<string, unknown>) {
  const dir = path.join(process.cwd(), ".dev-status");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "qloo-check.json"), JSON.stringify({ checkedAt: new Date().toISOString(), ...status }, null, 2));
}

main().catch(() => {
  console.log("Qloo check: FAILED (unexpected error)");
  process.exitCode = 1;
});
