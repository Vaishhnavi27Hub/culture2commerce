import type { Baseline, Narrative, PilotPlan, ScoredOption } from "@/lib/schemas";
import type { Concept } from "../data/concepts";

/**
 * Deterministic text. Used whenever no LLM is configured, and as the fallback when an
 * LLM call fails or returns something invalid. The app must look complete with only this.
 */

/** The facts a narrative may talk about. Contains no personal data. */
export interface NarrativeFacts {
  city: string;
  conceptLabel: string;
  locality: string;
  targetAudience: string;
  finalScore: number;
  culturalFit: number;
  feasibility: number;
  riskAdjustment: number;
  confidenceLevel: string;
  meanAffinity?: number;
  topSignals: string[];
  runnerUp?: { conceptLabel: string; locality: string; finalScore: number };
  rejected: { conceptLabel: string; reason: string }[];
  totalCostInr: number;
  budgetInr: number;
  weekends: number;
  continueRule: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function buildNarrativeFacts(args: {
  city: string;
  winner: ScoredOption;
  options: ScoredOption[];
  plan?: PilotPlan;
  budgetInr: number;
  weekends: number;
}): NarrativeFacts {
  const { winner, options, plan } = args;
  const runnerUp = options.find((o) => o.id !== winner.id && o.verdict !== "rejected");
  const affinities = winner.evidence.filter((e) => e.kind === "concept_affinity" && e.value !== undefined);
  const meanAffinity = affinities.length ? affinities.reduce((s, e) => s + (e.value as number), 0) / affinities.length : undefined;
  const topSignals = winner.evidence
    .filter((e) => ["concept_affinity", "taste_tag", "brand"].includes(e.kind) && !e.detail?.includes("shown for context"))
    .slice(0, 4)
    .map((e) => (e.value !== undefined ? `${e.label} (${e.value.toFixed(2)})` : e.label));
  const seen = new Set<string>();
  const rejected = options
    .filter((o) => o.verdict !== "accepted" && !seen.has(o.conceptId) && seen.add(o.conceptId))
    .slice(0, 3)
    .map((o) => ({ conceptLabel: o.conceptLabel, reason: o.verdictReasons[0] ?? "Did not fit the budget." }));
  return {
    city: args.city,
    conceptLabel: winner.conceptLabel,
    locality: winner.locality,
    targetAudience: winner.targetAudience,
    finalScore: winner.scores.final,
    culturalFit: winner.scores.culturalFit,
    feasibility: winner.scores.feasibility,
    riskAdjustment: winner.scores.riskAdjustment,
    confidenceLevel: winner.confidence.level,
    ...(meanAffinity !== undefined ? { meanAffinity: Math.round(meanAffinity * 100) / 100 } : {}),
    topSignals,
    ...(runnerUp ? { runnerUp: { conceptLabel: runnerUp.conceptLabel, locality: runnerUp.locality, finalScore: runnerUp.scores.final } } : {}),
    rejected,
    totalCostInr: winner.totalCostInr,
    budgetInr: args.budgetInr,
    weekends: args.weekends,
    continueRule: plan?.rule.continueIf ?? "",
  };
}

export function templateNarrative(f: NarrativeFacts): Narrative {
  const signals = f.topSignals.length ? ` Signals behind it: ${f.topSignals.join(", ")}.` : "";
  const runnerUp = f.runnerUp
    ? ` It leads ${f.runnerUp.conceptLabel.toLowerCase()} in ${f.runnerUp.locality} by ${(f.finalScore - f.runnerUp.finalScore).toFixed(1)} points.`
    : "";
  const rejected = f.rejected.length ? ` Ruled out or marked down: ${f.rejected.map((r) => `${r.conceptLabel.toLowerCase()} (${r.reason})`).join("; ")}` : "";
  return {
    headline: `Test ${/^[aeiou]/i.test(f.conceptLabel) ? "an" : "a"} ${f.conceptLabel.toLowerCase()} in ${f.locality}`,
    whyThis:
      `${f.targetAudience} are the best match for this concept.` +
      ` It scores ${f.finalScore} out of 100 (cultural fit ${f.culturalFit}, feasibility ${f.feasibility}, risk ${f.riskAdjustment}).` +
      signals +
      runnerUp +
      rejected,
    pilotPitch:
      `Run it for ${f.weekends} ${f.weekends === 1 ? "weekend" : "weekends"} on about ${inr(f.totalCostInr)} of your ${inr(f.budgetInr)} budget.` +
      (f.continueRule ? ` ${f.continueRule}` : ""),
    source: "template",
  };
}

/** The "Without Qloo" side: what a generic assistant can say with no cultural or local data. */
export function buildBaseline(concepts: Concept[], city: string): Baseline {
  return {
    summary:
      `Without cultural or local data, every option has reasonable pros and cons, and the usual advice is ` +
      `"it depends on your audience and location in ${city}". There is no evidence to pick one concept, one locality or one audience.`,
    options: concepts.map((c) => ({ conceptId: c.id, conceptLabel: c.label, pros: c.genericPros, cons: c.genericCons })),
    source: "template",
  };
}
