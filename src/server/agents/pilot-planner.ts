import { buildOutreach } from "@/lib/outreach";
import {
  pilotPlanSchema,
  type LocalityProfile,
  type PartnerCandidate,
  type PartnerPlan,
  type PartnerStrategy,
  type PilotPlan,
  type ProductProfile,
  type ScoredOption,
} from "@/lib/schemas";
import { getCollabProfile } from "../data/collab-profiles";
import { DAYS_PER_WEEKEND } from "./feasibility-critic";
import { inr, type Agent, type AgentContext } from "./types";

/**
 * Agent 4: Pilot Planner.
 *
 * Turns the winning option into a small real-world experiment: what to prepare, what to
 * charge, when to do what, what it costs, and a measurable continue / pivot / stop rule.
 * All numbers come from the Feasibility Critic's cost model; nothing is invented here.
 */

export interface PilotPlanInput {
  option: ScoredOption;
  profile: LocalityProfile;
}

const roundUpTo = (n: number, step: number) => Math.ceil(n / step) * step;

export const pilotPlanner: Agent<PilotPlanInput, PilotPlan> = async ({ option, profile }, ctx) => {
  const concept = ctx.concepts.find((c) => c.id === option.conceptId);
  if (!concept) throw new Error(`Unknown concept ${option.conceptId}`);
  const { weekends, budgetInr, city } = ctx.input;
  const days = weekends * DAYS_PER_WEEKEND;
  const plural = concept.unitLabelPlural;
  const weekendWord = weekends === 1 ? "weekend" : "weekends";

  // Quantities: split the stock across the product mix, keeping the total exact.
  const quantities = concept.products.map((p) => ({
    item: p.item,
    quantity: Math.max(1, Math.round(option.stockUnits * p.share)),
    ...(p.note ? { note: p.note } : {}),
  }));
  const drift = option.stockUnits - quantities.reduce((s, q) => s + q.quantity, 0);
  if (quantities[0]) quantities[0].quantity = Math.max(1, quantities[0].quantity + drift);

  const pricePoints = concept.products.map((p) => ({
    item: p.item,
    priceInr: p.priceInr,
    ...(p.note ? { note: p.note } : {}),
  }));

  // Rule: "continue" means the pilot earned back its running costs.
  const continueRevenueInr = roundUpTo(option.runningCostInr, 500);
  const continueUnits = Math.ceil(option.runningCostInr / concept.unitPriceInr);
  const pivotRevenueInr = roundUpTo(option.runningCostInr / 2, 500);
  const pivotUnits = Math.max(1, Math.ceil(continueUnits / 2));
  const rule = {
    continueIf: `At least ${continueUnits} ${plural} sold or at least ${inr(continueRevenueInr)} revenue across ${weekends} ${weekendWord}: continue. Book the next month and widen the range.`,
    pivotIf: `Between ${pivotUnits} and ${continueUnits - 1} ${plural} (or ${inr(pivotRevenueInr)} to ${inr(continueRevenueInr)}): pivot. Keep the concept, change one thing (price, product mix or locality) and rerun one weekend.`,
    stopIf: `Fewer than ${pivotUnits} ${plural} and under ${inr(pivotRevenueInr)}: stop. Sell or keep the reusable items and test the next-ranked option.`,
    continueUnits,
    continueRevenueInr,
    pivotUnits,
    pivotRevenueInr,
  };

  const footfall = profile.market.weekendFootfallPerDay * days;
  const conversionTarget = footfall > 0 ? ((continueUnits / footfall) * 100).toFixed(1) : undefined;
  const successMetrics = [
    { metric: `${concept.unitLabel[0]?.toUpperCase()}${concept.unitLabel.slice(1)} sales`, target: `At least ${continueUnits} ${plural}` },
    { metric: "Revenue", target: `At least ${inr(continueRevenueInr)} (covers running costs)` },
    ...(conversionTarget ? [{ metric: "Conversion", target: `At least ${conversionTarget}% of passers-by buy (estimated ${footfall} people over ${days} days)` }] : []),
    { metric: "Follow-up interest", target: "At least 10 people share a contact or follow your page" },
  ];

  const venueIndex = concept.format === "workshop" ? 2 : concept.format === "event" ? 1 : 0;
  const venueSuggestion = profile.market.venueOptions[venueIndex] ?? profile.market.venueOptions[0];

  const schedule: PilotPlan["schedule"] = [
    {
      when: "Week before",
      tasks: [
        `Confirm a ${venueSuggestion?.type.toLowerCase() ?? "venue"} in ${profile.name} and get permission in writing`,
        `Prepare stock: ${option.stockUnits} ${plural}`,
        "Announce the dates to friends and on one social channel",
      ],
    },
  ];
  for (let w = 1; w <= weekends; w++) {
    schedule.push({
      when: `Weekend ${w}: Saturday`,
      tasks: ["Set up 45 minutes early", "Estimate footfall: count passers-by for 10 minutes each hour and multiply by 6", "Note which items sell first"],
    });
    schedule.push({
      when: `Weekend ${w}: Sunday`,
      tasks: ["Move the best sellers to the front", "Record units sold, revenue and footfall at close"],
    });
    if (w < weekends) {
      const expectedSoFar = Math.ceil((continueUnits * w) / weekends);
      schedule.push({
        when: `After weekend ${w}`,
        tasks: [
          `Check progress: on track means about ${expectedSoFar} ${plural} sold so far`,
          "If behind, change one thing only (price, display or product mix) for the next weekend",
          "Restock best sellers",
        ],
      });
    }
  }
  schedule.push({
    when: "After the final weekend",
    tasks: ["Add up units, revenue and footfall", "Enter them under “Report pilot results” to get the continue, pivot or stop verdict"],
  });

  const checklist = [
    ...concept.checklist,
    "Keep the venue's written permission with you",
    "Carry a notebook for tallying footfall and sales",
  ];

  ctx.note(`Pilot built: ${option.stockUnits} ${plural}, continue at ${continueUnits} sold or ${inr(continueRevenueInr)}`);

  return pilotPlanSchema.parse({
    optionId: option.id,
    title: `${concept.label} in ${profile.name}: ${weekends}-weekend pilot`,
    conceptLabel: concept.label,
    locality: profile.name,
    city,
    targetAudience: option.targetAudience,
    days,
    weekends,
    unitLabel: concept.unitLabel,
    quantities,
    pricePoints,
    schedule,
    checklist,
    budget: option.costs,
    totalCostInr: option.totalCostInr,
    budgetInr,
    bufferInr: budgetInr - option.totalCostInr,
    ...(venueSuggestion ? { venueSuggestion } : {}),
    successMetrics,
    rule,
    predicted: { units: option.plannedUnits, revenueInr: option.projectedRevenueInr, footfall, source: "estimate" },
    // Food-safety notes are only relevant to concepts that need a food licence.
    permitNotes: profile.market.permitNotes.filter((n) => concept.licenceInr > 0 || !/food/i.test(n)),
  } satisfies PilotPlan);
};

// ---------------------------------------------------------------------------
// Partnership pilot
// ---------------------------------------------------------------------------

export interface PartnerPlanInput {
  strategy: PartnerStrategy;
  partners: PartnerCandidate[];
  product?: ProductProfile;
}

/** Turns the best collaboration option into a partner-based experiment, with outreach drafts. */
export function partnerPilotPlanner(input: PartnerPlanInput, ctx: AgentContext): PartnerPlan | undefined {
  const { strategy, partners } = input;
  const best = strategy.options.find((o) => o.id === strategy.bestOptionId);
  const concept = ctx.concepts.find((c) => c.id === strategy.conceptId);
  if (!best || !concept) return undefined;
  const profile = getCollabProfile(concept.id);
  const product = input.product?.source === "user" && input.product.description ? input.product.description : concept.tagline.toLowerCase();
  const plural = concept.unitLabelPlural;
  const weekends = ctx.input.weekends;
  const weekendWord = weekends === 1 ? "weekend" : "weekends";

  // Shortlist: the best viable option per partner, best partner first.
  const seen = new Set<string>();
  const shortlistOptions = strategy.options.filter((o) => o.verdict !== "rejected" && !seen.has(o.partnerId) && seen.add(o.partnerId)).slice(0, 3);
  const shortlist = shortlistOptions.map((o) => {
    const partner = partners.find((p) => p.id === o.partnerId);
    const why =
      o.partnerType === "complementary" && profile
        ? `your customers ${profile.complementaryWhy.replace(/^its customers /, "")}`
        : o.partnerType === "host"
          ? "your venue attracts the kind of visitors who would enjoy this"
          : "your customers already enjoy products like mine";
    const pilotSummary =
      o.model === "workshop"
        ? `${weekends} session${weekends === 1 ? "" : "s"} of about ${o.inputs.assumptions.seatsPerSession} seats`
        : o.model === "wholesale"
          ? `a first order of about ${o.units} ${plural} over ${weekends} ${weekendWord}`
          : `${weekends} ${weekendWord} with about ${Math.max(o.units, 10)} ${plural}`;
    return {
      partnerId: o.partnerId,
      name: o.partnerName,
      partnerType: o.partnerType,
      locality: partner?.locality ?? "",
      model: o.label,
      why: partner?.reasons[0] ?? "",
      outreach: buildOutreach({
        partnerName: o.partnerName,
        ...(partner?.genre ? { partnerGenre: partner.genre } : {}),
        partnerType: o.partnerType,
        product,
        conceptLabel: concept.label,
        modelLabel: o.label,
        whyForPartner: why,
        pilotSummary,
        city: ctx.input.city,
      }),
    };
  });

  const breakeven = best.breakevenUnits ?? best.units;
  const half = Math.max(1, Math.ceil(breakeven / 2));
  const unitWord = best.model === "workshop" ? "seats" : plural;
  const timeline = [
    { when: "Days 1 to 3", tasks: ["Visit the shortlisted places at the hours you would sell", "Note who comes in and what they buy", "Check your own registrations and labels (see compliance)"] },
    { when: "Days 3 to 7", tasks: [`Send the outreach message to ${shortlist[0]?.name ?? "your top partner"} first, then the others`, "Bring samples to any meeting", "Agree terms in writing: share, dates, display, unsold stock"] },
    ...Array.from({ length: weekends }, (_, i) => ({
      when: `Weekend ${i + 1}`,
      tasks: [`Deliver or set up ${best.model === "workshop" ? "the session" : `about ${Math.ceil(best.units / weekends)} ${plural}`}`, "Record units sold and any customer feedback", ...(i === 0 && weekends > 1 ? ["Adjust price or product mix only if sales are clearly off"] : [])],
    })),
    { when: "After the pilot", tasks: ["Settle payments with the partner", "Ask the partner whether they want to continue or reorder", "Enter the results to get a continue, pivot or stop verdict"] },
  ];

  return {
    title: `${best.label} with ${best.partnerName}: ${weekends}-weekend partner pilot`,
    conceptLabel: concept.label,
    product,
    model: best.model,
    modelLabel: best.label,
    shortlist,
    budget: best.costs,
    upfrontInr: best.upfrontInr,
    budgetInr: ctx.input.budgetInr,
    timeline,
    successMetrics: [
      { metric: "Sales through the partner", target: `At least ${breakeven} ${unitWord} (the break-even point at these terms)` },
      { metric: "Sell-through", target: best.model === "wholesale" ? "The partner sells most of the first order within the pilot" : "At least 60% of the stock you supplied" },
      { metric: "Partner interest", target: "The partner wants to continue or reorder within 2 weeks" },
    ],
    rule: {
      continueIf: `At least ${breakeven} ${unitWord} sold and the partner wants to continue: continue, and propose a monthly arrangement.`,
      pivotIf: `Between ${half} and ${breakeven - 1} ${unitWord}, or good sales but an unwilling partner: pivot. Try the next partner on the shortlist or another format.`,
      stopIf: `Fewer than ${half} ${unitWord}: stop this format and test the next-ranked option or a solo pop-up.`,
    },
    validationSteps: [
      "Treat every shortlisted place as a business worth contacting, not a confirmed partner.",
      "Start with the smallest batch the partner will accept.",
      "Keep a written record of stock handed over and money received.",
      "Commission rates, fees and wholesale discounts shown are example assumptions; replace them with the partner's actual terms.",
    ],
    compliance: profile?.extraChecks ?? [],
  };
}
