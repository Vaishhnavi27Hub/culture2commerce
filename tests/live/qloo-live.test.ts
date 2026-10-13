import { describe, expect, it } from "vitest";
import { readServerEnv } from "@/server/env";
import { createLiveQlooClient } from "@/server/qloo/live";

/**
 * Real Qloo calls (about 6). Run with `npm run test:live`, sparingly.
 * Skipped automatically when QLOO_API_KEY is not set.
 */
const env = readServerEnv();
const client = createLiveQlooClient({ apiKey: env.qlooApiKey, baseUrl: env.qlooApiUrl });

describe.skipIf(!env.qlooApiKey)("live Qloo API", () => {
  let anchorIds: string[] = [];
  let centre = { lat: 0, lon: 0 };

  it("returns places for Koramangala and resolves the locality", async () => {
    const r = await client.getLocalityPlaces({ locality: "Koramangala", city: "Bengaluru", take: 6 });
    expect(r.source).toBe("live");
    expect(r.data.places.length).toBeGreaterThan(0);
    expect(r.data.resolved?.name).toMatch(/Koramangala/i);
    anchorIds = r.data.places.slice(0, 4).map((p) => p.id);
    centre = { lat: r.data.resolved!.lat, lon: r.data.resolved!.lon };
  });

  it("finds coffee or cafe places near the locality using a union of two tags", async () => {
    const r = await client.getPlacesByTag({
      tagIds: ["urn:tag:genre:place:restaurant:coffee_shop", "urn:tag:genre:place:restaurant:cafe"],
      ...centre,
      radiusM: 1500,
      take: 10,
    });
    expect(r.data.length).toBeGreaterThan(0);
  });

  it("returns graded affinities for art places given the anchors' audience", async () => {
    const r = await client.getAudienceAffinity({ anchorIds, tagIds: ["urn:tag:genre:place:art_gallery"], city: "Bengaluru", take: 6 });
    expect(r.data.length).toBeGreaterThan(0);
    const affinities = r.data.map((p) => p.affinity);
    expect(affinities.every((a) => typeof a === "number" && a > 0 && a <= 1)).toBe(true);
  });

  it("returns taste tags across several tag types in one call", async () => {
    const r = await client.getTasteTags({
      anchorIds,
      tagTypes: ["urn:tag:genre:place", "urn:tag:genre:music", "urn:tag:genre:brand"],
      take: 30,
    });
    expect(r.data.length).toBeGreaterThan(0);
    console.log("taste tag types returned:", [...new Set(r.data.map((t) => t.type))].join(", "));
  });

  it("returns brand affinities and demographics for the anchors", async () => {
    const [brands, demo] = await Promise.all([
      client.getBrandAffinity({ anchorIds, take: 5 }),
      client.getDemographics({ anchorIds }),
    ]);
    expect(brands.data.length).toBeGreaterThan(0);
    expect(demo.data.length).toBeGreaterThan(0);
    expect(Object.keys(demo.data[0]!.age).length).toBeGreaterThan(0);
  });
});
