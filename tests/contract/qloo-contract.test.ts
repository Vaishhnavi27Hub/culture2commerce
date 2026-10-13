import { beforeEach, describe, expect, it } from "vitest";
import { clearQlooCache, createLiveQlooClient } from "@/server/qloo/live";
import { createRecordedQlooClient, createRecordingQlooClient, emptySnapshot, snapshotSchema } from "@/server/qloo/recorded";
import { createSampleQlooClient } from "@/server/qloo/sample";
import {
  QLOO_METHOD_NAMES,
  qlooCallRecordSchema,
  qlooResultSchemas,
  type QlooClient,
  type QlooMethodName,
  type Sourced,
} from "@/server/qloo/types";
import { makeMockFetch, METHOD_ARGS, TEST_KEY } from "../fixtures/raw-qloo";

/** Calls a method by name with its representative arguments. */
function invoke(client: QlooClient, method: QlooMethodName): Promise<Sourced<unknown>> {
  const fn = client[method] as (args: unknown) => Promise<Sourced<unknown>>;
  return fn(METHOD_ARGS[method]);
}

describe("Qloo client contract: live mapper, recorded snapshot and bundled sample agree on types", () => {
  beforeEach(() => clearQlooCache());

  it.each(QLOO_METHOD_NAMES)("%s: recorded client returns exactly what the live mapper produced", async (method) => {
    const { fetchImpl } = makeMockFetch();
    const live = createLiveQlooClient({ apiKey: TEST_KEY, baseUrl: "https://qloo.test", fetchImpl, minIntervalMs: 0 });
    const snapshot = emptySnapshot();
    const recording = createRecordingQlooClient(live, snapshot);

    const liveResult = await invoke(recording, method);
    // Round-trip through JSON, exactly as the snapshot file on disk would.
    const reloaded = snapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)));
    const recordedResult = await invoke(createRecordedQlooClient(reloaded), method);

    expect(recordedResult.data).toEqual(liveResult.data);
    expect(liveResult.source).toBe("live");
    expect(recordedResult.source).toBe("recorded");
    expect(recordedResult.call.endpoint).toBe(liveResult.call.endpoint);
    expect(recordedResult.call.params).toEqual(liveResult.call.params);
    expect(() => qlooResultSchemas[method].parse(liveResult.data)).not.toThrow();
    expect(() => qlooCallRecordSchema.parse(recordedResult.call)).not.toThrow();
  });

  it.each(QLOO_METHOD_NAMES)("%s: bundled sample satisfies the same schema and is labelled sample", async (method) => {
    const result = await invoke(createSampleQlooClient(), method);
    expect(result.source).toBe("sample");
    expect(result.call.source).toBe("sample");
    expect(() => qlooResultSchemas[method].parse(result.data)).not.toThrow();
    expect(() => qlooCallRecordSchema.parse(result.call)).not.toThrow();
  });

  it("snapshots never contain the API key or any header", async () => {
    const { fetchImpl } = makeMockFetch();
    const live = createLiveQlooClient({ apiKey: TEST_KEY, baseUrl: "https://qloo.test", fetchImpl, minIntervalMs: 0 });
    const snapshot = emptySnapshot();
    const recording = createRecordingQlooClient(live, snapshot);
    for (const method of QLOO_METHOD_NAMES) await invoke(recording, method);

    const text = JSON.stringify(snapshot);
    expect(Object.keys(snapshot.entries)).toHaveLength(QLOO_METHOD_NAMES.length);
    expect(text).not.toContain(TEST_KEY);
    expect(text.toLowerCase()).not.toContain("x-api-key");
  });

  it("a recorded client reports not_recorded for calls it has never seen", async () => {
    const client = createRecordedQlooClient(emptySnapshot());
    await expect(client.searchTags({ query: "unknown" })).rejects.toMatchObject({ kind: "not_recorded" });
  });
});
