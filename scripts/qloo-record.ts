/**
 * npm run qloo:record
 * Refreshes the private Qloo snapshot used as the offline fallback.
 *
 * It replays the built-in demo scenario against the live API and saves the trimmed,
 * internal-type results to .qloo-cache/snapshot.json. That folder is git-ignored:
 * Qloo's hackathon terms allow private caching but not publishing response data.
 * The API key is never written to the snapshot.
 */
import { readServerEnv } from "../src/server/env";
import { createLiveQlooClient, getLastQlooQuota } from "../src/server/qloo/live";
import { createRecordingQlooClient, emptySnapshot, saveSnapshotToDisk } from "../src/server/qloo/recorded";
import { QlooError } from "../src/server/qloo/types";
import { loadEnvLocal } from "./load-env";
import { recordScenario } from "./record-scenario";

async function main() {
  loadEnvLocal();
  const env = readServerEnv();
  if (!env.qlooApiKey) {
    console.log("Cannot record: QLOO_API_KEY is empty in .env.local.");
    process.exitCode = 1;
    return;
  }
  const snapshot = emptySnapshot();
  // The in-memory cache stays on so calls shared between runs are made only once.
  const live = createLiveQlooClient({ apiKey: env.qlooApiKey, baseUrl: env.qlooApiUrl });
  const client = createRecordingQlooClient(live, snapshot);

  try {
    await recordScenario(client);
  } catch (err) {
    console.log(`Recording stopped early: ${err instanceof QlooError || err instanceof Error ? err.message : "unexpected error"}`);
    process.exitCode = 1;
  }

  const count = Object.keys(snapshot.entries).length;
  if (count === 0) {
    console.log("Nothing was recorded; the existing snapshot (if any) was left untouched.");
    return;
  }
  const text = JSON.stringify(snapshot);
  if (text.includes(env.qlooApiKey) || /x-api-key/i.test(text)) {
    console.log("Refusing to save: the snapshot unexpectedly contains key material.");
    process.exitCode = 1;
    return;
  }
  const file = saveSnapshotToDisk(snapshot);
  console.log(`Recorded ${count} calls (${Math.round(text.length / 1024)} KB) to ${file}`);
  console.log("This file is private and git-ignored. Do not commit or share it.");
  const quota = getLastQlooQuota();
  if (quota?.monthRemaining !== undefined) console.log(`Quota: ${quota.monthRemaining} monthly calls remaining`);
}

main().catch(() => {
  console.log("Recording failed (unexpected error)");
  process.exitCode = 1;
});
