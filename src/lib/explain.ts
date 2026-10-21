import type { RunResult, ScoredOption } from "./schemas";

/**
 * Plain-language explanations derived only from scores already in the run result.
 * Nothing here adds new numbers; it says which existing numbers made the difference.
 */

const METRICS = [
  { key: "culturalFit", label: "cultural fit", lead: "strongest cultural fit", get: (o: ScoredOption) => o.scores.culturalFit },
  { key: "budget", label: "budget fit", lead: "best budget fit", get: (o: ScoredOption) => o.feasibilityBreakdown.budgetScore },
  { key: "competition", label: "room versus competitors", lead: "fewest competitors nearby", get: (o: ScoredOption) => o.feasibilityBreakdown.competitionScore },
  { key: "risk", label: "risk", lead: "lowest risk", get: (o: ScoredOption) => o.scores.riskAdjustment },
] as const;

/** Short phrases explaining why the winner was picked, e.g. ["Ranked 1 of 9 options", "strongest cultural fit"]. */
export function winnerReasons(result: RunResult, winner: ScoredOption): string[] {
  const others = result.options.filter((o) => o.id !== winner.id && o.verdict !== "rejected");
  const out = [`Ranked 1 of ${result.options.length} options`];
  const leads = METRICS.filter((m) => others.length > 0 && others.every((o) => m.get(winner) >= m.get(o)));
  if (leads.length > 0) out.push(leads[0]!.lead);
  out.push(winner.budgetUsedPct <= 100 ? `uses ${winner.budgetUsedPct}% of your budget` : `needs ${winner.budgetUsedPct}% of your budget`);
  return out;
}

/** Compares the leading locality with the runner-up for one idea, metric by metric. */
export function localityLead(options: ScoredOption[]): { leader: ScoredOption; runnerUp?: ScoredOption; margin: number; diffs: { label: string; delta: number }[] } | undefined {
  const ranked = [...options].filter((o) => o.verdict !== "rejected").sort((a, b) => b.scores.final - a.scores.final);
  const leader = ranked[0];
  if (!leader) return undefined;
  const runnerUp = ranked[1];
  if (!runnerUp) return { leader, margin: 0, diffs: [] };
  const diffs = METRICS.map((m) => ({ label: m.label, delta: Math.round((m.get(leader) - m.get(runnerUp)) * 10) / 10 }))
    .filter((d) => Math.abs(d.delta) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { leader, runnerUp, margin: Math.round((leader.scores.final - runnerUp.scores.final) * 10) / 10, diffs };
}

/** Budget split used by the feasibility and pilot budget charts. Reusable equipment = total minus running costs. */
export function budgetSplit(totalInr: number, runningInr: number, budgetInr: number) {
  const equipment = Math.max(0, totalInr - runningInr);
  return { equipment, running: runningInr, buffer: Math.max(0, budgetInr - totalInr), over: Math.max(0, totalInr - budgetInr), scale: Math.max(budgetInr, totalInr) };
}

export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
