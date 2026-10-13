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
    popularity: Number((0.99 - i * 0.01).toFixed(3)),
    lat: Number((loc.lat + (i - 2) * 0.002).toFixed(5)),
    lon: Number((loc.lon + (2 - i) * 0.002).toFixed(5)),
    tags: v.tags.map((t) => ({ id: `sample:tag:${slug(t)}`, name: t, type: "urn:tag:ambience:qloo" })),
  }));
}

const handlers: { [M in QlooMethodName]: (args: QlooMethods[M]["args"]) => QlooMethods[M]["result"] } = {
  searchEntities: (a) => {
    const { key, loc } = findLocality(a.query);
    return [{ id: `sample-${slug(key)}`, name: loc.name, types: ["urn:entity:locality"], lat: loc.lat, lon: loc.lon }];
  },

  searchTags: (a) => {
    const key = sampleConceptKey([a.query.replace(/\s+/g, "_")]);
    return [{ id: `sample:tag:${key}`, name: SAMPLE_CONCEPT_LABEL[key], type: "urn:tag:genre:place" }];
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
      distanceM: 250 + i * 180,
      tags: [],
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
