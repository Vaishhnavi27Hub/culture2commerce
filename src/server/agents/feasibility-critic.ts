import {
  feasibilityOutputSchema,
  type CostLine,
  type CulturalOutput,
  type Evidence,
  type FeasibilityOutput,
  type LocalityProfile,
  type LocalResearchOutput,
  type Opportunity,
  type ScoredOption,
  type PartnerStrategy,
  type Pricing,
  type StrategyComparison,
} from "@/lib/schemas";
import { pricePositioning } from "@/lib/pricing";
import { getCollabProfile } from "../data/collab-profiles";
import type { Concept } from "../data/concepts";
import { buildCollabOptions, compareStrategies } from "../partners";
import {
  clamp,
  computeConfidence,
  DOWNGRADE_RATIO,
  feasibility,
  finalScore,
  REJECT_RATIO,
  riskAdjustment,
  round1,
  weightsFor,
} from "../scoring";
import { inr, matchesAny, type Agent } from "./types";

/**
 * Agent 3: Feasibility Critic.
 *
 * Costs every concept-and-locality option against the user's budget and duration, then
 * scores feasibility and risk. Options that do not fit are downgraded or rejected with a
 * stated reason. Makes no Qloo calls: it judges what the first two agents found.
 */

export interface FeasibilityInput {
  local: LocalResearchOutput;
  cultural: CulturalOutput;
}

export const CONTINGENCY_RATE = 0.08;
export const REFERENCE_FOOTFALL = 800;
export const DAYS_PER_WEEKEND = 2;
/** Expected sales multiplier at cultural fit 0 and 100. */
export const FIT_DEMAND_MIN = 0.65;
export const FIT_DEMAND_MAX = 1.35;

export interface CostModel {
  costs: CostLine[];
  totalCostInr: number;
  runningCostInr: number;
  unrecoverableInr: number;
  plannedUnits: number;
  stockUnits: number;
  projectedRevenueInr: number;
  /** The two biggest cost lines, largest first. */
  largest: CostLine[];
}

/** Builds the estimated budget for running one concept in one locality. */
export function buildCostModel(concept: Concept, profile: LocalityProfile, culturalFitScore: number, weekends: number): CostModel {
  const days = weekends * DAYS_PER_WEEKEND;
  const footfallFactor = clamp(profile.market.weekendFootfallPerDay / REFERENCE_FOOTFALL, 0.6, 1.3);
  // Cultural fit shifts expected sales by up to 35% either way (an assumption, shown in the UI).
  const fitFactor = FIT_DEMAND_MIN + (FIT_DEMAND_MAX - FIT_DEMAND_MIN) * (culturalFitScore / 100);
  const plannedUnits = Math.max(1, Math.round(concept.baseUnitsPerDay * footfallFactor * fitFactor * days));
  const stockUnits = Math.ceil(plannedUnits * concept.stockMultiplier);

  const line = (item: string, amountInr: number, note?: string): CostLine => ({
    item,
    amountInr: Math.round(amountInr),
    ...(note ? { note } : {}),
    source: "estimate",
  });

  const venue = profile.market.stallFeePerDayInr * concept.venueFeeMultiplier * days;
  const costs: CostLine[] = [line(`Venue or stall fee (${days} days)`, venue, `${inr(venue / days)} per day in ${profile.name}`)];
  let reusable = 0;
  let nonReusableSetup = 0;
  for (const s of concept.setupItems) {
    costs.push(line(s.item, s.amountInr, s.reusable ? "Reusable after the pilot" : undefined));
    if (s.reusable) reusable += s.amountInr;
    else nonReusableSetup += s.amountInr;
  }
  const stock = stockUnits * concept.unitCostInr;
  costs.push(line(`Stock: ${stockUnits} ${concept.unitLabelPlural}`, stock, `${inr(concept.unitCostInr)} each`));
  let perDay = 0;
  for (const p of concept.perDayItems) {
    costs.push(line(`${p.item} (${days} days)`, p.amountInr * days, `${inr(p.amountInr)} per day`));
    perDay += p.amountInr * days;
  }
  if (concept.licenceInr > 0) costs.push(line("Licence or registration", concept.licenceInr, concept.licenceNote));

  const subtotal = costs.reduce((sum, c) => sum + c.amountInr, 0);
  const contingency = Math.round(subtotal * CONTINGENCY_RATE);
  costs.push(line("Contingency (8%)", contingency));

  const totalCostInr = subtotal + contingency;
  const unrecoverableInr = Math.round(
    venue + perDay + concept.licenceInr + nonReusableSetup + contingency + stock * concept.perishableShare,
  );
  const largest = [...costs].sort((a, b) => b.amountInr - a.amountInr).slice(0, 2);
  return {
    costs,
    totalCostInr,
    runningCostInr: totalCostInr - reusable,
    unrecoverableInr,
    plannedUnits,
    stockUnits,
    projectedRevenueInr: plannedUnits * concept.unitPriceInr,
    largest,
  };
}

export function skillMatch(interests: string[], concept: Concept): number {
  const hits = interests.filter((i) => matchesAny(i, concept.skillKeywords)).length;
  return hits >= 2 ? 1 : hits === 1 ? 0.5 : 0;
}

type Draft = Omit<ScoredOption, "rank" | "confidence"> & { opportunity: Opportunity; profile: LocalityProfile };

export const feasibilityCritic: Agent<FeasibilityInput, FeasibilityOutput> = async (input, ctx) => {
  const warnings: string[] = [];
  const weights = weightsFor(ctx.input.riskPreference);
  const budget = ctx.input.budgetInr;
  const drafts: Draft[] = [];

  for (const opportunity of input.cultural.opportunities) {
    const concept = ctx.concepts.find((c) => c.id === opportunity.conceptId);
    const profile = input.local.localities.find((l) => l.name === opportunity.locality);
    if (!concept || !profile) {
      warnings.push(`Skipped ${opportunity.conceptId} in ${opportunity.locality}: missing data.`);
      continue;
    }

    const model = buildCostModel(concept, profile, opportunity.culturalFit, ctx.input.weekends);
    const ratio = model.totalCostInr / budget;
    const competitors = profile.competitors.find((c) => c.conceptId === concept.id);
    const competitorCount = competitors?.count ?? 0;

    const feas = feasibility({
      costToBudgetRatio: ratio,
      competitorCount,
      complexity: concept.complexity,
      permitComplexity: concept.permitComplexity,
    });
    const risk = riskAdjustment({
      unrecoverableShare: model.unrecoverableInr / model.totalCostInr,
      breakevenShare: model.runningCostInr / Math.max(1, model.projectedRevenueInr),
      skillMatch: skillMatch(ctx.input.interests, concept),
    });

    const verdictReasons: string[] = [];
    let verdict: ScoredOption["verdict"] = "accepted";
    const pct = Math.round(ratio * 100);
    if (ratio > REJECT_RATIO) {
      verdict = "rejected";
      verdictReasons.push(
        `Needs about ${inr(model.totalCostInr)}, which is ${pct}% of the ${inr(budget)} budget.`,
        `Largest costs: ${model.largest.map((c) => `${c.item.toLowerCase()} (${inr(c.amountInr)})`).join(" and ")}.`,
      );
    } else if (ratio > DOWNGRADE_RATIO) {
      verdict = "downgraded";
      verdictReasons.push(
        `Needs about ${inr(model.totalCostInr)}, slightly over the ${inr(budget)} budget (${pct}%).`,
        `Largest costs: ${model.largest.map((c) => `${c.item.toLowerCase()} (${inr(c.amountInr)})`).join(" and ")}.`,
      );
    } else {
      verdictReasons.push(`Fits the budget: about ${inr(model.totalCostInr)} of ${inr(budget)} (${pct}%).`);
    }
    if (model.runningCostInr > model.projectedRevenueInr) {
      verdictReasons.push(
        `Projected sales (${inr(model.projectedRevenueInr)}) would not cover running costs (${inr(model.runningCostInr)}).`,
      );
    }
    if (competitorCount >= 9) {
      verdictReasons.push(`Crowded: ${competitorCount}${competitors?.capped ? "+" : ""} similar places within 2 km.`);
    }

    const scores = {
      culturalFit: opportunity.culturalFit,
      feasibility: feas.feasibility,
      riskAdjustment: risk.riskAdjustment,
    };
    const final = finalScore(scores, weights, verdict);

    const evidence: Evidence[] = [...opportunity.evidence];
    if (competitors) {
      evidence.push({
        kind: "competitor",
        label: `${competitors.count}${competitors.capped ? "+" : ""} similar places within ${competitors.radiusM / 1000} km`,
        detail: competitors.top.length
          ? `For example: ${competitors.top.map((t) => t.name).join(", ")}`
          : "None found: either an open gap or missing data",
        value: competitors.count,
        source: competitors.source,
      });
    }
    evidence.push({
      kind: "cost",
      label: `Stall fee about ${inr(profile.market.stallFeePerDayInr)} per day`,
      detail: profile.market.localitySpecific ? `Illustrative estimate for ${profile.name}` : "Generic illustrative estimate",
      value: profile.market.stallFeePerDayInr,
      source: "estimate",
    });

    drafts.push({
      id: `${concept.id}@${profile.name}`,
      conceptId: concept.id,
      conceptLabel: concept.label,
      locality: profile.name,
      verdict,
      verdictReasons,
      scores: { ...scores, ...final },
      culturalBreakdown: opportunity.breakdown,
      feasibilityBreakdown: {
        budgetScore: feas.budgetScore,
        competitionScore: feas.competitionScore,
        logisticsScore: feas.logisticsScore,
        permitScore: feas.permitScore,
      },
      riskBreakdown: {
        recoverabilityScore: risk.recoverabilityScore,
        breakevenScore: risk.breakevenScore,
        skillScore: risk.skillScore,
      },
      costs: model.costs,
      totalCostInr: model.totalCostInr,
      runningCostInr: model.runningCostInr,
      stockUnits: model.stockUnits,
      budgetUsedPct: pct,
      plannedUnits: model.plannedUnits,
      unitPriceInr: concept.unitPriceInr,
      unitLabel: concept.unitLabel,
      projectedRevenueInr: model.projectedRevenueInr,
      competitorCount,
      targetAudience: opportunity.targetAudience,
      hypothesis: opportunity.hypothesis,
      evidence,
      opportunity,
      profile,
    });
  }

  if (drafts.length === 0) throw new Error("No options could be evaluated.");

  // Rejected options always rank below the rest; ties break alphabetically so order is stable.
  drafts.sort(
    (a, b) =>
      Number(a.verdict === "rejected") - Number(b.verdict === "rejected") ||
      b.scores.final - a.scores.final ||
      a.id.localeCompare(b.id),
  );

  const options: ScoredOption[] = drafts.map((draft, i) => {
    const { opportunity, profile, ...option } = draft;
    const next = drafts[i + 1];
    const competitors = profile.competitors.find((c) => c.conceptId === option.conceptId);
    const confidence = computeConfidence({
      qlooSources: [...opportunity.qlooSources, ...(competitors ? [competitors.source as "live" | "recorded" | "sample"] : [])],
      culturalDegraded: input.cultural.degraded || opportunity.breakdown.meanAffinity === undefined,
      localityLevel: profile.level,
      affinityPlaces: opportunity.breakdown.affinityPlaces,
      hasTasteOrBrandMatch: opportunity.evidence.some(
        (e) => e.kind === "taste_tag" || (e.kind === "brand" && !e.detail?.includes("shown for context")),
      ),
      competitorDataFound: option.competitorCount > 0,
      marginToNext: next ? round1(option.scores.final - next.scores.final) : undefined,
      marketLocalitySpecific: profile.market.localitySpecific,
    });
    return { ...option, rank: i + 1, confidence };
  });

  const winner = options.find((o) => o.verdict !== "rejected");
  if (!winner) warnings.push("Every option exceeds the budget. Consider a larger budget, fewer weekends or a simpler concept.");
  const rejected = options.filter((o) => o.verdict === "rejected").length;
  const downgraded = options.filter((o) => o.verdict === "downgraded").length;
  ctx.note(`${options.length} options costed: ${rejected} rejected, ${downgraded} downgraded`);

  // ---------------------------------------------------------------- price positioning
  const mode = ctx.input.launchMode;
  const partnerConcept = input.local.partnerConceptId ? ctx.concepts.find((c) => c.id === input.local.partnerConceptId) : undefined;
  const pricingConcept = mode === "partner" && partnerConcept ? partnerConcept : (ctx.concepts.find((c) => c.id === winner?.conceptId) ?? partnerConcept);
  const collabProfile = partnerConcept ? getCollabProfile(partnerConcept.id) : undefined;
  let pricing: Pricing | undefined;
  if (pricingConcept) {
    const topPartner = input.cultural.partners[0];
    const pricingLocality =
      mode === "partner" && topPartner ? topPartner.locality : (winner?.locality ?? input.local.localities[0]?.name ?? ctx.input.city);
    const profile = input.local.localities.find((l) => l.name === pricingLocality) ?? input.local.localities[0];
    const levels = [
      ...(profile?.anchors ?? []).map((a) => a.priceLevel),
      ...input.cultural.partners.filter((p) => p.locality === pricingLocality).map((p) => p.priceLevel),
    ].filter((l): l is number => l !== undefined);
    const packaging = getCollabProfile(pricingConcept.id)?.packagingPerUnitInr ?? 0;
    const p = pricePositioning({ unitCostInr: pricingConcept.unitCostInr, packagingPerUnitInr: packaging, referencePriceInr: pricingConcept.unitPriceInr, venuePriceLevels: levels });
    pricing = {
      conceptId: pricingConcept.id,
      locality: pricingLocality,
      tier: p.tier,
      ...(p.medianLevel !== undefined ? { medianLevel: p.medianLevel } : {}),
      venuesUsed: p.venuesUsed,
      floorInr: p.floorInr,
      rangeInr: p.rangeInr,
      suggestedInr: p.suggestedInr,
      unitCostInr: pricingConcept.unitCostInr,
      packagingPerUnitInr: packaging,
      explanation: p.explanation,
      source: levels.length ? (profile?.qlooSource ?? "estimate") : "estimate",
    };
  }

  // ---------------------------------------------------------------- partnership options
  let partnerStrategy: PartnerStrategy | undefined;
  if (mode !== "solo" && partnerConcept && collabProfile) {
    const unitPriceInr = pricing && pricing.conceptId === partnerConcept.id ? pricing.suggestedInr : partnerConcept.unitPriceInr;
    const eligible = input.cultural.partners.filter((p) => p.fitScore >= 35);
    const optionsForPartners = buildCollabOptions(eligible, {
      concept: partnerConcept,
      profile: collabProfile,
      locality: undefined,
      weekends: ctx.input.weekends,
      budgetInr: budget,
      unitPriceInr,
    }).map((o) => {
      // Counter fees depend on the partner's locality; recompute with that locality's stall estimate.
      const partner = eligible.find((p) => p.id === o.partnerId);
      const locality = input.local.localities.find((l) => l.name === partner?.locality);
      if (!partner || !locality || o.model !== "counter") return o;
      return buildCollabOptions([partner], { concept: partnerConcept, profile: collabProfile, locality, weekends: ctx.input.weekends, budgetInr: budget, unitPriceInr }).find((x) => x.id === o.id) ?? o;
    });
    optionsForPartners.sort((a, b) => Number(a.verdict === "rejected") - Number(b.verdict === "rejected") || b.score - a.score || a.id.localeCompare(b.id));
    const best = optionsForPartners.find((o) => o.verdict !== "rejected");
    const status: PartnerStrategy["status"] = input.cultural.partners.length === 0 ? "no_partners" : best ? "ready" : "none_affordable";
    partnerStrategy = {
      status,
      conceptId: partnerConcept.id,
      conceptLabel: partnerConcept.label,
      options: optionsForPartners.slice(0, 12),
      ...(best ? { bestOptionId: best.id } : {}),
      message:
        status === "ready"
          ? `Best partnership: ${best!.label.toLowerCase()} with ${best!.partnerName}, about ${inr(best!.upfrontInr)} upfront.`
          : status === "no_partners"
            ? "No suitable partner businesses were found near these localities."
            : "Partners were found, but no collaboration format fits the budget or breaks even with the current assumptions.",
    };
    ctx.note(partnerStrategy.message);
  }

  // ---------------------------------------------------------------- solo vs partnership
  let comparison: StrategyComparison | undefined;
  if (mode === "both") {
    const bestPartner = partnerStrategy?.options.find((o) => o.id === partnerStrategy?.bestOptionId);
    comparison = compareStrategies({
      solo: winner,
      soloConcept: ctx.concepts.find((c) => c.id === winner?.conceptId),
      partner: bestPartner ?? partnerStrategy?.options[0],
      partnerCandidate: input.cultural.partners.find((p) => p.id === (bestPartner ?? partnerStrategy?.options[0])?.partnerId),
      budgetInr: budget,
      risk: ctx.input.riskPreference,
    });
    ctx.note(`Comparison: ${comparison.recommended === "none" ? "neither approach fits" : `${comparison.recommended === "solo" ? "going solo" : "partnering"} is recommended`}`);
  }

  return feasibilityOutputSchema.parse({
    weights,
    options,
    ...(winner ? { winnerId: winner.id } : {}),
    ...(partnerStrategy ? { partnerStrategy } : {}),
    ...(comparison ? { comparison } : {}),
    ...(pricing ? { pricing } : {}),
    warnings,
  });
};
