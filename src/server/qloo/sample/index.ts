import { buildQlooRequest } from "../live";
import { bindAll } from "../recorded";
import {
  countResults,
  qlooResultSchemas,
  type LocalityContext,
  type Place,
  type QlooClient,
  type QlooMethodName,
  type QlooMethods,
  type Sourced,
} from "../types";
import {
  GENERIC_SAMPLE_PARTNERS,
  SAMPLE_ADMIN_AREAS,
  SAMPLE_PARTNERS,
  SAMPLE_PRICE_LEVEL,
  SAMPLE_PRODUCT_TAGS,
  GENERIC_SAMPLE_LOCALITY,
  SAMPLE_CONCEPT_LABEL,
  SAMPLE_LOCALITIES,
  sampleConceptKey,
  type SampleLocality,
} from "./sample-data";

/**
 * Bundled sample client: the last-resort fallback. It answers every call from the
 * hand-written illustrative dataset in sample-data.ts and labels results `sample`.
 * It never fails, so the app always has something to show.
 */

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function normaliseLocality(name: string | undefined): string {
  const n = (name ?? "").toLowerCase().split(",")[0]?.trim() ?? "";
  if (n === "malleswaram") return "malleshwaram";
  if (n === "hsr") return "hsr layout";
  return n;
}

function findLocality(name: string | undefined): { key: string; loc: SampleLocality } {
  const key = normaliseLocality(name);
  const loc = SAMPLE_LOCALITIES[key];
  if (loc) return { key, loc };
  return { key: key || "generic", loc: { ...GENERIC_SAMPLE_LOCALITY, name: name?.split(",")[0]?.trim() || GENERIC_SAMPLE_LOCALITY.name } };
}

/** Finds the sample locality nearest to a point (used when only coordinates are known). */
function nearestLocality(lat: number, lon: number): { key: string; loc: SampleLocality } {
  let best: { key: string; loc: SampleLocality; d: number } | undefined;
  for (const [key, loc] of Object.entries(SAMPLE_LOCALITIES)) {
    const d = (loc.lat - lat) ** 2 + (loc.lon - lon) ** 2;
    if (!best || d < best.d) best = { key, loc, d };
  }
  // Farther than roughly 3 km from every sample locality: use the generic profile.
  if (!best || best.d > 0.03 ** 2) return { key: "generic", loc: GENERIC_SAMPLE_LOCALITY };
  return best;
}

function fromContext(context: LocalityContext | undefined) {
  return findLocality(context?.locality);
}

function venuePlaces(key: string, loc: SampleLocality): Place[] {
  return loc.venues.map((v, i) => ({
    id: `sample-${slug(key)}-venue-${i + 1}`,
    name: v.name,
    genre: v.genre,
    neighborhood: loc.name,
    rating: v.rating,
    priceLevel: SAMPLE_PRICE_LEVEL[key] ?? 2,
    popularity: Number((0.99 - i * 0.01).toFixed(3)),
    lat: Number((loc.lat + (i - 2) * 0.002).toFixed(5)),
    lon: Number((loc.lon + (2 - i) * 0.002).toFixed(5)),
    tags: v.tags.map((t) => ({ id: `sample:tag:${slug(t)}`, name: t, type: "urn:tag:ambience:qloo" })),
  }));
}

const handlers: { [M in QlooMethodName]: (args: QlooMethods[M]["args"]) => QlooMethods[M]["result"] } = {
  searchEntities: (a) => {
    // Place searches (a "business you admire") only match sample venues by name; unknown names return nothing.
    if (a.types?.includes("urn:entity:place")) {
      const q = a.query.toLowerCase().replace(/\(sample\)/g, "").split(",")[0]?.trim() ?? "";
      if (q.length < 3) return [];
      const all = Object.entries(SAMPLE_LOCALITIES).flatMap(([key, loc]) => [
        ...loc.venues.map((v) => ({ key, loc, name: v.name, genre: v.genre })),
        ...(SAMPLE_PARTNERS[key] ?? []).map((p) => ({ key, loc, name: p.name, genre: p.genre })),
      ]);
      return all
        .filter((v) => v.name.toLowerCase().includes(q))
        .slice(0, a.take ?? 5)
        .map((v) => ({ id: `sample-admired-${slug(v.name)}`, name: v.name, types: ["urn:entity:place"], lat: v.loc.lat, lon: v.loc.lon, city: "Bengaluru", neighborhood: v.loc.name, genre: v.genre }));
    }
    const { key, loc } = findLocality(a.query);
    return [{ id: `sample-${slug(key)}`, name: loc.name, types: ["urn:entity:locality"], lat: loc.lat, lon: loc.lon }];
  },

  searchTags: (a) => {
    const key = sampleConceptKey([a.query.replace(/\s+/g, "_")]);
    const word = a.query.trim().toLowerCase();
    const title = word.charAt(0).toUpperCase() + word.slice(1);
    return [
      { id: `sample:tag:dish:${slug(word)}`, name: title, type: "urn:tag:specialty_dish:place" },
      { id: `sample:tag:${key}`, name: SAMPLE_CONCEPT_LABEL[key], type: "urn:tag:genre:place" },
    ];
  },

  getLocalityPlaces: (a) => {
    const { key, loc } = findLocality(a.locality);
    return {
      resolved: { id: `sample-${slug(key)}`, name: loc.name, lat: loc.lat, lon: loc.lon },
      places: venuePlaces(key, loc).slice(0, a.take ?? 15),
    };
  },

  getPlacesByTag: (a) => {
    const { key, loc } = a.context?.locality ? fromContext(a.context) : nearestLocality(a.lat, a.lon);
    const concept = sampleConceptKey(a.tagIds);
    const count = Math.min(loc.competitors[concept], a.take ?? 20);
    return Array.from({ length: count }, (_, i) => ({
      id: `sample-${slug(key)}-${concept}-competitor-${i + 1}`,
      name: `${SAMPLE_CONCEPT_LABEL[concept]} ${i + 1} near ${loc.name} (sample)`,
      genre: SAMPLE_CONCEPT_LABEL[concept],
      neighborhood: loc.name,
      rating: Number((4.5 - (i % 5) * 0.1).toFixed(1)),
      priceLevel: SAMPLE_PRICE_LEVEL[key] ?? 2,
      popularity: Number((0.9 - i * 0.05).toFixed(3)),
      distanceM: 250 + i * 180,
      tags: SAMPLE_PRODUCT_TAGS[concept]
        .filter((_, j) => (i + j) % 2 === 0)
        .map((t) => ({ id: `sample:tag:dish:${slug(t)}`, name: t, type: "urn:tag:specialty_dish:place" })),
    }));
  },

  getAudienceAffinity: (a) => {
    const { key, loc } = fromContext(a.context);
    const concept = sampleConceptKey(a.tagIds);
    const base = loc.conceptAffinity[concept];
    const count = Math.min(a.take ?? 10, 6);
    return Array.from({ length: count }, (_, i) => ({
      id: `sample-${slug(key)}-${concept}-affinity-${i + 1}`,
      name: `${SAMPLE_CONCEPT_LABEL[concept]} ${String.fromCharCode(65 + i)} (sample)`,
      genre: SAMPLE_CONCEPT_LABEL[concept],
      // Spread around the base value so the mean of the list equals the base.
      affinity: Number((base + (2.5 - i) * 0.012).toFixed(3)),
      tags: [],
    }));
  },

  getTasteTags: (a) => {
    const { loc } = fromContext(a.context);
    return loc.tasteTags
      .filter((t) => !a.tagTypes?.length || a.tagTypes.includes(t.type))
      .slice(0, a.take ?? 30)
      .map((t) => ({ id: `sample:tag:${slug(t.name)}`, name: t.name, type: t.type, affinity: t.affinity }));
  },

  getBrandAffinity: (a) => {
    const { key, loc } = fromContext(a.context);
    return loc.brands.slice(0, a.take ?? 8).map((b, i) => ({
      id: `sample-${slug(key)}-brand-${i + 1}`,
      name: b.name,
      affinity: b.affinity,
      tags: b.tags,
    }));
  },

  getNeighbourhoodHeatmap: (a) => {
    const concept = sampleConceptKey(a.tagIds);
    const city = a.city.split(",")[0]?.trim() ?? a.city;
    const known = /^(bengaluru|bangalore)$/i.test(city);
    const areas = known
      ? Object.values(SAMPLE_LOCALITIES).map((l) => ({ name: l.name, affinity: l.conceptAffinity[concept], lat: l.lat, lon: l.lon }))
      : [
          { name: `${city} Central (sample)`, affinity: 0.95, lat: undefined, lon: undefined },
          { name: `${city} Market Area (sample)`, affinity: 0.93, lat: undefined, lon: undefined },
          { name: `${city} University Area (sample)`, affinity: 0.91, lat: undefined, lon: undefined },
        ];
    const admin = known ? SAMPLE_ADMIN_AREAS : [city];
    return [...areas.map((x) => ({ ...x, admin: false })), ...admin.map((name, i) => ({ name, affinity: 0.9 - i * 0.01, lat: undefined, lon: undefined, admin: true }))]
      .sort((x, y) => y.affinity - x.affinity)
      .slice(0, a.take ?? 25)
      .map((x) => ({
        id: `sample-heat-${slug(x.name)}`,
        name: x.name,
        affinity: Number(x.affinity.toFixed(3)),
        popularity: x.admin ? 1 : 0.95,
        ...(x.lat !== undefined && x.lon !== undefined ? { lat: x.lat, lon: x.lon } : {}),
        disambiguation: x.admin ? `${x.name}, Karnataka, India` : `${x.name}, ${city}, Karnataka, India`,
      }));
  },

  getNearbyAffinityPlaces: (a) => {
    const { key, loc } = findLocality(a.locality);
    const partners = SAMPLE_PARTNERS[key] ?? GENERIC_SAMPLE_PARTNERS;
    const wanted = (a.tagIds ?? []).map((t) => (t.split(":").pop() ?? "").replace(/_/g, " "));
    const base = loc.conceptAffinity.other + 0.08;
    return partners
      .filter((p) => wanted.length === 0 || wanted.some((w) => p.genre.toLowerCase().includes(w.replace("restaurant ", ""))))
      .slice(0, a.take ?? 30)
      .map((p, i) => ({
        id: `sample-${slug(key)}-partner-${slug(p.name)}`,
        name: p.name,
        genre: p.genre,
        neighborhood: loc.name,
        rating: p.rating,
        priceLevel: p.priceLevel,
        costDescription: p.costDescription,
        popularity: Number((0.95 - i * 0.04).toFixed(3)),
        affinity: Number(Math.min(0.99, base - i * 0.006).toFixed(3)),
        lat: Number((loc.lat + 0.001 * i).toFixed(5)),
        lon: Number((loc.lon - 0.001 * i).toFixed(5)),
        tags: p.tags.map((t) => ({ id: `sample:tag:${slug(t)}`, name: t, type: "urn:tag:neighborhood_characteristic:qloo" })),
      }));
  },

  getDemographics: (a) => {
    const { loc } = fromContext(a.context);
    return a.anchorIds.slice(0, 1).map((id) => ({ entityId: id, age: loc.age, gender: loc.gender }));
  },
};

export function createSampleQlooClient(): QlooClient {
  async function call<M extends QlooMethodName>(
    method: M,
    args: QlooMethods[M]["args"],
  ): Promise<Sourced<QlooMethods[M]["result"]>> {
    const request = buildQlooRequest(method, args);
    const data = qlooResultSchemas[method].parse(handlers[method](args)) as QlooMethods[M]["result"];
    return {
      data,
      source: "sample",
      call: {
        method,
        endpoint: request.endpoint,
        params: request.params,
        source: "sample",
        durationMs: 0,
        resultCount: countResults(data),
        cached: false,
      },
    };
  }
  return bindAll(call);
}
