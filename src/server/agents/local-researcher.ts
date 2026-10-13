import {
  localResearchOutputSchema,
  type CompetitorSummary,
  type LocalityProfile,
  type LocalResearchOutput,
  type VenueSummary,
} from "@/lib/schemas";
import { getMarketEstimate, suggestLocalities } from "../data/local-market";
import type { Place } from "../qloo/types";
import type { Agent } from "./types";

/**
 * Agent 1: Local Researcher.
 *
 * Identifies candidate areas and, for each one, gathers:
 *  - anchor venues: the area's most popular places according to Qloo. They stand in for
 *    "the people who spend time here" and become the taste signal for the next agent;
 *  - a vibe fingerprint from the tags Qloo attaches to those places;
 *  - existing competitors for every candidate concept (Qloo places near the area's centre);
 *  - stall fees, venue types and permit notes from the curated estimates dataset.
 */

export interface LocalResearchInput {
  city: string;
  /** Empty means "suggest for me". */
  localities: string[];
}

export const ANCHOR_COUNT = 5;
export const PLACES_PER_LOCALITY = 15;
export const COMPETITOR_RADIUS_M = 2000;
export const COMPETITOR_TAKE = 20;

/** Places that draw visitors for reasons unrelated to local taste. */
const NOT_A_HANGOUT = /hotel|hostel|lodg|resort|delivery|hospital|clinic|bank|atm|pharmacy/i;

export function toVenueSummary(p: Place): VenueSummary {
  return {
    id: p.id,
    name: p.name,
    ...(p.genre ? { genre: p.genre } : {}),
    ...(p.rating !== undefined ? { rating: p.rating } : {}),
    ...(p.neighborhood ? { neighborhood: p.neighborhood } : {}),
    ...(p.distanceM !== undefined ? { distanceM: p.distanceM } : {}),
    tags: p.tags.filter((t) => !/place$/.test(t.type)).slice(0, 6).map((t) => t.name),
  };
}

export function pickAnchors(places: Place[]): Place[] {
  const hangouts = places.filter((p) => !NOT_A_HANGOUT.test(p.genre ?? ""));
  return (hangouts.length >= 3 ? hangouts : places).slice(0, ANCHOR_COUNT);
}

/** Tags that describe almost any busy urban area and say little about taste. */
const GENERIC_VIBES = new Set(["city center", "central", "urban", "commercial", "walkable", "destination", "metropolitan", "all day"]);

/** How many of an area's places carry each vibe or audience tag (business-type tags are excluded). */
export function countVibeTags(places: Place[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const place of places) {
    const seen = new Set<string>();
    for (const tag of place.tags) {
      if (/place$/.test(tag.type) || seen.has(tag.name)) continue;
      seen.add(tag.name);
      counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
    }
  }
  return counts;
}

export interface VibeSource {
  counts: Map<string, number>;
  placesSeen: number;
}

/**
 * Picks the tags that best characterise one area. When other areas are being compared,
 * tags are ranked by how much more common they are here than elsewhere, so each area's
 * fingerprint shows what sets it apart instead of what every busy neighbourhood shares.
 */
export function vibeFingerprint(own: VibeSource, others: VibeSource[] = [], top = 8): { name: string; count: number }[] {
  const share = (s: VibeSource, name: string) => (s.placesSeen ? (s.counts.get(name) ?? 0) / s.placesSeen : 0);
  return [...own.counts.entries()]
    .filter(([name]) => !GENERIC_VIBES.has(name.toLowerCase()))
    .map(([name, count]) => {
      const elsewhere = others.length ? others.reduce((sum, o) => sum + share(o, name), 0) / others.length : 0;
      return { name, count, lift: share(own, name) - elsewhere };
    })
    .filter((t) => t.count >= 2 || own.placesSeen < 8)
    .sort((a, b) => b.lift - a.lift || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, top)
    .map(({ name, count }) => ({ name, count }));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export const localResearcher: Agent<LocalResearchInput, LocalResearchOutput> = async (input, ctx) => {
  const warnings: string[] = [];
  const suggestedByAgent = input.localities.length === 0;
  let localities = input.localities;
  if (suggestedByAgent) {
    const suggestion = suggestLocalities(input.city);
    localities = suggestion.localities;
    if (suggestion.cityKnown) {
      ctx.note(`No locality given, so comparing ${localities.join(", ")}`);
    } else {
      warnings.push(`No locality list for ${input.city} yet, so the city is analysed as one area.`);
    }
  }

  const researchOne = async (locality: string): Promise<{ profile: LocalityProfile; vibes: VibeSource }> => {
    const cityOnly = locality.trim().toLowerCase() === input.city.trim().toLowerCase();
    const found = await ctx.qloo.getLocalityPlaces({
      locality,
      city: cityOnly ? "" : input.city,
      take: PLACES_PER_LOCALITY,
    });
    const places = found.data.places;
    if (places.length === 0) throw new Error(`Qloo returned no places for ${locality}`);

    const resolved = found.data.resolved;
    const withCoords = places.filter((p) => p.lat !== undefined && p.lon !== undefined);
    const centre = resolved
      ? { lat: resolved.lat, lon: resolved.lon }
      : withCoords.length > 0
        ? { lat: mean(withCoords.map((p) => p.lat as number)), lon: mean(withCoords.map((p) => p.lon as number)) }
        : undefined;
    const level = resolved && !cityOnly ? "locality" : "city";
    ctx.note(
      `${locality}: ${places.length} places from Qloo` +
        (resolved ? `, resolved as "${resolved.name}"` : ", location not resolved"),
    );

    const competitors: CompetitorSummary[] = [];
    if (centre) {
      const results = await Promise.all(
        ctx.concepts.map(async (concept) => {
          try {
            const r = await ctx.qloo.getPlacesByTag({
              tagIds: concept.qlooTagIds,
              lat: centre.lat,
              lon: centre.lon,
              radiusM: COMPETITOR_RADIUS_M,
              take: COMPETITOR_TAKE,
              context: { locality, city: input.city },
            });
            return {
              conceptId: concept.id,
              count: r.data.length,
              capped: r.data.length >= COMPETITOR_TAKE,
              radiusM: COMPETITOR_RADIUS_M,
              top: r.data.slice(0, 3).map(toVenueSummary),
              source: r.source,
            } satisfies CompetitorSummary;
          } catch {
            warnings.push(`Could not check ${concept.label} competitors in ${locality}.`);
            return undefined;
          }
        }),
      );
      for (const c of results) if (c) competitors.push(c);
    } else {
      warnings.push(`No coordinates for ${locality}, so competitors were not checked.`);
    }

    const vibes: VibeSource = { counts: countVibeTags(places), placesSeen: places.length };
    const profile: LocalityProfile = {
      name: locality,
      ...(resolved ? { resolvedName: resolved.name } : {}),
      ...(centre ? { lat: centre.lat, lon: centre.lon } : {}),
      level,
      qlooSource: found.source,
      anchors: pickAnchors(places).map(toVenueSummary),
      placesSeen: places.length,
      vibeTags: [],
      competitors,
      market: getMarketEstimate(input.city, locality),
    };
    return { profile, vibes };
  };

  const settled = await Promise.allSettled(localities.map(researchOne));
  const researched: { profile: LocalityProfile; vibes: VibeSource }[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") researched.push(result.value);
    else warnings.push(`${localities[i]}: ${result.reason instanceof Error ? result.reason.message : "research failed"}`);
  });
  if (researched.length === 0) throw new Error(`No usable data for any locality in ${input.city}.`);
  const profiles = researched.map(({ profile, vibes }) => ({
    ...profile,
    vibeTags: vibeFingerprint(vibes, researched.filter((r) => r.profile !== profile).map((r) => r.vibes)),
  }));

  return localResearchOutputSchema.parse({ localities: profiles, suggestedByAgent, warnings });
};
