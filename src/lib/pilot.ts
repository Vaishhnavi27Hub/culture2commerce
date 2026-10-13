import type { PilotActuals, PilotPlan, PilotVerdict } from "./schemas";

/**
 * Applies a pilot plan's continue / pivot / stop rule to reported results.
 * Pure and deterministic; runs in the browser when the user reports results.
 */
export function evaluatePilot(plan: Pick<PilotPlan, "rule" | "predicted" | "unitLabel">, actual: PilotActuals): PilotVerdict {
  const { rule, predicted } = plan;
  const pct = (a: number, p: number) => (p > 0 ? Math.round((a / p) * 100) : 0);

  const comparison = [
    { metric: "Units sold", predicted: predicted.units, actual: actual.unitsSold, pctOfPredicted: pct(actual.unitsSold, predicted.units) },
    { metric: "Revenue (₹)", predicted: predicted.revenueInr, actual: actual.revenueInr, pctOfPredicted: pct(actual.revenueInr, predicted.revenueInr) },
    { metric: "Footfall", predicted: predicted.footfall, actual: actual.footfall, pctOfPredicted: pct(actual.footfall, predicted.footfall) },
  ];

  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  let decision: PilotVerdict["decision"];
  let reason: string;

  if (actual.unitsSold >= rule.continueUnits || actual.revenueInr >= rule.continueRevenueInr) {
    decision = "continue";
    reason = `You reached the continue target (${rule.continueUnits} units or ${inr(rule.continueRevenueInr)}). The pilot covered its running costs.`;
  } else if (actual.unitsSold >= rule.pivotUnits || actual.revenueInr >= rule.pivotRevenueInr) {
    decision = "pivot";
    const conversion = actual.footfall > 0 ? actual.unitsSold / actual.footfall : undefined;
    const predictedConversion = predicted.footfall > 0 ? predicted.units / predicted.footfall : undefined;
    const hint =
      conversion !== undefined && predictedConversion !== undefined
        ? actual.footfall < predicted.footfall * 0.7
          ? "Footfall was well below the estimate, so try a busier spot or time before changing the product."
          : conversion < predictedConversion * 0.7
            ? "People came but fewer bought than expected, so adjust the product mix or price before changing location."
            : "Results were close; a small change in price, product mix or location may be enough."
        : "Adjust one thing (price, product mix or location) and run one more weekend.";
    reason = `There is real demand, but below the continue target. ${hint}`;
  } else {
    decision = "stop";
    reason = `Results stayed below the pivot threshold (${rule.pivotUnits} units and ${inr(rule.pivotRevenueInr)}). Stop this concept here and test the next-ranked option instead.`;
  }
  return { decision, reason, comparison };
}
