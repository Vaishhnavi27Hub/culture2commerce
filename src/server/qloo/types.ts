import { z } from "zod";

/**
 * Internal Qloo types. Every implementation (live, recorded snapshot, bundled sample)
 * returns exactly these shapes, so agents never see raw API responses.
 */

/** Where a Qloo-derived value came from. */
export const qlooSourceSchema = z.enum(["live", "recorded", "sample"]);
export type QlooSource = z.infer<typeof qlooSourceSchema>;

export const tagRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});
export type TagRef = z.infer<typeof tagRefSchema>;

export const entityRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  types: z.array(z.string()),
  popularity: z.number().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});
export type EntityRef = z.infer<typeof entityRefSchema>;

export const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  genre: z.string().optional(),
  genreTagId: z.string().optional(),
  neighborhood: z.string().optional(),
  rating: z.number().optional(),
  priceLevel: z.number().optional(),
  popularity: z.number().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  distanceM: z.number().optional(),
  /** 0..1 affinity to the signal used in the request; absent when no signal was sent. */
  affinity: z.number().optional(),
  tags: z.array(tagRefSchema),
});
export type Place = z.infer<typeof placeSchema>;

export const resolvedLocalitySchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
});
export type ResolvedLocality = z.infer<typeof resolvedLocalitySchema>;

export const localityPlacesSchema = z.object({
  /** How Qloo resolved the "<locality>, <city>" text. Absent if it could not. */
  resolved: resolvedLocalitySchema.optional(),
  places: z.array(placeSchema),
});
export type LocalityPlaces = z.infer<typeof localityPlacesSchema>;

export const tagAffinitySchema = tagRefSchema.extend({
  affinity: z.number(),
  popularity: z.number().optional(),
});
export type TagAffinity = z.infer<typeof tagAffinitySchema>;

export const brandAffinitySchema = z.object({
  id: z.string(),
  name: z.string(),
  affinity: z.number(),
  popularity: z.number().optional(),
  tags: z.array(z.string()),
});
export type BrandAffinity = z.infer<typeof brandAffinitySchema>;

/** Skew versus the general population, roughly -1..1 per band. One entry per anchor entity. */
export const demographicSkewSchema = z.object({
  entityId: z.string(),
  age: z.record(z.string(), z.number()),
  gender: z.record(z.string(), z.number()),
});
export type DemographicSkew = z.infer<typeof demographicSkewSchema>;

/** Optional hint so offline data can pick a matching sample. The live API ignores it. */
export interface LocalityContext {
  locality?: string;
  city?: string;
}

export interface QlooMethods {
  searchEntities: {
    args: { query: string; types?: string[]; take?: number };
    result: EntityRef[];
  };
  searchTags: {
    args: { query: string; take?: number };
    result: TagRef[];
  };
  /** Top places in a locality: the "anchor venues" that stand in for the local audience. */
  getLocalityPlaces: {
    args: { locality: string; city: string; take?: number };
    result: LocalityPlaces;
  };
  /** Places carrying any of the given tags near a point: existing competitors. */
  getPlacesByTag: {
    args: { tagIds: string[]; lat: number; lon: number; radiusM: number; take?: number; context?: LocalityContext };
    result: Place[];
  };
  /** City places of a concept type, ranked by affinity to the anchors' audience. */
  getAudienceAffinity: {
    args: { anchorIds: string[]; tagIds: string[]; city: string; take?: number; context?: LocalityContext };
    result: Place[];
  };
  /** Tags the anchors' audience over-indexes on (taste analysis). */
  getTasteTags: {
    args: { anchorIds: string[]; tagTypes?: string[]; take?: number; context?: LocalityContext };
    result: TagAffinity[];
  };
  getBrandAffinity: {
    args: { anchorIds: string[]; take?: number; context?: LocalityContext };
    result: BrandAffinity[];
  };
  getDemographics: {
    args: { anchorIds: string[]; context?: LocalityContext };
    result: DemographicSkew[];
  };
}

export type QlooMethodName = keyof QlooMethods;

export const QLOO_METHOD_NAMES = [
  "searchEntities",
  "searchTags",
  "getLocalityPlaces",
  "getPlacesByTag",
  "getAudienceAffinity",
  "getTasteTags",
  "getBrandAffinity",
  "getDemographics",
] as const satisfies readonly QlooMethodName[];

/** Zod schema for each method's result; shared by every implementation and the contract tests. */
export const qlooResultSchemas = {
  searchEntities: z.array(entityRefSchema),
  searchTags: z.array(tagRefSchema),
  getLocalityPlaces: localityPlacesSchema,
  getPlacesByTag: z.array(placeSchema),
  getAudienceAffinity: z.array(placeSchema),
  getTasteTags: z.array(tagAffinitySchema),
  getBrandAffinity: z.array(brandAffinitySchema),
  getDemographics: z.array(demographicSkewSchema),
} satisfies { [M in QlooMethodName]: z.ZodType<QlooMethods[M]["result"]> };

/** A record of one logical Qloo call, safe to show in the UI. Never contains the API key. */
export const qlooCallRecordSchema = z.object({
  method: z.string(),
  endpoint: z.string(),
  params: z.record(z.string(), z.string()),
  source: qlooSourceSchema,
  durationMs: z.number(),
  resultCount: z.number(),
  cached: z.boolean(),
  /** Why a less-preferred source was used, e.g. "live: HTTP 429". */
  fallbackReason: z.string().optional(),
});
export type QlooCallRecord = z.infer<typeof qlooCallRecordSchema>;

export interface Sourced<T> {
  data: T;
  source: QlooSource;
  call: QlooCallRecord;
}

export type QlooClient = {
  [M in QlooMethodName]: (args: QlooMethods[M]["args"]) => Promise<Sourced<QlooMethods[M]["result"]>>;
};

export type QlooErrorKind =
  | "no_key"
  | "http"
  | "rate_limited"
  | "timeout"
  | "network"
  | "invalid_response"
  | "not_recorded";

/** Error raised by Qloo clients. The message is always safe to log and display. */
export class QlooError extends Error {
  constructor(
    public readonly kind: QlooErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export function countResults(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object" && "places" in data) {
    const places = (data as { places: unknown }).places;
    return Array.isArray(places) ? places.length : 0;
  }
  return 0;
}
