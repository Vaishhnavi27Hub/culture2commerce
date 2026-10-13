import { pilotPlanSchema, type LocalityProfile, type PilotPlan, type ScoredOption } from "@/lib/schemas";
import { DAYS_PER_WEEKEND } from "./feasibility-critic";
import { inr, type Agent } from "./types";

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
