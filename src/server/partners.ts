import { COLLAB_MODEL_INFO, computeCollab, type CollabAssumptions, type CollabInputs, type CollabModelId } from "@/lib/collab";
import type {
  CollabOption,
  LocalityProfile,
  PartnerCandidate,
  PartnerLead,
  PartnerType,
  RiskPreference,
  ScoredOption,
  StrategyComparison,
} from "@/lib/schemas";
import { uniq } from "./agents/types";
import type { CollabProfile } from "./data/collab-profiles";
import { EXCLUDED_GENRES, HOST_GENRES } from "./data/collab-profiles";
import type { Concept } from "./data/concepts";
import { affinityToScore, budgetScore, clamp, DOWNGRADE_PENALTY, DOWNGRADE_RATIO, REJECT_PENALTY, REJECT_RATIO, round1 } from "./scoring";

/**
 * Partner discovery helpers shared by the four agents. Everything here is deterministic:
 * Qloo supplies the venues and affinities; these functions classify, score and cost them.
 */

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type VenueClass = PartnerType | "excluded";

/** Decides how a venue could relate to the idea, from its Qloo genre and name. */
export function classifyVenue(genre: string | undefined, name: string, profile: CollabProfile): VenueClass {
  const text = `${genre ?? ""} ${name}`;
  if (EXCLUDED_GENRES.test(genre ?? "")) return "excluded";
  if (profile.similarGenres.test(text)) return "similar";
  if (HOST_GENRES.test(genre ?? "") || HOST_GENRES.test(name)) return "host";
  if (profile.complementaryGenres.test(genre ?? "")) return "complementary";
  return "excluded";
}

// ---------------------------------------------------------------------------
// Product interpretation
// ---------------------------------------------------------------------------

const FILLER = /\b(i|we|my|our|make|makes|making|sell|selling|bake|baking|homemade|home made|home-made|fresh|freshly|small batch|small-batch|also|some|like|love|really|very|the|a|an|of|for|to)\b/gi;

/** Turns "I make eggless brownies, vegan cupcakes and plum cakes." into ["eggless brownies", "vegan cupcakes", "plum cakes"]. */
export function extractProductTerms(description: string | undefined, max = 4): string[] {
  if (!description) return [];
  return uniq(
    description
      .toLowerCase()
      .split(/,|;|\/|\.|&|\band\b|\bwith\b|\bor\b|\n/)
      .map((part) => part.replace(FILLER, " ").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim())
      .filter((part) => part.length >= 3 && part.length <= 40),
  ).slice(0, max);
}

/** Words people use for a product that Qloo tags differently. */
const SYNONYMS: Record<string, string[]> = {
  eggless: ["egg free", "eggless"],
  "egg-free": ["egg free"],
  "gluten-free": ["gluten free"],
  "sugar-free": ["sugar free"],
  jewellery: ["jewelry", "jewellery"],
};

/** Word stems used to match products against Qloo tags ("brownies" matches "Brownie", "pastries" matches "Pastry"). */
export function stems(terms: string[]): string[] {
  const words = terms.flatMap((t) => t.toLowerCase().split(/\s+/));
  const out: string[] = [];
  for (const w of words) {
    out.push(...(SYNONYMS[w] ?? []));
    if (w.endsWith("ies") && w.length > 5) out.push(`${w.slice(0, -3)}y`);
    out.push(w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  }
  return uniq(out.filter((w) => w.length >= 4));
}

/** Which of the product stems appear in a venue's tags or genre. */
export function productMatches(productStems: string[], venueTexts: string[]): string[] {
  const hits: string[] = [];
  for (const text of venueTexts) {
    const lower = text.toLowerCase();
    if (productStems.some((s) => lower.includes(s))) hits.push(text);
  }
  return uniq(hits).slice(0, 5);
}

/** Picks the selected idea that best matches the product description (first idea on a tie). */
export function pickPartnerConcept(concepts: Concept[], profiles: Record<string, CollabProfile | undefined>, terms: string[]): Concept | undefined {
  const candidates = concepts.filter((c) => profiles[c.id]);
  if (candidates.length === 0) return undefined;
  if (terms.length === 0) return candidates[0];
  const s = stems(terms);
  const score = (c: Concept) => {
    const words = [...c.keywords, ...(profiles[c.id]?.defaultProductTerms ?? []), c.label, ...c.products.map((p) => p.item)].join(" ").toLowerCase();
    return s.filter((st) => words.includes(st)).length;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

// ---------------------------------------------------------------------------
// Administrative areas in heatmap results
// ---------------------------------------------------------------------------

const ADMIN_WORDS = /\b(zone|urban|rural|district|division|taluk|tehsil|authority|metropolitan|region|corporation|municipal|state|province|county|circle|ward no)\b/i;

/** True for heatmap rows that are cities, districts or administrative zones rather than neighbourhoods. */
export function isAdministrativeArea(name: string, city: string, cityAliases: string[] = []): boolean {
  const n = name.trim().toLowerCase();
  const names = [city.trim().toLowerCase(), ...cityAliases.map((a) => a.toLowerCase())];
  if (names.includes(n)) return true;
  if (ADMIN_WORDS.test(name)) return true;
  // e.g. "Bangalore North", "Bengaluru East"
  return names.some((c) => new RegExp(`^${c}\\s+(north|south|east|west|central)$`).test(n)) || /^(bangalore|bengaluru)\s+(north|south|east|west|central)$/.test(n);
}

// ---------------------------------------------------------------------------
// Partner scoring
// ---------------------------------------------------------------------------

const TRAFFIC_TAG = /high pedestrian traffic|busy|bustling|commuter hub|crowded|tourist|high traffic|lively/i;

/** Branch names usually look like "Brand - Area" or "Brand, Area". Independent places are better first partners. */
export const CHAIN_PENALTY = 10;
export function looksLikeChainBranch(name: string): boolean {
  return /\s[-–|]\s\S/.test(name) || /\b(outlet|branch)\b/i.test(name);
}

const reputationOf = (lead: PartnerLead) => {
  const rating = lead.rating !== undefined ? clamp(((lead.rating - 3.5) / 1.3) * 100) : 50;
  const popularity = lead.popularity !== undefined ? lead.popularity * 100 : 50;
  return round1(0.7 * rating + 0.3 * popularity);
};

export function scorePartner(lead: PartnerLead, concept: Concept, profile: CollabProfile, productStems: string[], productLabel: string): PartnerCandidate {
  const audienceScore = lead.affinity !== undefined ? affinityToScore(lead.affinity) : 50;
  const reputationScore = reputationOf(lead);
  const matches = productMatches(productStems, [...lead.tags, lead.genre ?? ""]);
  const reasons: string[] = [];
  const risks: string[] = [];
  const affinityText =
    lead.affinity !== undefined
      ? `Qloo affinity ${lead.affinity.toFixed(2)} ${lead.signalNote ?? "with the local audience"}`
      : "No affinity was measured for this venue";

  let secondaryScore: number;
  let secondaryLabel: string;
  let fitScore: number;
  let suggestedModel: CollabModelId;

  if (lead.partnerType === "similar") {
    secondaryLabel = "Product similarity";
    secondaryScore = clamp(matches.length * 34);
    fitScore = 0.45 * audienceScore + 0.35 * secondaryScore + 0.2 * reputationScore;
    reasons.push(`${lead.genre ?? "Similar business"} in ${lead.neighborhood ?? lead.locality}; ${affinityText}.`);
    if (matches.length) reasons.push(`Its Qloo tags overlap with your product: ${matches.join(", ")}.`);
    if (lead.viaAdmired) reasons.push("Found because its crowd resembles the business you admire.");
    risks.push("Sells similar products and may see you as a competitor; do not assume it accepts outside products.");
    if (matches.length >= 2) risks.push("Strong product overlap: pitch something it does not already offer.");
    suggestedModel = profile.models.includes("consignment") ? "consignment" : profile.models[0] ?? "counter";
  } else if (lead.partnerType === "complementary") {
    secondaryLabel = "Category fit";
    secondaryScore = matches.length ? 60 : 100;
    fitScore = 0.55 * audienceScore + 0.25 * reputationScore + 0.2 * secondaryScore;
    reasons.push(`${lead.genre ?? "Venue"}: a natural fit because ${profile.complementaryWhy}.`);
    reasons.push(`${affinityText}.`);
    if (matches.length) risks.push(`Already lists ${matches.join(", ")}, so it may partly compete.`);
    suggestedModel = profile.models.find((m) => m === "consignment" || m === "wholesale") ?? profile.models[0] ?? "counter";
  } else {
    secondaryLabel = "Potential visibility";
    const traffic = lead.tags.filter((t) => TRAFFIC_TAG.test(t));
    secondaryScore = clamp((lead.popularity ?? 0.5) * 80 + traffic.length * 20);
    fitScore = 0.45 * audienceScore + 0.35 * secondaryScore + 0.2 * reputationScore;
    reasons.push(`${lead.genre ?? "Venue"} that could give access to passing visitors; ${affinityText}.`);
    if (traffic.length) reasons.push(`Qloo describes it as: ${traffic.join(", ")}. This is a description, not a visitor count.`);
    risks.push("Potential high-visibility location, not verified footfall. Visit at the hours you would sell.");
    risks.push("Malls and food courts often have their own rules and fees for temporary counters.");
    suggestedModel = profile.models.includes("counter") ? "counter" : profile.models[0] ?? "counter";
  }
  if (lead.rating !== undefined && lead.rating < 3.8) risks.push(`Modest rating (${lead.rating.toFixed(1)}), which may reflect on your product.`);
  if (lead.partnerType !== "host" && looksLikeChainBranch(lead.name)) {
    risks.push("Looks like a branch of a chain; such decisions are usually made centrally, so outside products are less likely to be accepted.");
    fitScore -= CHAIN_PENALTY;
  }

  const verifySteps = [
    "Visit at the times you would sell and watch who comes in.",
    `Ask whether ${lead.name} accepts outside products or pop-ups, and on what terms.`,
    ...(lead.address ? [`Confirm the location: Qloo lists "${lead.address}".`] : ["Confirm the exact location; Qloo did not return an address."]),
    ...profile.extraChecks,
  ];

  return {
    ...lead,
    fitScore: round1(fitScore),
    audienceScore: round1(audienceScore),
    secondaryScore: round1(secondaryScore),
    secondaryLabel,
    reputationScore,
    productMatches: matches,
    reasons: [...reasons, `Suggested format: ${COLLAB_MODEL_INFO[suggestedModel].label.toLowerCase()} for your ${productLabel}.`],
    risks,
    suggestedModel,
    verifySteps,
  };
}

// ---------------------------------------------------------------------------
// Collaboration options
// ---------------------------------------------------------------------------

/** Formats that make sense for each partner type, before the idea's own list is applied. */
const MODELS_BY_TYPE: Record<PartnerType, CollabModelId[]> = {
  similar: ["consignment", "wholesale"],
  complementary: ["consignment", "wholesale", "workshop", "counter"],
  host: ["counter", "workshop"],
};

export const DEFAULT_ASSUMPTIONS = {
  commissionPct: 25,
  wholesaleDiscountPct: 40,
  workshopVenueSharePct: 30,
  counterFeeShareOfStall: 0.6,
};

export interface OptionContext {
  concept: Concept;
  profile: CollabProfile;
  locality: LocalityProfile | undefined;
  weekends: number;
  budgetInr: number;
  unitPriceInr: number;
}

export function collabInputsFor(model: CollabModelId, partner: PartnerCandidate, ctx: OptionContext): CollabInputs {
  const { concept, profile } = ctx;
  const audienceFactor = 0.7 + 0.6 * (partner.audienceScore / 100);
  const stallFee = ctx.locality?.market.stallFeePerDayInr ?? 850;
  const assumptions: CollabAssumptions = {
    commissionPct: DEFAULT_ASSUMPTIONS.commissionPct,
    wholesaleDiscountPct: DEFAULT_ASSUMPTIONS.wholesaleDiscountPct,
    workshopVenueSharePct: DEFAULT_ASSUMPTIONS.workshopVenueSharePct,
    counterFeePerDayInr: Math.round((stallFee * DEFAULT_ASSUMPTIONS.counterFeeShareOfStall) / 50) * 50,
    unitsPerDay: round1((model === "consignment" ? profile.consignmentUnitsPerDay : concept.baseUnitsPerDay * 0.7) * audienceFactor),
    wholesaleUnitsPerWeek: profile.wholesaleUnitsPerWeek,
    unitPriceInr: ctx.unitPriceInr,
    seatsPerSession: profile.workshop?.seatsPerSession ?? 8,
  };
  const setupTotal = concept.setupItems.reduce((s, item) => s + item.amountInr, 0);
  return {
    model,
    weekends: ctx.weekends,
    budgetInr: ctx.budgetInr,
    unitCostInr: concept.unitCostInr,
    packagingPerUnitInr: profile.packagingPerUnitInr,
    stockMultiplier: Math.min(concept.stockMultiplier, 1.5),
    counterSetupInr: Math.round(setupTotal * 0.6),
    shelfSetupInr: 400,
    logisticsPerTripInr: concept.perDayItems[0]?.amountInr ?? 300,
    licenceInr: concept.licenceInr,
    ...(profile.workshop ? { workshop: { priceInr: profile.workshop.priceInr, costPerSeatInr: profile.workshop.costPerSeatInr } } : {}),
    assumptions,
  };
}

const breakevenScoreOf = (breakeven: number | undefined, units: number) =>
  breakeven === undefined || units <= 0 ? 0 : round1(clamp(((1.6 - breakeven / units) / 1.0) * 100));

export function buildCollabOptions(partners: PartnerCandidate[], ctx: OptionContext, maxPartners = 8): CollabOption[] {
  const options: CollabOption[] = [];
  for (const partner of partners.slice(0, maxPartners)) {
    const models = MODELS_BY_TYPE[partner.partnerType].filter((m) => ctx.profile.models.includes(m) && (m !== "workshop" || ctx.profile.workshop));
    const ordered = uniq([partner.suggestedModel, ...models].filter((m) => models.includes(m))).slice(0, 2);
    for (const model of ordered) {
      const inputs = collabInputsFor(model, partner, ctx);
      const r = computeCollab(inputs);
      if (r.units <= 0) continue;
      const ratio = r.upfrontInr / ctx.budgetInr;
      const reasons: string[] = [];
      let verdict: CollabOption["verdict"] = "accepted";
      if (r.breakevenUnits === undefined) {
        verdict = "rejected";
        reasons.push("Each sale would lose money at these terms (price after the partner's share is below cost per unit).");
      } else if (ratio > REJECT_RATIO) {
        verdict = "rejected";
        reasons.push(`Needs about ₹${r.upfrontInr.toLocaleString("en-IN")}, which is ${r.budgetUsedPct}% of the budget.`);
      } else if (ratio > DOWNGRADE_RATIO) {
        verdict = "downgraded";
        reasons.push(`Slightly over budget: about ₹${r.upfrontInr.toLocaleString("en-IN")} (${r.budgetUsedPct}%).`);
      } else {
        reasons.push(`Fits the budget: about ₹${r.upfrontInr.toLocaleString("en-IN")} upfront (${r.budgetUsedPct}%).`);
      }
      if (verdict !== "rejected" && r.breakevenUnits !== undefined && r.breakevenUnits > r.units) {
        verdict = "downgraded";
        const licence = inputs.licenceInr > 0 ? ` (costs include a one-time ₹${inputs.licenceInr.toLocaleString("en-IN")} registration you keep afterwards)` : "";
        reasons.push(`Does not break even within the pilot: needs ${r.breakevenUnits} sales against about ${r.units} expected${licence}.`);
      }
      const finance = 0.5 * budgetScore(ratio) + 0.5 * breakevenScoreOf(r.breakevenUnits, r.units);
      const practicality = COLLAB_MODEL_INFO[model].simplicity - (partner.partnerType === "similar" ? 20 : 0);
      const weighted = 0.45 * partner.fitScore + 0.35 * finance + 0.2 * practicality;
      const penalty = verdict === "rejected" ? REJECT_PENALTY : verdict === "downgraded" ? DOWNGRADE_PENALTY : 1;
      options.push({
        id: `${partner.id}:${model}`,
        partnerId: partner.id,
        partnerName: partner.name,
        partnerType: partner.partnerType,
        model,
        label: r.label,
        inputs,
        units: r.units,
        costs: r.costs,
        upfrontInr: r.upfrontInr,
        grossRevenueInr: r.grossRevenueInr,
        partnerShareInr: r.partnerShareInr,
        netRevenueInr: r.netRevenueInr,
        profitInr: r.profitInr,
        ...(r.breakevenUnits !== undefined ? { breakevenUnits: r.breakevenUnits } : {}),
        budgetUsedPct: r.budgetUsedPct,
        verdict,
        reasons,
        requirements: COLLAB_MODEL_INFO[model].requirements,
        risks: [...COLLAB_MODEL_INFO[model].risks, ...partner.risks.slice(0, 1)],
        score: round1(weighted * penalty),
      });
    }
  }
  return options.sort((a, b) => Number(a.verdict === "rejected") - Number(b.verdict === "rejected") || b.score - a.score || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Solo vs partnership
// ---------------------------------------------------------------------------

const level = (n: number, lo: number, hi: number): "Low" | "Medium" | "High" => (n < lo ? "Low" : n < hi ? "Medium" : "High");
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function compareStrategies(args: {
  solo: ScoredOption | undefined;
  soloConcept: Concept | undefined;
  partner: CollabOption | undefined;
  partnerCandidate: PartnerCandidate | undefined;
  budgetInr: number;
  risk: RiskPreference;
}): StrategyComparison {
  const { solo, soloConcept, partner, partnerCandidate, budgetInr } = args;
  const soloRisk = solo ? 1 - solo.scores.riskAdjustment / 100 : 1;
  const soloSide: StrategyComparison["solo"] = solo
    ? {
        title: `${solo.conceptLabel} in ${solo.locality}, on your own`,
        available: solo.verdict !== "rejected",
        score: solo.scores.final,
        upfrontInr: solo.totalCostInr,
        operatingNote: `Running costs about ${inr(solo.runningCostInr)} over the pilot, including the stall fee.`,
        financialRisk: level(soloRisk, 0.35, 0.6),
        setupComplexity: level(soloConcept?.complexity ?? 0.5, 0.35, 0.65),
        permissions: ["Written permission from the market organiser or venue", ...((soloConcept?.licenceInr ?? 0) > 0 ? ["Your own food-safety registration"] : [])],
        audienceRelevance: `Cultural fit ${solo.scores.culturalFit}/100 for this locality's audience.`,
        thirdPartyDependence: "Low",
        timeToLaunch: "About 1 to 2 weeks: book a stall and prepare stock.",
        advantages: ["You keep all the revenue", "Full control of display, price and timing", "Direct contact with every customer"],
        disadvantages: ["Stall fee is paid even on a slow day", "You must attract every customer yourself", "More time and equipment needed"],
        budgetFit: `${solo.budgetUsedPct}% of the ${inr(budgetInr)} budget.`,
      }
    : {
        title: "On your own",
        available: false,
        score: 0,
        upfrontInr: 0,
        operatingNote: "No solo option fits the inputs.",
        financialRisk: "High",
        setupComplexity: "High",
        permissions: [],
        audienceRelevance: "Not available.",
        thirdPartyDependence: "Low",
        timeToLaunch: "n/a",
        advantages: [],
        disadvantages: ["No solo option fits the budget"],
        budgetFit: "Over budget.",
      };

  const partnerRisk = partner ? (partner.breakevenUnits !== undefined ? Math.min(1, partner.breakevenUnits / Math.max(1, partner.units)) : 1) : 1;
  const partnerSide: StrategyComparison["partner"] = partner
    ? {
        title: `${partner.label} with ${partner.partnerName}`,
        available: partner.verdict !== "rejected",
        score: partner.score,
        upfrontInr: partner.upfrontInr,
        operatingNote:
          partner.model === "consignment" || partner.model === "workshop"
            ? `The partner keeps about ${inr(partner.partnerShareInr)} (example terms) from about ${inr(partner.grossRevenueInr)} of sales.`
            : partner.model === "counter"
              ? `Includes about ${inr(partner.partnerShareInr)} in counter fees (example terms).`
              : `You sell at a wholesale discount (example terms), receiving about ${inr(partner.netRevenueInr)}.`,
        financialRisk: level(partnerRisk * 0.8, 0.35, 0.6),
        setupComplexity: level(1 - COLLAB_MODEL_INFO[partner.model].simplicity / 100, 0.3, 0.45),
        permissions: ["The partner's written agreement on terms", ...((soloConcept?.licenceInr ?? 0) > 0 || partner.inputs.licenceInr > 0 ? ["Your own food-safety registration (a partner's licence does not cover you)"] : [])],
        audienceRelevance: partnerCandidate ? `Partner fit ${partnerCandidate.fitScore}/100; ${partnerCandidate.reasons[0] ?? ""}` : "Not available.",
        thirdPartyDependence: partner.model === "counter" ? "Medium" : "High",
        timeToLaunch: "About 1 to 3 weeks, depending on how quickly the partner replies.",
        advantages: ["No stall to rent", "Uses a crowd that already visits the partner", "Lower upfront cost and less equipment"],
        disadvantages: ["The partner's share reduces your margin", "Depends on the partner agreeing and on their staff", "Less control over display and customer contact"],
        budgetFit: `${partner.budgetUsedPct}% of the ${inr(budgetInr)} budget.`,
      }
    : {
        title: "With an existing business",
        available: false,
        score: 0,
        upfrontInr: 0,
        operatingNote: "No suitable partner was found.",
        financialRisk: "High",
        setupComplexity: "Medium",
        permissions: [],
        audienceRelevance: "Not available.",
        thirdPartyDependence: "High",
        timeToLaunch: "n/a",
        advantages: [],
        disadvantages: ["No suitable or affordable partner was found"],
        budgetFit: "n/a",
      };

  const reasons: string[] = [];
  let recommended: StrategyComparison["recommended"] = "none";
  if (soloSide.available && partnerSide.available) {
    const gap = round1(partnerSide.score - soloSide.score);
    if (Math.abs(gap) < 3) {
      recommended = partnerSide.upfrontInr <= soloSide.upfrontInr ? "partner" : "solo";
      reasons.push(`The two scores are within 3 points (${soloSide.score} vs ${partnerSide.score}), so the cheaper start wins.`);
    } else {
      recommended = gap > 0 ? "partner" : "solo";
      reasons.push(`${recommended === "partner" ? "Partnership" : "Going solo"} scores higher: ${recommended === "partner" ? partnerSide.score : soloSide.score} vs ${recommended === "partner" ? soloSide.score : partnerSide.score}.`);
    }
    reasons.push(`Upfront: ${inr(soloSide.upfrontInr)} on your own vs ${inr(partnerSide.upfrontInr)} with a partner.`);
    if (recommended === "solo") reasons.push("A solo pop-up keeps the full margin and does not depend on anyone else agreeing.");
    else reasons.push("A partner removes the stall fee and gives access to an existing crowd, at the cost of a share of sales and some control.");
  } else if (soloSide.available) {
    recommended = "solo";
    reasons.push(partner ? "No partnership option fits the budget or breaks even." : "No suitable partner was found, so going solo is the option that works.");
  } else if (partnerSide.available) {
    recommended = "partner";
    reasons.push("No solo option fits the budget, but a partnership does.");
  } else {
    reasons.push("Neither approach fits the budget with the current assumptions.");
  }
  return { solo: soloSide, partner: partnerSide, recommended, reasons };
}
