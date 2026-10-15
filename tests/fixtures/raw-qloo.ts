import type { QlooMethodName, QlooMethods } from "@/server/qloo/types";

/**
 * Synthetic raw responses in the shape of the real Qloo API (field names verified against
 * live calls on 13 Oct 2026). All values are invented for tests; this is not Qloo data.
 */

const rawPlace = (n: number, extra: Record<string, unknown> = {}) => ({
  name: `Test Place ${n}`,
  entity_id: `PLACE-${n}`,
  type: "urn:entity",
  subtype: "urn:entity:place",
  properties: {
    address: "1 Test Road",
    phone: "+910000000000",
    neighborhood: "Testnagar",
    business_rating: 4.300000190734863,
    price_level: 2,
    primary_genre: { id: "urn:tag:genre:place:restaurant:cafe", name: "Cafe", akas: [{ value: "x" }] },
    hours: { monday: [{ opens: "T08:00:00" }] },
  },
  popularity: 0.99876543,
  location: { lat: 12.9771234567, lon: 77.6387654321 },
  query: { distance: 346.453 },
  tags: [
    { name: "Trendy", tag_id: "urn:tag:ambience:qloo:trendy", type: "urn:tag:ambience:qloo", value: "x" },
    { name: "VISA", tag_id: "urn:tag:credit_card:place:visa", type: "urn:tag:credit_card:place", value: "x" },
    { name: "Cafe", tag_id: "urn:tag:genre:place:restaurant:cafe", type: "urn:tag:genre:place", value: "x" },
    { name: "Students", tag_id: "urn:tag:audience:qloo:students", type: "urn:tag:audience:qloo", value: "x" },
  ],
  ...extra,
});

export const RAW = {
  search: {
    results: [
      {
        name: "Testnagar",
        entity_id: "LOC-1",
        types: ["urn:entity:locality"],
        properties: { boundaries: "POLYGON ((0 0, 1 1))" },
        popularity: 0.977,
        location: { lat: 12.973, lon: 77.64 },
        tags: [],
      },
    ],
  },
  tags: {
    duration: 25,
    success: true,
    results: {
      tags: [
        { id: "urn:tag:genre:place:thrift_store", name: "Thrift store", type: "urn:tag:genre:place", popularity: 0.99, parents: [], properties: {}, tags: [] },
        { id: "urn:tag:category:place:thrift_store", name: "Thrift store", type: "urn:tag:category:place", popularity: 0.9 },
      ],
    },
  },
  localityPlaces: {
    success: true,
    results: { entities: [rawPlace(1), rawPlace(2), rawPlace(3)] },
    query: {
      localities: {
        filter: [
          { entity_id: "LOC-1", name: "Testnagar 2nd Stage", subtype: "urn:entity:locality", location: { lat: 12.9770856, lon: 77.63869 }, popularity: 0.98 },
        ],
      },
    },
  },
  placesByTag: {
    success: true,
    results: { entities: [rawPlace(4), rawPlace(5)] },
  },
  audienceAffinity: {
    success: true,
    results: { entities: [rawPlace(6, { query: { affinity: 0.9471 } }), rawPlace(7, { query: { affinity: 0.9023 } })] },
    query: { localities: { filter: [{ entity_id: "CITY-1", name: "Testcity", location: { lat: 12.97, lon: 77.6 } }] } },
  },
  tasteTags: {
    success: true,
    results: {
      tags: [
        { tag_id: "urn:tag:genre:place:restaurant:cafe", name: "Cafe", types: ["urn:entity:place"], subtype: "urn:tag:genre:place", tag_value: "x", popularity: 0.99, query: { affinity: 0.969 } },
        { tag_id: "urn:tag:genre:place:art_gallery", name: "Art gallery", types: ["urn:entity:place"], subtype: "urn:tag:genre:place", query: { affinity: 0.9112 } },
      ],
    },
  },
  brands: {
    success: true,
    results: {
      entities: [
        {
          name: "Test Brand",
          entity_id: "BRAND-1",
          subtype: "urn:entity:brand",
          popularity: 0.891,
          query: { affinity: 0.9921 },
          tags: [
            { name: "Fashion", tag_id: "urn:tag:genre:brand:fashion", type: "urn:tag:genre:brand" },
            { name: "Fashion", tag_id: "urn:tag:genre:brand:retail:fashion", type: "urn:tag:genre:brand" },
            { name: "Minimalist", tag_id: "urn:tag:style:qloo:minimalist", type: "urn:tag:style:qloo" },
          ],
        },
      ],
    },
  },
  heatmap: {
    success: true,
    results: {
      entities: [
        { name: "Testnagar", entity_id: "LOC-1", popularity: 0.996, query: { affinity: 1 }, disambiguation: "Testnagar, Testcity", boundary: "POLYGON ((77.60 12.90, 77.62 12.90, 77.62 12.92, 77.60 12.92, 77.60 12.90))" },
        { name: "Testcity", entity_id: "CITY-1", popularity: 1, query: { affinity: 0.97 }, disambiguation: "Testcity, Teststate" },
      ],
    },
  },
  demographics: {
    success: true,
    results: {
      demographics: [
        {
          entity_id: "PLACE-1",
          query: {
            age: { "24_and_younger": 0.06, "25_to_29": -0.04, "30_to_34": 0.18100000000000002 },
            gender: { male: 0.72, female: -0.72 },
          },
        },
      ],
    },
  },
} as const;

/** Picks the synthetic raw response that matches a request URL, like the real API would. */
export function rawResponseFor(url: URL): unknown {
  if (url.pathname === "/search") return RAW.search;
  if (url.searchParams.get("filter.type") === "urn:heatmap") return RAW.heatmap;
  if (url.pathname === "/v2/tags") return RAW.tags;
  const type = url.searchParams.get("filter.type");
  if (type === "urn:tag") return RAW.tasteTags;
  if (type === "urn:entity:brand") return RAW.brands;
  if (type === "urn:demographics") return RAW.demographics;
  if (url.searchParams.has("signal.interests.entities")) return RAW.audienceAffinity;
  if (url.searchParams.has("filter.location.radius")) return RAW.placesByTag;
  return RAW.localityPlaces;
}

export const TEST_KEY = "test-key-NOT-REAL-123";

export interface FetchCall {
  url: URL;
  headers: Record<string, string>;
}

/** A fetch stand-in that serves synthetic responses and records what was requested. */
export function makeMockFetch(
  respond: (url: URL, callIndex: number) => Response | Promise<Response> = (url) => Response.json(rawResponseFor(url)),
) {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    return respond(url, calls.length - 1);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

/** One call per client method, with representative arguments. */
export const METHOD_ARGS: { [M in QlooMethodName]: QlooMethods[M]["args"] } = {
  searchEntities: { query: "Testnagar, Testcity", types: ["urn:entity:locality"], take: 3 },
  searchTags: { query: "thrift", take: 5 },
  getLocalityPlaces: { locality: "Testnagar", city: "Testcity", take: 3 },
  getPlacesByTag: { tagIds: ["urn:tag:genre:place:thrift_store"], lat: 12.97, lon: 77.63, radiusM: 2000 },
  getAudienceAffinity: { anchorIds: ["PLACE-1", "PLACE-2"], tagIds: ["urn:tag:genre:place:art_gallery"], city: "Testcity" },
  getTasteTags: { anchorIds: ["PLACE-1", "PLACE-2"], tagTypes: ["urn:tag:genre:place"], take: 10 },
  getBrandAffinity: { anchorIds: ["PLACE-1", "PLACE-2"], take: 5 },
  getDemographics: { anchorIds: ["PLACE-1"] },
  getNeighbourhoodHeatmap: { city: "Testcity", tagIds: ["urn:tag:genre:place:restaurant:bakery"], take: 10 },
  getNearbyAffinityPlaces: { anchorIds: ["PLACE-1"], locality: "Testnagar", city: "Testcity", take: 10 },
};
