import { z } from "zod";
import {
  countResults,
  QlooError,
  qlooResultSchemas,
  type BrandAffinity,
  type DemographicSkew,
  type EntityRef,
  type LocalityPlaces,
  type Place,
  type QlooClient,
  type QlooMethodName,
  type QlooMethods,
  type Sourced,
  type TagAffinity,
  type TagRef,
} from "./types";

/**
 * Live Qloo client. All request building and response mapping for the real API lives in
 * this file. The API key is sent only in the X-Api-Key header and never appears in URLs,
 * errors, call records or logs.
 */

export const DEFAULT_QLOO_URL = "https://hackathon.api.qloo.com";

// ---------------------------------------------------------------------------
// Request building (also used by offline clients to describe the equivalent call)
// ---------------------------------------------------------------------------

export interface QlooRequest {
  endpoint: string;
  params: Record<string, string>;
}

const PLACE = "urn:entity:place";

const requestBuilders: { [M in QlooMethodName]: (args: QlooMethods[M]["args"]) => QlooRequest } = {
  searchEntities: (a) => ({
    endpoint: "/search",
    params: {
      query: a.query,
      ...(a.types?.length ? { types: a.types.join(",") } : {}),
      take: String(a.take ?? 5),
    },
  }),
  searchTags: (a) => ({
    endpoint: "/v2/tags",
    params: { "filter.query": a.query, take: String(a.take ?? 8) },
  }),
  getLocalityPlaces: (a) => ({
    endpoint: "/v2/insights",
    params: {
      "filter.type": PLACE,
      // When only a city is known, the caller passes it as the locality with an empty city.
      "filter.location.query": a.city ? `${a.locality}, ${a.city}` : a.locality,
      take: String(a.take ?? 15),
    },
  }),
  getPlacesByTag: (a) => ({
    endpoint: "/v2/insights",
    params: {
      "filter.type": PLACE,
      "filter.location": `POINT(${a.lon} ${a.lat})`,
      "filter.location.radius": String(a.radiusM),
      "filter.tags": a.tagIds.join(","),
      "operator.filter.tags": "union",
      take: String(a.take ?? 20),
    },
  }),
  getAudienceAffinity: (a) => ({
    endpoint: "/v2/insights",
    params: {
      "filter.type": PLACE,
      "signal.interests.entities": a.anchorIds.join(","),
      "filter.tags": a.tagIds.join(","),
      "operator.filter.tags": "union",
      "filter.location.query": a.city,
      take: String(a.take ?? 10),
    },
  }),
  getTasteTags: (a) => ({
    endpoint: "/v2/insights",
    params: {
      "filter.type": "urn:tag",
      "signal.interests.entities": a.anchorIds.join(","),
      ...(a.tagTypes?.length ? { "filter.tag.types": a.tagTypes.join(",") } : {}),
      take: String(a.take ?? 30),
    },
  }),
  getBrandAffinity: (a) => ({
    endpoint: "/v2/insights",
    params: {
      "filter.type": "urn:entity:brand",
      "signal.interests.entities": a.anchorIds.join(","),
      take: String(a.take ?? 8),
    },
  }),
  getDemographics: (a) => ({
    endpoint: "/v2/insights",
    params: {
      "filter.type": "urn:demographics",
      "signal.interests.entities": a.anchorIds.join(","),
    },
  }),
};

export function buildQlooRequest<M extends QlooMethodName>(method: M, args: QlooMethods[M]["args"]): QlooRequest {
  return requestBuilders[method](args);
}

// ---------------------------------------------------------------------------
// Raw response schemas (lenient: only the fields we read; everything else is dropped)
// ---------------------------------------------------------------------------

const num = z.number().nullish();
const str = z.string().nullish();

const rawTagSchema = z.object({
  tag_id: str,
  id: str,
  name: str,
  type: str,
  subtype: str,
  popularity: num,
  query: z.object({ affinity: num }).nullish(),
});

const rawEntitySchema = z.object({
  name: str,
  entity_id: str,
  types: z.array(z.string()).nullish(),
  subtype: str,
  popularity: num,
  location: z.object({ lat: num, lon: num }).nullish(),
  query: z.object({ affinity: num, distance: num }).nullish(),
  properties: z
    .object({
      neighborhood: str,
      business_rating: num,
      price_level: num,
      primary_genre: z.object({ id: str, name: str }).nullish(),
    })
    .nullish(),
  tags: z.array(rawTagSchema).nullish(),
});
type RawEntity = z.infer<typeof rawEntitySchema>;

const rawLocalitySchema = z.object({
  entity_id: z.string(),
  name: z.string(),
  location: z.object({ lat: z.number(), lon: z.number() }),
});

const rawSearchSchema = z.object({ results: z.array(rawEntitySchema).nullish() });
const rawTagsSchema = z.object({ results: z.object({ tags: z.array(rawTagSchema).nullish() }).nullish() });
const rawInsightsEntitiesSchema = z.object({
  results: z.object({ entities: z.array(rawEntitySchema).nullish() }).nullish(),
  query: z
    .object({
      localities: z
        .object({ filter: z.union([z.array(rawLocalitySchema), rawLocalitySchema]).nullish() })
        .nullish(),
    })
    .nullish(),
});
const rawDemographicsSchema = z.object({
  results: z
    .object({
      demographics: z
        .array(
          z.object({
            entity_id: z.string(),
            query: z
              .object({
                age: z.record(z.string(), z.number()).nullish(),
                gender: z.record(z.string(), z.number()).nullish(),
              })
              .nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
});

// ---------------------------------------------------------------------------
// Mapping raw -> internal
// ---------------------------------------------------------------------------

/** Tag families that describe vibe, audience and business type. Payment, amenity and dish tags are dropped. */
const USEFUL_TAG_TYPE =
  /(ambience|audience|visit_intent|neighborhood_characteristic|setting|decor|occasion|crowd|vibe|genre:place|category:place)/;
const MAX_TAGS_PER_PLACE = 30;

const round = (n: number, digits = 3) => Number(n.toFixed(digits));
const defined = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined;

function mapTagRef(t: z.infer<typeof rawTagSchema>): TagRef | undefined {
  const id = t.tag_id ?? t.id;
  if (!id || !t.name) return undefined;
  return { id, name: t.name, type: t.subtype ?? t.type ?? "unknown" };
}

function mapPlace(e: RawEntity): Place | undefined {
  if (!e.entity_id || !e.name) return undefined;
  const p = e.properties ?? {};
  const tags = (e.tags ?? [])
    .map(mapTagRef)
    .filter(defined)
    .filter((t) => USEFUL_TAG_TYPE.test(t.type))
    // Vibe and audience tags first; plain genre/category tags after.
    .sort((a, b) => Number(/place$/.test(a.type)) - Number(/place$/.test(b.type)))
    .slice(0, MAX_TAGS_PER_PLACE);
  return {
    id: e.entity_id,
    name: e.name,
    ...(p.primary_genre?.name ? { genre: p.primary_genre.name } : {}),
    ...(p.primary_genre?.id ? { genreTagId: p.primary_genre.id } : {}),
    ...(p.neighborhood ? { neighborhood: p.neighborhood } : {}),
    ...(defined(p.business_rating) ? { rating: round(p.business_rating, 1) } : {}),
    ...(defined(p.price_level) ? { priceLevel: p.price_level } : {}),
    ...(defined(e.popularity) ? { popularity: round(e.popularity) } : {}),
    ...(defined(e.location?.lat) ? { lat: round(e.location.lat, 5) } : {}),
    ...(defined(e.location?.lon) ? { lon: round(e.location.lon, 5) } : {}),
    ...(defined(e.query?.distance) ? { distanceM: Math.round(e.query.distance) } : {}),
    ...(defined(e.query?.affinity) ? { affinity: round(e.query.affinity) } : {}),
    tags,
  };
}

const mappers: { [M in QlooMethodName]: (raw: unknown) => QlooMethods[M]["result"] } = {
  searchEntities: (raw): EntityRef[] =>
    (rawSearchSchema.parse(raw).results ?? [])
      .map((e) =>
        e.entity_id && e.name
          ? {
              id: e.entity_id,
              name: e.name,
              types: e.types ?? (e.subtype ? [e.subtype] : []),
              ...(defined(e.popularity) ? { popularity: round(e.popularity) } : {}),
              ...(defined(e.location?.lat) ? { lat: round(e.location.lat, 5) } : {}),
              ...(defined(e.location?.lon) ? { lon: round(e.location.lon, 5) } : {}),
            }
          : undefined,
      )
      .filter(defined),

  searchTags: (raw): TagRef[] => (rawTagsSchema.parse(raw).results?.tags ?? []).map(mapTagRef).filter(defined),

  getLocalityPlaces: (raw): LocalityPlaces => {
    const parsed = rawInsightsEntitiesSchema.parse(raw);
    const filter = parsed.query?.localities?.filter;
    const loc = Array.isArray(filter) ? filter[0] : filter;
    return {
      ...(loc
        ? { resolved: { id: loc.entity_id, name: loc.name, lat: round(loc.location.lat, 5), lon: round(loc.location.lon, 5) } }
        : {}),
      places: (parsed.results?.entities ?? []).map(mapPlace).filter(defined),
    };
  },

  getPlacesByTag: (raw): Place[] =>
    (rawInsightsEntitiesSchema.parse(raw).results?.entities ?? []).map(mapPlace).filter(defined),

  getAudienceAffinity: (raw): Place[] =>
    (rawInsightsEntitiesSchema.parse(raw).results?.entities ?? []).map(mapPlace).filter(defined),

  getTasteTags: (raw): TagAffinity[] =>
    (rawTagsSchema.parse(raw).results?.tags ?? [])
      .map((t) => {
        const ref = mapTagRef(t);
        if (!ref || !defined(t.query?.affinity)) return undefined;
        return {
          ...ref,
          affinity: round(t.query.affinity),
          ...(defined(t.popularity) ? { popularity: round(t.popularity) } : {}),
        };
      })
      .filter(defined),

  getBrandAffinity: (raw): BrandAffinity[] =>
    (rawInsightsEntitiesSchema.parse(raw).results?.entities ?? [])
      .map((e) => {
        if (!e.entity_id || !e.name || !defined(e.query?.affinity)) return undefined;
        const tagNames = [...new Set((e.tags ?? []).map((t) => t.name).filter(defined))].slice(0, 6);
        return {
          id: e.entity_id,
          name: e.name,
          affinity: round(e.query.affinity),
          ...(defined(e.popularity) ? { popularity: round(e.popularity) } : {}),
          tags: tagNames,
        };
      })
      .filter(defined),

  getDemographics: (raw): DemographicSkew[] =>
    (rawDemographicsSchema.parse(raw).results?.demographics ?? []).map((d) => ({
      entityId: d.entity_id,
      age: mapRecord(d.query?.age),
      gender: mapRecord(d.query?.gender),
    })),
};

function mapRecord(rec: Record<string, number> | null | undefined): Record<string, number> {
  return Object.fromEntries(Object.entries(rec ?? {}).map(([k, v]) => [k, round(v)]));
}

/** Maps a raw API response body to the internal type for a method. Exported for contract tests. */
export function mapQlooResponse<M extends QlooMethodName>(method: M, raw: unknown): QlooMethods[M]["result"] {
  let mapped: QlooMethods[M]["result"];
  try {
    mapped = mappers[method](raw);
  } catch {
    throw new QlooError("invalid_response", `Qloo returned an unexpected response shape for ${method}`);
  }
  return qlooResultSchemas[method].parse(mapped) as QlooMethods[M]["result"];
}

// ---------------------------------------------------------------------------
// Transport: timeout, retry with backoff, throttle, in-memory cache
// ---------------------------------------------------------------------------

export interface LiveQlooOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Minimum gap between request starts. Qloo allows 5 per second; default keeps us at 4. */
  minIntervalMs?: number;
  cacheTtlMs?: number;
  backoffBaseMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface QlooQuota {
  monthLimit?: number;
  monthRemaining?: number;
  seenAt: number;
}

interface CacheEntry {
  expires: number;
  data: unknown;
}

// Module-level so the cache and throttle are shared by every run in this server process.
const sharedCache = new Map<string, CacheEntry>();
let nextSlot = 0;
let lastQuota: QlooQuota | undefined;

export function getLastQlooQuota(): QlooQuota | undefined {
  return lastQuota;
}

export function clearQlooCache(): void {
  sharedCache.clear();
  nextSlot = 0;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export function createLiveQlooClient(options: LiveQlooOptions): QlooClient {
  const {
    apiKey,
    baseUrl = DEFAULT_QLOO_URL,
    fetchImpl = fetch,
    timeoutMs = 12_000,
    maxRetries = 2,
    minIntervalMs = 250,
    cacheTtlMs = 30 * 60_000,
    backoffBaseMs = 500,
    now = Date.now,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options;

  async function throttle(): Promise<void> {
    const t = now();
    const slot = Math.max(t, nextSlot);
    nextSlot = slot + minIntervalMs;
    if (slot > t) await sleep(slot - t);
  }

  async function fetchJson(request: QlooRequest): Promise<unknown> {
    if (!apiKey) throw new QlooError("no_key", "QLOO_API_KEY is not set");
    const url = new URL(request.endpoint, baseUrl);
    for (const [k, v] of Object.entries(request.params)) url.searchParams.set(k, v);

    let lastError: QlooError | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(backoffBaseMs * 2 ** (attempt - 1));
      await throttle();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, {
          method: "GET",
          headers: { "X-Api-Key": apiKey, Accept: "application/json" },
          signal: controller.signal,
        });
        const remaining = Number(res.headers.get("x-month-ratelimit-remaining"));
        const limit = Number(res.headers.get("x-month-ratelimit-limit"));
        if (Number.isFinite(remaining) && res.headers.has("x-month-ratelimit-remaining")) {
          lastQuota = { monthRemaining: remaining, ...(limit ? { monthLimit: limit } : {}), seenAt: now() };
        }
        if (res.ok) {
          try {
            return await res.json();
          } catch {
            throw new QlooError("invalid_response", "Qloo returned a non-JSON response");
          }
        }
        lastError =
          res.status === 429
            ? new QlooError("rate_limited", "Qloo rate limit or quota reached (HTTP 429)", 429)
            : new QlooError("http", `Qloo responded with HTTP ${res.status}`, res.status);
        if (!RETRYABLE.has(res.status)) throw lastError;
      } catch (err) {
        if (err instanceof QlooError) {
          if (err.kind !== "http" && err.kind !== "rate_limited") throw err;
          if (!RETRYABLE.has(err.status ?? 0)) throw err;
          lastError = err;
        } else if (err instanceof Error && err.name === "AbortError") {
          lastError = new QlooError("timeout", `Qloo did not respond within ${timeoutMs} ms`);
        } else {
          // Deliberately generic: the underlying error text is not forwarded.
          lastError = new QlooError("network", "Could not reach the Qloo API (network error)");
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new QlooError("network", "Could not reach the Qloo API");
  }

  async function call<M extends QlooMethodName>(
    method: M,
    args: QlooMethods[M]["args"],
  ): Promise<Sourced<QlooMethods[M]["result"]>> {
    const request = buildQlooRequest(method, args);
    const cacheKey = `${baseUrl}|${request.endpoint}|${JSON.stringify(request.params)}`;
    const started = now();
    const hit = sharedCache.get(cacheKey);
    let data: QlooMethods[M]["result"];
    let cached = false;
    if (hit && hit.expires > started) {
      data = hit.data as QlooMethods[M]["result"];
      cached = true;
    } else {
      data = mapQlooResponse(method, await fetchJson(request));
      sharedCache.set(cacheKey, { expires: now() + cacheTtlMs, data });
    }
    return {
      data,
      source: "live",
      call: {
        method,
        endpoint: request.endpoint,
        params: request.params,
        source: "live",
        durationMs: now() - started,
        resultCount: countResults(data),
        cached,
      },
    };
  }

  return {
    searchEntities: (a) => call("searchEntities", a),
    searchTags: (a) => call("searchTags", a),
    getLocalityPlaces: (a) => call("getLocalityPlaces", a),
    getPlacesByTag: (a) => call("getPlacesByTag", a),
    getAudienceAffinity: (a) => call("getAudienceAffinity", a),
    getTasteTags: (a) => call("getTasteTags", a),
    getBrandAffinity: (a) => call("getBrandAffinity", a),
    getDemographics: (a) => call("getDemographics", a),
  };
}
