import {
  localResearchOutputSchema,
  type AdmiredResolution,
  type NeighbourhoodCandidate,
  type PartnerLead,
  type CompetitorSummary,
  type LocalityProfile,
  type LocalResearchOutput,
  type VenueSummary,
} from "@/lib/schemas";
import { COLLAB_PROFILES, getCollabProfile, HOST_TAG_IDS } from "../data/collab-profiles";
import { getMarketEstimate, suggestLocalities } from "../data/local-market";
import { classifyVenue, extractProductTerms, isAdministrativeArea, pickPartnerConcept } from "../partners";
import { isVibeTag, type Place } from "../qloo/types";
import { uniq, type Agent } from "./types";

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
    tags: p.tags.filter((t) => isVibeTag(t.type)).slice(0, 6).map((t) => t.name),
    ...(p.priceLevel !== undefined ? { priceLevel: p.priceLevel } : {}),
    ...(p.costDescription ? { costDescription: p.costDescription } : {}),
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
      if (!isVibeTag(tag.type) || seen.has(tag.name)) continue;
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

export const HEATMAP_TAKE = 25;
export const NEARBY_TAKE = 30;
export const HOST_TAKE = 10;
export const SUGGESTED_LOCALITY_COUNT = 3;

function toLead(
  p: Place,
  partnerType: PartnerLead["partnerType"],
  locality: string,
  source: PartnerLead["source"],
  signalNote: string | undefined,
  viaAdmired = false,
): PartnerLead {
  return {
    id: p.id,
    name: p.name,
    ...(p.genre ? { genre: p.genre } : {}),
    partnerType,
    locality,
    ...(p.neighborhood ? { neighborhood: p.neighborhood } : {}),
    ...(p.address ? { address: p.address } : {}),
    ...(p.rating !== undefined ? { rating: p.rating } : {}),
    ...(p.priceLevel !== undefined ? { priceLevel: p.priceLevel } : {}),
    ...(p.costDescription ? { costDescription: p.costDescription } : {}),
    ...(p.popularity !== undefined ? { popularity: p.popularity } : {}),
    ...(p.affinity !== undefined ? { affinity: p.affinity } : {}),
    ...(p.distanceM !== undefined ? { distanceM: p.distanceM } : {}),
    tags: p.tags.map((t) => t.name).slice(0, 25),
    ...(signalNote ? { signalNote } : {}),
    viaAdmired,
    source,
  };
}

const CITY_ALIASES: Record<string, string[]> = { bengaluru: ["bangalore"], bangalore: ["bengaluru"], mumbai: ["bombay"], chennai: ["madras"], kolkata: ["calcutta"] };
export const sameCity = (a: string | undefined, b: string) => {
  if (!a) return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || (CITY_ALIASES[y] ?? []).includes(x);
};

export const localResearcher: Agent<LocalResearchInput, LocalResearchOutput> = async (input, ctx) => {
  const warnings: string[] = [];
  const mode = ctx.input.launchMode;
  const wantsPartners = mode !== "solo";
  const suggestedByAgent = input.localities.length === 0;
  const productTerms = extractProductTerms(ctx.input.productDescription);
  const partnerConcept = wantsPartners ? pickPartnerConcept(ctx.concepts, COLLAB_PROFILES, productTerms) : undefined;
  const partnerProfile = partnerConcept ? getCollabProfile(partnerConcept.id) : undefined;

  // ------------------------------------------------------------------ 1. Where to look
  let localities = input.localities;
  let localitySource: LocalResearchOutput["localitySource"] = "user";
  const neighbourhoods: NeighbourhoodCandidate[] = [];
  if (suggestedByAgent) {
    // Ask Qloo which neighbourhoods the idea's audience is most associated with.
    const heatConcepts = uniq([...(partnerConcept ? [partnerConcept] : []), ...ctx.concepts]).slice(0, 2);
    const merged = new Map<string, NeighbourhoodCandidate & { lat?: number; lon?: number }>();
    for (const concept of heatConcepts) {
      try {
        const heat = await ctx.qloo.getNeighbourhoodHeatmap({ city: input.city, tagIds: [concept.qlooTagIds[0] as string], take: HEATMAP_TAKE });
        for (const row of heat.data) {
          if (isAdministrativeArea(row.name, input.city)) continue;
          const key = row.name.toLowerCase();
          const existing = merged.get(key);
          if (!existing || row.affinity > existing.affinity) {
            merged.set(key, { name: row.name, rank: 0, affinity: row.affinity, conceptLabels: uniq([...(existing?.conceptLabels ?? []), concept.label]), selected: false, source: heat.source });
          } else {
            existing.conceptLabels = uniq([...existing.conceptLabels, concept.label]);
          }
        }
      } catch {
        warnings.push(`Qloo's neighbourhood ranking for ${concept.label.toLowerCase()} was unavailable.`);
      }
    }
    const ranked = [...merged.values()].sort((a, b) => b.affinity - a.affinity || a.name.localeCompare(b.name)).map((n, i) => ({ ...n, rank: i + 1 }));
    if (ranked.length > 0) {
      localities = ranked.slice(0, SUGGESTED_LOCALITY_COUNT).map((n) => n.name);
      localitySource = "qloo_heatmap";
      for (const n of ranked.slice(0, 8)) neighbourhoods.push({ ...n, selected: localities.includes(n.name) });
      ctx.note(`Qloo ranked ${ranked.length} neighbourhoods for this idea's audience; comparing ${localities.join(", ")}`);
    } else {
      const suggestion = suggestLocalities(input.city);
      localities = suggestion.localities;
      localitySource = suggestion.cityKnown ? "curated_fallback" : "city_only";
      warnings.push(
        suggestion.cityKnown
          ? `No neighbourhood ranking came back from Qloo, so a fixed starter list for ${input.city} was used.`
          : `No neighbourhood data for ${input.city}, so the city is analysed as one area.`,
      );
    }
  }

  // ------------------------------------------------------------------ 2. Profile each locality
  const similarRaw = new Map<string, { places: Place[]; source: PartnerLead["source"] }>();
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
            // The same results double as "similar businesses" for partner discovery (no extra call).
            if (partnerConcept && concept.id === partnerConcept.id) similarRaw.set(locality, { places: r.data, source: r.source });
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

  // ------------------------------------------------------------------ 3. Potential partners
  const leads = new Map<string, PartnerLead>();
  const addLead = (lead: PartnerLead) => {
    const existing = leads.get(lead.id);
    // Keep the version that carries an affinity score.
    if (!existing || (existing.affinity === undefined && lead.affinity !== undefined)) leads.set(lead.id, lead);
  };
  let admired: AdmiredResolution | undefined;
  let excludedCount = 0;

  if (partnerConcept && partnerProfile) {
    ctx.note(`Looking for partners for ${partnerConcept.label.toLowerCase()}${productTerms.length ? ` (${productTerms.join(", ")})` : ""}`);
    await Promise.all(
      profiles.map(async (profile) => {
        const context = { locality: profile.name, city: input.city };
        const similar = similarRaw.get(profile.name);
        const similarPlaces = (similar?.places ?? []).filter((p) => classifyVenue(p.genre, p.name, partnerProfile) === "similar");
        for (const p of similarPlaces) addLead(toLead(p, "similar", profile.name, similar!.source, undefined));

        // Signal: people who like the area's similar businesses (or, failing that, its popular places).
        const signalPlaces = [...similarPlaces].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 3);
        const anchorIds = signalPlaces.length > 0 ? signalPlaces.map((p) => p.id) : profile.anchors.slice(0, 3).map((a) => a.id);
        const signalNote =
          signalPlaces.length > 0
            ? `with people who like ${signalPlaces.map((p) => p.name).join(", ")}`
            : `with people who visit ${profile.name}'s popular places`;
        if (anchorIds.length === 0) return;

        const classifyAll = (places: Place[], source: PartnerLead["source"]) => {
          for (const p of places) {
            const cls = classifyVenue(p.genre, p.name, partnerProfile);
            if (cls === "excluded") {
              excludedCount++;
              continue;
            }
            addLead(toLead(p, cls, profile.name, source, signalNote));
          }
        };
        try {
          const nearby = await ctx.qloo.getNearbyAffinityPlaces({ anchorIds, locality: profile.name, city: input.city, take: NEARBY_TAKE, context });
          classifyAll(nearby.data, nearby.source);
        } catch {
          warnings.push(`${profile.name}: could not search for complementary businesses.`);
        }
        try {
          const hosts = await ctx.qloo.getNearbyAffinityPlaces({ anchorIds, locality: profile.name, city: input.city, tagIds: HOST_TAG_IDS, take: HOST_TAKE, context });
          classifyAll(hosts.data, hosts.source);
        } catch {
          warnings.push(`${profile.name}: could not search for potential hosts.`);
        }
      }),
    );

    // The business the user admires, used as a reference audience.
    const admiredQuery = ctx.input.admiredBusiness?.trim();
    if (admiredQuery) {
      try {
        const found = await ctx.qloo.searchEntities({ query: admiredQuery, types: ["urn:entity:place"], take: 5 });
        const inCity = found.data.filter((e) => sameCity(e.city, input.city));
        const elsewhere = found.data.filter((e) => !sameCity(e.city, input.city)).map((e) => `${e.name}${e.city ? ` (${e.city})` : ""}`);
        if (inCity.length === 0) {
          admired = {
            query: admiredQuery,
            status: found.data.length ? "not_in_city" : "not_found",
            alternatives: elsewhere.slice(0, 3),
            note: found.data.length
              ? `Qloo found places with that name, but none in ${input.city}. Check the spelling or add the area.`
              : `Qloo did not recognise "${admiredQuery}". Check the spelling or try the name as it appears on maps.`,
          };
        } else {
          const exact = inCity.find((e) => e.name.toLowerCase().includes(admiredQuery.toLowerCase().split(",")[0]!.trim()));
          const match = exact ?? inCity[0]!;
          admired = {
            query: admiredQuery,
            status: exact ? "matched" : "ambiguous",
            match: { id: match.id, name: match.name, ...(match.neighborhood ? { neighborhood: match.neighborhood } : {}), ...(match.genre ? { genre: match.genre } : {}) },
            alternatives: inCity.filter((e) => e.id !== match.id).map((e) => e.name).slice(0, 3),
            note: exact
              ? `Using ${match.name}${match.neighborhood ? ` in ${match.neighborhood}` : ""} as a reference audience.`
              : `No exact match; using the closest result, ${match.name}. Check that this is the business you meant.`,
          };
          const similar = await ctx.qloo.getAudienceAffinity({ anchorIds: [match.id], tagIds: partnerConcept.qlooTagIds, city: input.city, take: 10 });
          for (const p of similar.data) {
            if (p.id === match.id) continue;
            const cls = classifyVenue(p.genre, p.name, partnerProfile);
            if (cls === "excluded") continue;
            addLead(toLead(p, cls, p.neighborhood ?? input.city, similar.source, `with people who like ${match.name}`, true));
          }
          ctx.note(`${match.name}: found ${similar.data.length} places with a similar crowd`);
        }
      } catch {
        admired = { query: admiredQuery, status: "failed", alternatives: [], note: "The reference business could not be looked up right now." };
      }
    }

    const counts = { similar: 0, complementary: 0, host: 0 };
    for (const l of leads.values()) counts[l.partnerType]++;
    ctx.note(`Potential partners: ${counts.similar} similar, ${counts.complementary} complementary, ${counts.host} possible hosts${excludedCount ? ` (${excludedCount} unsuitable venues filtered out)` : ""}`);
  } else if (ctx.input.admiredBusiness) {
    warnings.push("The business you admire is used when looking for partners; choose “With an existing business” or “Show me both” to use it.");
  }

  return localResearchOutputSchema.parse({
    localities: profiles,
    suggestedByAgent,
    localitySource,
    neighbourhoods,
    ...(partnerConcept ? { partnerConceptId: partnerConcept.id } : {}),
    partnerLeads: [...leads.values()],
    ...(admired ? { admired } : {}),
    warnings,
  });
};
