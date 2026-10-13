import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { buildQlooRequest, type QlooRequest } from "./live";
import {
  countResults,
  QLOO_METHOD_NAMES,
  QlooError,
  qlooResultSchemas,
  type QlooClient,
  type QlooMethodName,
  type QlooMethods,
  type Sourced,
} from "./types";

/**
 * Recorded Qloo snapshots: trimmed internal-type results saved by `npm run qloo:record`.
 *
 * Snapshots contain real Qloo data, so they are written to `.qloo-cache/` which is
 * git-ignored. Qloo's hackathon terms allow private caching but not publishing responses.
 */

export const SNAPSHOT_RELATIVE_PATH = path.join(".qloo-cache", "snapshot.json");

const snapshotEntrySchema = z.object({
  method: z.string(),
  request: z.object({ endpoint: z.string(), params: z.record(z.string(), z.string()) }),
  data: z.unknown(),
});

export const snapshotSchema = z.object({
  recordedAt: z.string(),
  entries: z.record(z.string(), snapshotEntrySchema),
});
export type QlooSnapshot = z.infer<typeof snapshotSchema>;

export function snapshotKey(method: QlooMethodName, request: QlooRequest): string {
  const sorted = Object.keys(request.params)
    .sort()
    .map((k) => `${k}=${request.params[k]}`)
    .join("&");
  return `${method}|${request.endpoint}?${sorted}`;
}

export function emptySnapshot(): QlooSnapshot {
  return { recordedAt: new Date().toISOString(), entries: {} };
}

/** Serves results from a snapshot. Throws `not_recorded` when a call was never recorded. */
export function createRecordedQlooClient(snapshot: QlooSnapshot): QlooClient {
  async function call<M extends QlooMethodName>(
    method: M,
    args: QlooMethods[M]["args"],
  ): Promise<Sourced<QlooMethods[M]["result"]>> {
    const request = buildQlooRequest(method, args);
    const entry = snapshot.entries[snapshotKey(method, request)];
    if (!entry) throw new QlooError("not_recorded", "no recorded snapshot for this call");
    const parsed = qlooResultSchemas[method].safeParse(entry.data);
    if (!parsed.success) throw new QlooError("invalid_response", "recorded snapshot entry is out of date");
    const data = parsed.data as QlooMethods[M]["result"];
    return {
      data,
      source: "recorded",
      call: {
        method,
        endpoint: request.endpoint,
        params: request.params,
        source: "recorded",
        durationMs: 0,
        resultCount: countResults(data),
        cached: false,
      },
    };
  }
  return bindAll(call);
}

/** Wraps a client and copies every successful result into `snapshot`. Used by qloo:record. */
export function createRecordingQlooClient(inner: QlooClient, snapshot: QlooSnapshot): QlooClient {
  async function call<M extends QlooMethodName>(
    method: M,
    args: QlooMethods[M]["args"],
  ): Promise<Sourced<QlooMethods[M]["result"]>> {
    const fn = inner[method] as (a: QlooMethods[M]["args"]) => Promise<Sourced<QlooMethods[M]["result"]>>;
    const result = await fn(args);
    const request = buildQlooRequest(method, args);
    snapshot.entries[snapshotKey(method, request)] = { method, request, data: result.data };
    return result;
  }
  return bindAll(call);
}

type GenericCall = <M extends QlooMethodName>(
  method: M,
  args: QlooMethods[M]["args"],
) => Promise<Sourced<QlooMethods[M]["result"]>>;

/** Builds a full QlooClient from one generic call function. */
export function bindAll(call: GenericCall): QlooClient {
  const client: Partial<Record<QlooMethodName, unknown>> = {};
  for (const method of QLOO_METHOD_NAMES) {
    client[method] = (args: QlooMethods[typeof method]["args"]) => call(method, args);
  }
  return client as QlooClient;
}

/** Loads the private snapshot if one exists and is valid. Never throws. */
export function loadSnapshotFromDisk(rootDir: string = process.cwd()): QlooSnapshot | undefined {
  // C2C_DISABLE_SNAPSHOT=true forces the bundled sample data even if a snapshot exists.
  if (process.env.C2C_DISABLE_SNAPSHOT === "true") return undefined;
  try {
    const file = path.join(rootDir, SNAPSHOT_RELATIVE_PATH);
    if (!fs.existsSync(file)) return undefined;
    const parsed = snapshotSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function saveSnapshotToDisk(snapshot: QlooSnapshot, rootDir: string = process.cwd()): string {
  const file = path.join(rootDir, SNAPSHOT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 1));
  return file;
}
