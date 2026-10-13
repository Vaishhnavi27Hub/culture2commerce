import {
  culturalOutputSchema,
  type CulturalOutput,
  type Evidence,
  type LocalityProfile,
  type LocalResearchOutput,
  type Opportunity,
} from "@/lib/schemas";
import type { Concept } from "../data/concepts";
import type { BrandAffinity, DemographicSkew, QlooSource, Sourced, TagAffinity } from "../qloo/types";
import { culturalFit, NEUTRAL_SCORE } from "../scoring";
import { article, matchesAny, uniq, type Agent, type AgentContext } from "./types";

/**
 * Agent 2: Cultural Opportunity Finder.
 *
 * Uses Qloo affinities to test each concept against each locality's audience. The
 * audience is represented by the locality's anchor venues (from Agent 1), which are
 * sent to Qloo as `signal.interests.entities`.
 *
 * Per locality: taste tags, brand affinities and demographics of the anchor audience.
 * Per concept and locality: how strongly existing places of that concept type resonate
 * with that audience. The mean of those affinities is the core of the cultural-fit score.
 */

export const AFFINITY_TAKE = 10;
export const AFFINITY_TOP_N = 5;

const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "under 25",
  "25_to_29": "25 to 29",
  "30_to_34": "30 to 34",
  "35_to_44": "35 to 44",
  "45_to_54": "45 to 54",
  "55_and_older": "55 and over",
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Averages the per-venue demographic skews and names the strongest age bands. */
export function summariseDemographics(skews: DemographicSkew[]): { ageBands: string[]; genderNote?: string; top?: { band: string; skew: number } } {
  if (skews.length === 0) return { ageBands: [] };
  const bands = uniq(skews.flatMap((s) => Object.keys(s.age)));
  const averaged = bands
    .map((band) => ({ band, skew: mean(skews.map((s) => s.age[band]).filter((v): v is number => v !== undefined)) ?? 0 }))
    .sort((a, b) => b.skew - a.skew);
  const strong = averaged.filter((b) => b.skew > 0.03).slice(0, 2);
  const male = mean(skews.map((s) => s.gender.male).filter((v): v is number => v !== undefined)) ?? 0;
  const genderNote = male > 0.15 ? "skews male" : male < -0.15 ? "skews female" : undefined;
  return {
    ageBands: strong.map((b) => AGE_LABEL[b.band] ?? b.band.replace(/_/g, " ")),
    ...(genderNote ? { genderNote } : {}),
    ...(strong[0] ? { top: { band: AGE_LABEL[strong[0].band] ?? strong[0].band, skew: round3(strong[0].skew) } } : {}),
  };
}

export function describeAudience(profile: LocalityProfile, demo: ReturnType<typeof summariseDemographics>): string {
  const who = demo.ageBands.length ? `People aged ${demo.ageBands.join(" and ")}` : "People";
  // Short venue names only; long listing-style names read badly in a sentence.
  const names = profile.anchors
    .map((a) => a.name.split(/ [-|,] /)[0]?.trim() ?? a.name)
    .filter((n) => n.length <= 32)
    .slice(0, 2);
  const where = names.length ? ` who go to ${profile.name} places like ${names.join(" and ")}` : ` who spend time in ${profile.name}`;
  return `${who}${where}`;
}

interface LocalitySignals {
  tasteTags?: Sourced<TagAffinity[]>;
  brands?: Sourced<BrandAffinity[]>;
  demographics?: Sourced<DemographicSkew[]>;
}

async function gatherLocalitySignals(profile: LocalityProfile, ctx: AgentContext, warnings: string[]): Promise<LocalitySignals> {
  const anchorIds = profile.anchors.map((a) => a.id);
  const context = { locality: profile.name, city: ctx.input.city };
  const attempt = async <T>(what: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      warnings.push(`${profile.name}: could not fetch ${what}.`);
      return undefined;
    }
  };
  const [tasteTags, brands, demographics] = await Promise.all([
    attempt("taste tags", () => ctx.qloo.getTasteTags({ anchorIds, tagTypes: ["urn:tag:genre:place"], take: 50, context })),
    attempt("brand affinities", () => ctx.qloo.getBrandAffinity({ anchorIds, take: 8, context })),
    attempt("demographics", () => ctx.qloo.getDemographics({ anchorIds, context })),
  ]);
  return {
    ...(tasteTags ? { tasteTags } : {}),
    ...(brands ? { brands } : {}),
    ...(demographics ? { demographics } : {}),
  };
}

async function assess(
  concept: Concept,
  profile: LocalityProfile,
  signals: LocalitySignals,
  ctx: AgentContext,
  warnings: string[],
): Promise<Opportunity> {
  const sources: QlooSource[] = [profile.qlooSource];
  const evidence: Evidence[] = [];
  const anchorIds = profile.anchors.map((a) => a.id);

  // 1. Core signal: affinity of concept-type places to the anchors' audience.
  let meanAffinity: number | undefined;
  let affinityPlaces = 0;
  try {
    const r = await ctx.qloo.getAudienceAffinity({
      anchorIds,
      tagIds: concept.qlooTagIds,
      city: ctx.input.city,
      take: AFFINITY_TAKE,
      context: { locality: profile.name, city: ctx.input.city },
    });
    sources.push(r.source);
    // Drop places Qloo files under the concept's tags but that are clearly something else
    // (for example a tattoo studio tagged as an art studio).
    const offTopic = (text: string) => (concept.excludeKeywords ?? []).some((x) => text.toLowerCase().includes(x));
    const scored = r.data.filter((p) => p.affinity !== undefined && !offTopic(`${p.name} ${p.genre ?? ""}`)).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
    affinityPlaces = scored.length;
    const top = scored.slice(0, AFFINITY_TOP_N);
    const m = mean(top.map((p) => p.affinity as number));
    meanAffinity = m === undefined ? undefined : round3(m);
    for (const p of top.slice(0, 3)) {
      evidence.push({
        kind: "concept_affinity",
        label: p.name,
        detail: `${p.genre ?? "Place"} that resonates with ${profile.name}'s audience`,
        value: p.affinity as number,
        source: r.source,
      });
    }
  } catch {
    warnings.push(`${profile.name}: could not fetch ${concept.label} affinity.`);
  }

  // 2. Supporting signal: does the concept show up in the audience's over-indexed genres?
  const matchedTags = (signals.tasteTags?.data ?? []).filter((t) => matchesAny(t.name, concept.keywords, concept.excludeKeywords));
  const tasteAffinity = matchedTags.length ? Math.max(...matchedTags.map((t) => t.affinity)) : undefined;
  if (signals.tasteTags) sources.push(signals.tasteTags.source);
  for (const t of matchedTags.slice(0, 3)) {
    evidence.push({
      kind: "taste_tag",
      label: t.name,
      detail: "Genre this audience over-indexes on",
      value: t.affinity,
      source: signals.tasteTags!.source,
    });
  }

  // 3. Resonance: brands, vibe tags and anchor venues that echo the concept.
  const brands = signals.brands?.data ?? [];
  const matchedBrands = brands.filter((b) => matchesAny(`${b.name} ${b.tags.join(" ")}`, concept.keywords, concept.excludeKeywords));
  const matchedVibes = profile.vibeTags.filter((v) => matchesAny(v.name, concept.keywords, concept.excludeKeywords));
  const matchedAnchors = profile.anchors.filter((a) => matchesAny(`${a.genre ?? ""} ${a.tags.join(" ")}`, concept.keywords, concept.excludeKeywords));
  if (signals.brands) sources.push(signals.brands.source);
  const brandEvidence = matchedBrands.length ? matchedBrands.slice(0, 3) : brands.slice(0, 2);
  for (const b of brandEvidence) {
    evidence.push({
      kind: "brand",
      label: b.name,
      detail: matchedBrands.length
        ? `Brand this audience favours (${b.tags.slice(0, 3).join(", ")})`
        : `Brand this audience favours; shown for context, no direct link to ${concept.label.toLowerCase()}`,
      value: b.affinity,
      source: signals.brands!.source,
    });
  }
  for (const v of matchedVibes.slice(0, 2)) {
    evidence.push({
      kind: "vibe_tag",
      label: v.name,
      detail: `Tag on ${v.count} of ${profile.placesSeen} popular places in ${profile.name}`,
      value: v.count,
      source: profile.qlooSource,
    });
  }
  for (const a of profile.anchors.slice(0, 3)) {
    evidence.push({
      kind: "anchor_venue",
      label: a.name,
      detail: `${a.genre ?? "Popular place"} used as an audience anchor`,
      ...(a.rating !== undefined ? { value: a.rating } : {}),
      source: profile.qlooSource,
    });
  }

  // 4. Audience.
  const demo = summariseDemographics(signals.demographics?.data ?? []);
  if (signals.demographics) {
    sources.push(signals.demographics.source);
    if (demo.top) {
      evidence.push({
        kind: "demographic",
        label: `Age ${demo.top.band}`,
        detail: `Strongest age skew among visitors to the anchor venues${demo.genderNote ? `; audience ${demo.genderNote}` : ""}`,
        value: demo.top.skew,
        source: signals.demographics.source,
      });
    }
  }
  const targetAudience = describeAudience(profile, demo);

  const fit = culturalFit({
    meanAffinity,
    tasteAffinity,
    resonanceMatches: matchedBrands.length + matchedVibes.length + matchedAnchors.length,
  });

  const hypothesis =
    meanAffinity !== undefined
      ? `${targetAudience} already respond to similar places (mean Qloo affinity ${meanAffinity.toFixed(2)} across ${Math.min(affinityPlaces, AFFINITY_TOP_N)} places), so ${article(concept.label)} ${concept.label.toLowerCase()} in ${profile.name} is a testable bet.`
      : `No affinity data was available for ${concept.label.toLowerCase()} in ${profile.name}, so this option is scored neutrally.`;

  return {
    conceptId: concept.id,
    locality: profile.name,
    culturalFit: fit.culturalFit,
    breakdown: {
      ...(meanAffinity !== undefined ? { meanAffinity } : {}),
      affinityPlaces,
      affinityScore: fit.affinityScore,
      tasteScore: fit.tasteScore,
      resonanceScore: fit.resonanceScore,
    },
    targetAudience,
    hypothesis,
    evidence,
    qlooSources: uniq(sources),
  };
}

export const culturalOpportunityFinder: Agent<LocalResearchOutput, CulturalOutput> = async (input, ctx) => {
  const warnings: string[] = [];
  const perLocality = await Promise.all(
    input.localities.map(async (profile) => {
      const signals = await gatherLocalitySignals(profile, ctx, warnings);
      const taste = signals.tasteTags?.data.slice(0, 3).map((t) => t.name).join(", ");
      ctx.note(`${profile.name}: audience leans towards ${taste || "no clear genres"}`);
      return Promise.all(ctx.concepts.map((concept) => assess(concept, profile, signals, ctx, warnings)));
    }),
  );
  const opportunities = perLocality.flat();
  const degraded = opportunities.every((o) => o.breakdown.meanAffinity === undefined);
  if (degraded) warnings.push("No Qloo affinity data was available; cultural fit is neutral for every option.");
  return culturalOutputSchema.parse({ opportunities, degraded, warnings });
};

/** Neutral opportunities, used by the orchestrator when this agent fails outright. */
export function neutralOpportunities(local: LocalResearchOutput, concepts: Concept[]): CulturalOutput {
  const opportunities: Opportunity[] = local.localities.flatMap((profile) =>
    concepts.map((concept) => ({
      conceptId: concept.id,
      locality: profile.name,
      culturalFit: NEUTRAL_SCORE,
      breakdown: { affinityPlaces: 0, affinityScore: NEUTRAL_SCORE, tasteScore: NEUTRAL_SCORE, resonanceScore: NEUTRAL_SCORE },
      targetAudience: `People who spend time in ${profile.name}`,
      hypothesis: `Cultural analysis was unavailable, so ${concept.label.toLowerCase()} in ${profile.name} is scored neutrally.`,
      evidence: [],
      qlooSources: [profile.qlooSource],
    })),
  );
  return { opportunities, degraded: true, warnings: ["Cultural analysis failed; neutral cultural-fit scores were used."] };
}
