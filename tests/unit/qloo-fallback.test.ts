import { beforeEach, describe, expect, it } from "vitest";
import { readServerEnv } from "@/server/env";
import { createQlooClient } from "@/server/qloo";
import { clearQlooCache, createLiveQlooClient } from "@/server/qloo/live";
import { createRecordingQlooClient, emptySnapshot } from "@/server/qloo/recorded";
import { createSampleQlooClient } from "@/server/qloo/sample";
import { makeMockFetch, METHOD_ARGS, TEST_KEY } from "../fixtures/raw-qloo";

const env = (over: Record<string, string>) =>
  readServerEnv({ QLOO_API_URL: "https://qloo.test", QLOO_API_KEY: TEST_KEY, QLOO_MODE: "live", ...over });

describe("Qloo fallback chain", () => {
  beforeEach(() => clearQlooCache());

  it("uses live data when the API answers", async () => {
    const { fetchImpl } = makeMockFetch();
    const client = createQlooClient({ env: env({}), snapshot: null, fetchImpl });
    const r = await client.searchTags(METHOD_ARGS.searchTags);
    expect(r.source).toBe("live");
    expect(r.call.fallbackReason).toBeUndefined();
  });

  it("falls back to sample data with a reason when the key is missing", async () => {
    const { fetchImpl, calls } = makeMockFetch();
    const client = createQlooClient({ env: env({ QLOO_API_KEY: "" }), snapshot: null, fetchImpl });
    const r = await client.getLocalityPlaces({ locality: "Indiranagar", city: "Bengaluru" });
    expect(calls).toHaveLength(0);
    expect(r.source).toBe("sample");
    expect(r.call.fallbackReason).toBe("live: QLOO_API_KEY is not set");
    expect(r.data.places.length).toBeGreaterThan(0);
    expect(r.data.places.every((p) => p.name.endsWith("(sample)"))).toBe(true);
  });

  it("falls back per call on HTTP 403 without tripping the breaker", async () => {
    let fail = true;
    const { fetchImpl, calls } = makeMockFetch(() =>
      fail ? new Response("{}", { status: 403 }) : Response.json({ results: { tags: [{ id: "t1", name: "T", type: "x" }] } }),
    );
    const client = createQlooClient({ env: env({}), snapshot: null, fetchImpl });
    const first = await client.searchTags({ query: "one" });
    expect(first.source).toBe("sample");
    expect(first.call.fallbackReason).toBe("live: Qloo responded with HTTP 403");
    fail = false;
    const second = await client.searchTags({ query: "two" });
    expect(second.source).toBe("live");
    expect(calls).toHaveLength(2);
  });

  it("stops calling the live API for a while after a rate limit, so a demo stays fast", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => new Response("{}", { status: 429 }));
    const live = createLiveQlooClient({ apiKey: TEST_KEY, baseUrl: "https://qloo.test", fetchImpl, minIntervalMs: 0, maxRetries: 0, sleep: async () => {} });
    const { createFallbackQlooClient } = await import("@/server/qloo/fallback");
    const client = createFallbackQlooClient([
      { label: "live", client: live },
      { label: "sample", client: createSampleQlooClient() },
    ]);
    await client.searchTags({ query: "one" });
    const second = await client.searchTags({ query: "two" });
    expect(calls).toHaveLength(1);
    expect(second.source).toBe("sample");
    expect(second.call.fallbackReason).toContain("HTTP 429");
  });

  it("prefers a recorded snapshot over sample data when live fails", async () => {
    const ok = makeMockFetch();
    const snapshot = emptySnapshot();
    const recorder = createRecordingQlooClient(
      createLiveQlooClient({ apiKey: TEST_KEY, baseUrl: "https://qloo.test", fetchImpl: ok.fetchImpl, minIntervalMs: 0 }),
      snapshot,
    );
    await recorder.searchTags(METHOD_ARGS.searchTags);
    clearQlooCache();

    const down = makeMockFetch(() => new Response("{}", { status: 503 }));
    const client = createQlooClient({ env: env({ QLOO_API_KEY: "" }), snapshot, fetchImpl: down.fetchImpl });
    const recorded = await client.searchTags(METHOD_ARGS.searchTags);
    expect(recorded.source).toBe("recorded");
    const unrecorded = await client.searchTags({ query: "something else" });
    expect(unrecorded.source).toBe("sample");
  });

  it("QLOO_MODE=recorded never touches the network, even with a key", async () => {
    const { fetchImpl, calls } = makeMockFetch();
    const client = createQlooClient({ env: env({ QLOO_MODE: "recorded" }), snapshot: null, fetchImpl });
    const r = await client.getBrandAffinity({ anchorIds: ["x"], context: { locality: "Koramangala" } });
    expect(calls).toHaveLength(0);
    expect(r.source).toBe("sample");
    expect(r.call.fallbackReason).toBeUndefined();
  });
});

describe("bundled sample client", () => {
  const sample = createSampleQlooClient();

  it("gives different localities different concept affinities", async () => {
    const tagIds = ["urn:tag:genre:place:thrift_store"];
    const mean = async (locality: string) => {
      const r = await sample.getAudienceAffinity({ anchorIds: ["a"], tagIds, city: "Bengaluru", context: { locality } });
      return r.data.reduce((s, p) => s + (p.affinity ?? 0), 0) / r.data.length;
    };
    expect(await mean("Koramangala")).toBeGreaterThan(await mean("Malleshwaram"));
  });

  it("answers for localities it has never heard of", async () => {
    const r = await sample.getLocalityPlaces({ locality: "Bandra West", city: "Mumbai" });
    expect(r.data.places.length).toBeGreaterThan(0);
    expect(r.data.resolved?.name).toBe("Bandra West");
  });
});
