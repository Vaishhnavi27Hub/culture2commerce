import { beforeEach, describe, expect, it } from "vitest";
import { clearQlooCache, createLiveQlooClient } from "@/server/qloo/live";
import { QlooError } from "@/server/qloo/types";
import { makeMockFetch, METHOD_ARGS, RAW, TEST_KEY } from "../fixtures/raw-qloo";

const noSleep = async () => {};
const base = { apiKey: TEST_KEY, baseUrl: "https://qloo.test", sleep: noSleep, minIntervalMs: 0 };

describe("LiveQlooClient", () => {
  beforeEach(() => clearQlooCache());

  it("sends the key only in the X-Api-Key header, never in the URL", async () => {
    const { fetchImpl, calls } = makeMockFetch();
    const client = createLiveQlooClient({ ...base, fetchImpl });
    const result = await client.getLocalityPlaces(METHOD_ARGS.getLocalityPlaces);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers["X-Api-Key"]).toBe(TEST_KEY);
    expect(calls[0]?.url.toString()).not.toContain(TEST_KEY);
    expect(calls[0]?.url.searchParams.get("filter.location.query")).toBe("Testnagar, Testcity");
    expect(JSON.stringify(result)).not.toContain(TEST_KEY);
    expect(result.source).toBe("live");
    expect(result.call.endpoint).toBe("/v2/insights");
  });

  it("maps and trims places: rounds numbers, drops payment tags, reads the resolved locality", async () => {
    const { fetchImpl } = makeMockFetch();
    const client = createLiveQlooClient({ ...base, fetchImpl });
    const { data } = await client.getLocalityPlaces(METHOD_ARGS.getLocalityPlaces);

    expect(data.resolved).toEqual({ id: "LOC-1", name: "Testnagar 2nd Stage", lat: 12.97709, lon: 77.63869 });
    const place = data.places[0];
    expect(place).toMatchObject({ id: "PLACE-1", genre: "Cafe", rating: 4.3, popularity: 0.999, distanceM: 346 });
    expect(place?.tags.map((t) => t.name)).toEqual(["Trendy", "Students", "Cafe"]);
    expect(JSON.stringify(place)).not.toContain("phone");
  });

  it("retries on HTTP 429 and then succeeds", async () => {
    const { fetchImpl, calls } = makeMockFetch((_url, i) =>
      i === 0 ? new Response("{}", { status: 429 }) : Response.json(RAW.tags),
    );
    const client = createLiveQlooClient({ ...base, fetchImpl });
    const result = await client.searchTags(METHOD_ARGS.searchTags);
    expect(calls).toHaveLength(2);
    expect(result.data[0]?.id).toBe("urn:tag:genre:place:thrift_store");
  });

  it("gives up with rate_limited after the retry budget is spent", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => new Response("{}", { status: 429 }));
    const client = createLiveQlooClient({ ...base, fetchImpl, maxRetries: 2 });
    await expect(client.searchTags(METHOD_ARGS.searchTags)).rejects.toMatchObject({ kind: "rate_limited", status: 429 });
    expect(calls).toHaveLength(3);
  });

  it("does not retry a 403 and reports only the status", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => new Response(`{"error":"forbidden for ${TEST_KEY}"}`, { status: 403 }));
    const client = createLiveQlooClient({ ...base, fetchImpl });
    const err = await client.searchTags(METHOD_ARGS.searchTags).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QlooError);
    expect((err as QlooError).message).toBe("Qloo responded with HTTP 403");
    expect(calls).toHaveLength(1);
  });

  it("turns network failures into a generic error that cannot leak the key", async () => {
    const { fetchImpl } = makeMockFetch(() => {
      throw new Error(`connect failed with header X-Api-Key: ${TEST_KEY}`);
    });
    const client = createLiveQlooClient({ ...base, fetchImpl, maxRetries: 1 });
    const err = (await client.searchTags(METHOD_ARGS.searchTags).catch((e: unknown) => e)) as QlooError;
    expect(err.kind).toBe("network");
    expect(err.message).not.toContain(TEST_KEY);
  });

  it("fails fast with no_key and makes no request when the key is empty", async () => {
    const { fetchImpl, calls } = makeMockFetch();
    const client = createLiveQlooClient({ ...base, apiKey: "", fetchImpl });
    await expect(client.searchTags(METHOD_ARGS.searchTags)).rejects.toMatchObject({ kind: "no_key" });
    expect(calls).toHaveLength(0);
  });

  it("serves repeat calls from the in-memory cache", async () => {
    const { fetchImpl, calls } = makeMockFetch();
    const client = createLiveQlooClient({ ...base, fetchImpl });
    const first = await client.getBrandAffinity(METHOD_ARGS.getBrandAffinity);
    const second = await client.getBrandAffinity(METHOD_ARGS.getBrandAffinity);
    expect(calls).toHaveLength(1);
    expect(first.call.cached).toBe(false);
    expect(second.call.cached).toBe(true);
    expect(second.data).toEqual(first.data);
  });

  it("rejects a response with the wrong shape as invalid_response", async () => {
    const { fetchImpl } = makeMockFetch(() => Response.json({ results: { entities: "not-a-list" } }));
    const client = createLiveQlooClient({ ...base, fetchImpl });
    await expect(client.getLocalityPlaces(METHOD_ARGS.getLocalityPlaces)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("spaces requests out to respect the per-second limit", async () => {
    const { fetchImpl } = makeMockFetch();
    let clock = 1_000;
    const sleeps: number[] = [];
    const client = createLiveQlooClient({
      ...base,
      fetchImpl,
      minIntervalMs: 250,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });
    await Promise.all([
      client.searchTags({ query: "a" }),
      client.searchTags({ query: "b" }),
      client.searchTags({ query: "c" }),
    ]);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(500);
  });
});
