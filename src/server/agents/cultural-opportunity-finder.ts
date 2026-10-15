import {
  culturalOutputSchema,
  type CulturalOutput,
  type Evidence,
  type LocalityProfile,
  type LocalResearchOutput,
  type Opportunity,
  type PartnerCandidate,
  type ProductProfile,
} from "@/lib/schemas";
import { COLLAB_PROFILES, getCollabProfile } from "../data/collab-profiles";
import type { Concept } from "../data/concepts";
import { extractProductTerms, pickPartnerConcept, scorePartner, stems } from "../partners";
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
  extraKeywords: string[] = [],
): Promise<Assessment> {
  // The user's own product words count as extra keywords for the idea they describe.
  const keywords = [...concept.keywords, ...extraKeywords];
  const sources: QlooSource[] = [profile.qlooSource];
  const evidence: Evidence[] = [];
  const anchorIds = profile.anchors.map((a) => a.id);

  // 1. Core signal: affinity of concept-type places to the anchors' audience.
  let meanAffinity: number | undefined;
  let affinityPlaces = 0;
  let affinitySource: QlooSource | undefined;
  try {
    const r = await ctx.qloo.getAudienceAffinity({
      anchorIds,
      tagIds: concept.qlooTagIds,
      city: ctx.input.city,
      take: AFFINITY_TAKE,
      context: { locality: profile.name, city: ctx.input.city },
    });
    sources.push(r.source);
    affinitySource = r.source;
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
  const matchedTags = (signals.tasteTags?.data ?? []).filter((t) => matchesAny(t.name, keywords, concept.excludeKeywords));
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
  const matchedBrands = brands.filter((b) => matchesAny(`${b.name} ${b.tags.join(" ")}`, keywords, concept.excludeKeywords));
  const matchedVibes = profile.vibeTags.filter((v) => matchesAny(v.name, keywords, concept.excludeKeywords));
  const matchedAnchors = profile.anchors.filter((a) => matchesAny(`${a.genre ?? ""} ${a.tags.join(" ")}`, keywords, concept.excludeKeywords));
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

  return {
    concept,
    profile,
    meanAffinity,
    affinityPlaces,
    affinitySource,
    resonanceMatches: matchedTags.length + matchedBrands.length + matchedVibes.length + matchedAnchors.length,
    targetAudience,
    evidence,
    sources: uniq(sources),
  };
}

/** What is known about one concept in one locality before localities are compared. */
interface Assessment {
  concept: Concept;
  profile: LocalityProfile;
  meanAffinity: number | undefined;
  affinityPlaces: number;
  affinitySource: QlooSource | undefined;
  resonanceMatches: number;
  targetAudience: string;
  evidence: Evidence[];
  sources: QlooSource[];
}

/**
 * Locality lift: how much more this area's audience likes the concept than the audiences
 * of the other areas being compared. This is the signal that answers "where", and it can
 * only come from Qloo. Undefined when there is nothing to compare against.
 */
export function localityLift(own: number | undefined, others: (number | undefined)[]): number | undefined {
  const known = others.filter((v): v is number => v !== undefined);
  if (own === undefined || known.length === 0) return undefined;
  return round3(own - (mean(known) as number));
}

function finalise(a: Assessment, all: Assessment[]): Opportunity {
  const { concept, profile, meanAffinity, affinityPlaces } = a;
  const peers = all.filter((x) => x.concept.id === concept.id && x.profile.name !== profile.name);
  const lift = localityLift(meanAffinity, peers.map((p) => p.meanAffinity));
  const fit = culturalFit({ meanAffinity, affinityPlaces, localityLift: lift, resonanceMatches: a.resonanceMatches });

  const evidence = [...a.evidence];
  if (lift !== undefined && meanAffinity !== undefined && a.affinitySource) {
    const peerMean = round3(meanAffinity - lift);
    evidence.unshift({
      kind: "locality_lift",
      label: `${lift >= 0 ? "+" : ""}${lift.toFixed(3)} versus the other areas compared`,
      detail: `${concept.label} places average ${meanAffinity.toFixed(3)} affinity with the ${profile.name} audience, against ${peerMean.toFixed(3)} for ${peers.map((p) => p.profile.name).join(" and ")}`,
      value: lift,
      source: a.affinitySource,
    });
  }

  const liftText =
    lift === undefined ? "" : lift >= 0.005 ? `, ${lift.toFixed(3)} above the other areas compared` : lift <= -0.005 ? `, ${Math.abs(lift).toFixed(3)} below the other areas compared` : ", about the same as the other areas compared";
  const hypothesis =
    meanAffinity !== undefined
      ? `${a.targetAudience} already respond to similar places (mean Qloo affinity ${meanAffinity.toFixed(3)} across ${Math.min(affinityPlaces, AFFINITY_TOP_N)} ${affinityPlaces === 1 ? "place" : "places"}${liftText}), so ${article(concept.label)} ${concept.label.toLowerCase()} in ${profile.name} is a testable bet.`
      : `No affinity data was available for ${concept.label.toLowerCase()} in ${profile.name}, so this option is scored neutrally.`;

  return {
    conceptId: concept.id,
    locality: profile.name,
    culturalFit: fit.culturalFit,
    breakdown: {
      ...(meanAffinity !== undefined ? { meanAffinity } : {}),
      ...(lift !== undefined ? { localityLift: lift } : {}),
      affinityPlaces,
      evidenceWeight: fit.evidenceWeight,
      affinityScore: fit.affinityScore,
      liftScore: fit.liftScore,
      resonanceScore: fit.resonanceScore,
    },
    targetAudience: a.targetAudience,
    hypothesis,
    evidence,
    qlooSources: a.sources,
  };
}

/** Reads the user's product description and matches it to Qloo tags (at most 3 tag lookups). */
async function interpretProduct(ctx: AgentContext, fallbackTerms: string[]): Promise<ProductProfile> {
  const userTerms = extractProductTerms(ctx.input.productDescription);
  const terms = userTerms.length ? userTerms : fallbackTerms;
  const tags: ProductProfile["tags"] = [];
  for (const term of userTerms.slice(0, 3)) {
    try {
      const r = await ctx.qloo.searchTags({ query: term, take: 6 });
      for (const tag of r.data.filter((x) => PRODUCT_TAG_TYPE.test(x.type)).slice(0, 3)) {
        if (!tags.some((x) => x.name.toLowerCase() === tag.name.toLowerCase())) tags.push({ name: tag.name, type: tag.type });
      }
    } catch {
      // A failed lookup only means fewer tags; plain words are still matched.
    }
  }
  return {
    ...(ctx.input.productDescription ? { description: ctx.input.productDescription } : {}),
    terms,
    tags,
    source: userTerms.length ? "user" : "default",
  };
}

const PRODUCT_TAG_TYPE = /specialty_dish|menu_highlight|cuisine|dietary_option|offerings|genre:place|category:place/;

export const culturalOpportunityFinder: Agent<LocalResearchOutput, CulturalOutput> = async (input, ctx) => {
  const warnings: string[] = [];
  const userTerms = extractProductTerms(ctx.input.productDescription);
  const productConcept = pickPartnerConcept(ctx.concepts, COLLAB_PROFILES, userTerms);
  const productStemsForIdea = userTerms.length ? stems(userTerms) : [];
  const perLocality = await Promise.all(
    input.localities.map(async (profile) => {
      const signals = await gatherLocalitySignals(profile, ctx, warnings);
      const taste = signals.tasteTags?.data.slice(0, 3).map((t) => t.name).join(", ");
      ctx.note(`${profile.name}: audience leans towards ${taste || "no clear genres"}`);
      return Promise.all(ctx.concepts.map((concept) => assess(concept, profile, signals, ctx, warnings, concept.id === productConcept?.id ? productStemsForIdea : [])));
    }),
  );
  // Second pass: compare localities with each other to get the lift for every concept.
  const assessments = perLocality.flat();
  const opportunities = assessments.map((a) => finalise(a, assessments));
  for (const concept of ctx.concepts) {
    const best = opportunities
      .filter((o) => o.conceptId === concept.id && o.breakdown.localityLift !== undefined)
      .sort((x, y) => (y.breakdown.localityLift ?? 0) - (x.breakdown.localityLift ?? 0))[0];
    if (best && (best.breakdown.localityLift ?? 0) > 0) {
      ctx.note(`${concept.label}: strongest pull in ${best.locality} (+${(best.breakdown.localityLift ?? 0).toFixed(3)} affinity versus the other areas)`);
    }
  }
  const degraded = opportunities.every((o) => o.breakdown.meanAffinity === undefined);
  if (degraded) warnings.push("No Qloo affinity data was available; cultural fit is neutral for every option.");

  // Partner compatibility: product similarity, audience affinity, reputation and category fit.
  const partnerConcept = input.partnerConceptId ? ctx.concepts.find((c) => c.id === input.partnerConceptId) : undefined;
  const collabProfile = partnerConcept ? getCollabProfile(partnerConcept.id) : undefined;
  let productProfile: ProductProfile | undefined;
  let partners: PartnerCandidate[] = [];
  if (partnerConcept && collabProfile) {
    productProfile = await interpretProduct(ctx, collabProfile.defaultProductTerms);
    if (productProfile.source === "user") {
      ctx.note(`Product read as: ${productProfile.terms.join(", ")}${productProfile.tags.length ? `; Qloo tags: ${productProfile.tags.map((x) => x.name).join(", ")}` : ""}`);
    }
    const productStems = stems([...productProfile.terms, ...productProfile.tags.map((x) => x.name)]);
    const productLabel = productProfile.source === "user" ? productProfile.terms.slice(0, 2).join(" and ") : partnerConcept.label.toLowerCase();
    partners = input.partnerLeads
      .map((lead) => scorePartner(lead, partnerConcept, collabProfile, productStems, productLabel))
      .sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name));
    // Keep a balanced shortlist: at most 6 of each type.
    const perType = { similar: 0, complementary: 0, host: 0 };
    const ranked = partners;
    partners = ranked.filter((p) => ++perType[p.partnerType] <= 6);
    // The user asked for places like the business they admire, so always show the best two of those.
    for (const p of ranked.filter((x) => x.viaAdmired).slice(0, 2)) {
      if (!partners.includes(p)) partners.push(p);
    }
    if (partners.length) {
      const top = partners[0]!;
      ctx.note(`Best partner match: ${top.name} (${top.partnerType}, fit ${top.fitScore}/100)`);
    } else {
      warnings.push("No suitable partner businesses were found near the localities analysed.");
    }
  }
  return culturalOutputSchema.parse({ opportunities, degraded, warnings, partners, ...(productProfile ? { productProfile } : {}) });
};

/** Neutral opportunities, used by the orchestrator when this agent fails outright. */
export function neutralOpportunities(local: LocalResearchOutput, concepts: Concept[]): CulturalOutput {
  const opportunities: Opportunity[] = local.localities.flatMap((profile) =>
    concepts.map((concept) => ({
      conceptId: concept.id,
      locality: profile.name,
      culturalFit: NEUTRAL_SCORE,
      breakdown: { affinityPlaces: 0, evidenceWeight: 0, affinityScore: NEUTRAL_SCORE, liftScore: NEUTRAL_SCORE, resonanceScore: NEUTRAL_SCORE },
      targetAudience: `People who spend time in ${profile.name}`,
      hypothesis: `Cultural analysis was unavailable, so ${concept.label.toLowerCase()} in ${profile.name} is scored neutrally.`,
      evidence: [],
      qlooSources: [profile.qlooSource],
    })),
  );
  return { opportunities, partners: [], degraded: true, warnings: ["Cultural analysis failed; neutral cultural-fit scores were used."] };
}
