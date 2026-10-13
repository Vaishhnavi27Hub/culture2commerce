import { readServerEnv, type ServerEnv } from "../env";
import { createFallbackQlooClient, type FallbackLayer } from "./fallback";
import { createLiveQlooClient } from "./live";
import { createRecordedQlooClient, loadSnapshotFromDisk, type QlooSnapshot } from "./recorded";
import { createSampleQlooClient } from "./sample";
import type { QlooClient } from "./types";

export * from "./types";

export interface QlooClientOptions {
  env?: ServerEnv;
  /** Override the private snapshot (tests). `null` means "no snapshot". */
  snapshot?: QlooSnapshot | null;
  fetchImpl?: typeof fetch;
}

/**
 * Builds the app's Qloo client.
 *
 * QLOO_MODE=live (default): live API, then the private recorded snapshot, then bundled sample.
 * QLOO_MODE=recorded: recorded snapshot, then bundled sample. The live API is never called.
 */
export function createQlooClient(options: QlooClientOptions = {}): QlooClient {
  const env = options.env ?? readServerEnv();
  const snapshot = options.snapshot === undefined ? loadSnapshotFromDisk() : options.snapshot;

  const layers: FallbackLayer[] = [];
  if (env.qlooMode === "live") {
    layers.push({
      label: "live",
      client: createLiveQlooClient({
        apiKey: env.qlooApiKey,
        baseUrl: env.qlooApiUrl,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      }),
    });
  }
  if (snapshot) layers.push({ label: "recorded", client: createRecordedQlooClient(snapshot) });
  layers.push({ label: "sample", client: createSampleQlooClient() });
  return createFallbackQlooClient(layers);
}

let singleton: QlooClient | undefined;

/** Shared client for the running server, so the breaker state and cache persist across runs. */
export function getQlooClient(): QlooClient {
  singleton ??= createQlooClient();
  return singleton;
}
