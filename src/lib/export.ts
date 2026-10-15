import { DISCLAIMER, TEAM_CREDIT } from "./brand";
import { inr } from "./format";
import type { PartnerPlan, PilotPlan, RunResult } from "./schemas";

/** Renders the pilot plan as Markdown for download. */
export function planToMarkdown(plan: PilotPlan, result?: Pick<RunResult, "narrative" | "qlooSource" | "options" | "winnerId" | "pilotResults">): string {
  const winner = result?.options.find((o) => o.id === result.winnerId);
  const lines: string[] = [];
  const push = (...xs: string[]) => lines.push(...xs);

  push(`# ${plan.title}`, "", `**Where:** ${plan.locality}, ${plan.city}  `, `**Who it is for:** ${plan.targetAudience}  `);
  push(`**Duration:** ${plan.weekends} ${plan.weekends === 1 ? "weekend" : "weekends"} (${plan.days} days)  `);
  push(`**Cost:** ${inr(plan.totalCostInr)} of a ${inr(plan.budgetInr)} budget (${inr(plan.bufferInr)} left as buffer)`, "");

  if (result?.narrative) push("## Why this", "", result.narrative.whyThis, "");
  if (winner) {
    push(
      `Score ${winner.scores.final}/100 (cultural fit ${winner.scores.culturalFit}, feasibility ${winner.scores.feasibility}, risk ${winner.scores.riskAdjustment}). Confidence: ${winner.confidence.level}.`,
      "",
    );
  }

  push("## What to prepare", "", "| Item | Quantity | Note |", "|---|---:|---|");
  for (const q of plan.quantities) push(`| ${q.item} | ${q.quantity} | ${q.note ?? ""} |`);
  push("", "## Prices", "", "| Item | Price | Note |", "|---|---:|---|");
  for (const p of plan.pricePoints) push(`| ${p.item} | ${inr(p.priceInr)} | ${p.note ?? ""} |`);

  if (plan.venueSuggestion) {
    push("", "## Venue", "", `${plan.venueSuggestion.type}: ${plan.venueSuggestion.description} About ${inr(plan.venueSuggestion.feePerDayInr)} per day (estimate).`);
  }

  push("", "## Schedule", "");
  for (const s of plan.schedule) {
    push(`**${s.when}**`, "");
    for (const t of s.tasks) push(`- ${t}`);
    push("");
  }

  push("## Setup checklist", "");
  for (const c of plan.checklist) push(`- [ ] ${c}`);

  push("", "## Budget (illustrative estimates)", "", "| Item | Amount | Note |", "|---|---:|---|");
  for (const b of plan.budget) push(`| ${b.item} | ${inr(b.amountInr)} | ${b.note ?? ""} |`);
  push(`| **Total** | **${inr(plan.totalCostInr)}** | Budget ${inr(plan.budgetInr)} |`);

  push("", "## Success metrics", "");
  for (const m of plan.successMetrics) push(`- **${m.metric}:** ${m.target}`);

  push("", "## Decision rule", "", `- **Continue:** ${plan.rule.continueIf}`, `- **Pivot:** ${plan.rule.pivotIf}`, `- **Stop:** ${plan.rule.stopIf}`);

  push("", "## Predicted results (estimates)", "", `- Units: ${plan.predicted.units}`, `- Revenue: ${inr(plan.predicted.revenueInr)}`, `- Footfall: ${plan.predicted.footfall}`);

  if (result?.pilotResults) {
    const r = result.pilotResults;
    push("", "## Reported results", "", "| Metric | Predicted | Actual | % of predicted |", "|---|---:|---:|---:|");
    for (const c of r.verdict.comparison) push(`| ${c.metric} | ${c.predicted} | ${c.actual} | ${c.pctOfPredicted}% |`);
    push("", `**Verdict: ${r.verdict.decision.toUpperCase()}.** ${r.verdict.reason}`);
  }

  push("", "## Permits and permissions", "");
  for (const n of plan.permitNotes) push(`- ${n}`);

  push("", "---", "", `_${DISCLAIMER}_`, "");
  if (result?.qlooSource) {
    const label = result.qlooSource === "live" ? "live Qloo data" : result.qlooSource === "recorded" ? "a recorded Qloo snapshot" : "bundled sample data (not Qloo data)";
    push(`_Cultural signals in this run came from ${label}. Costs and footfall are illustrative estimates._`, "");
  }
  push(`_Made with Culture2Commerce. ${TEAM_CREDIT}._`, "");
  return lines.join("\n");
}

/** Triggers a browser download of a text file. */
export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Renders the partner pilot as Markdown for download. */
export function partnerPlanToMarkdown(plan: PartnerPlan): string {
  const lines: string[] = [`# ${plan.title}`, "", `**Product:** ${plan.product}  `, `**Format:** ${plan.modelLabel}  `, `**Upfront:** ${inr(plan.upfrontInr)} of a ${inr(plan.budgetInr)} budget`, ""];
  lines.push("## Shortlisted partners (worth contacting, not confirmed)", "");
  plan.shortlist.forEach((s, i) => lines.push(`${i + 1}. **${s.name}** (${s.partnerType}, ${s.locality}): ${s.model}. ${s.why}`));
  lines.push("", "## Budget (example assumptions)", "", "| Item | Amount | Note |", "|---|---:|---|");
  for (const b of plan.budget) lines.push(`| ${b.item} | ${inr(b.amountInr)} | ${b.note ?? ""} |`);
  lines.push(`| **Total** | **${inr(plan.upfrontInr)}** | |`, "", "## Timeline", "");
  for (const t of plan.timeline) {
    lines.push(`**${t.when}**`, "");
    for (const task of t.tasks) lines.push(`- ${task}`);
    lines.push("");
  }
  lines.push("## Success metrics", "");
  for (const m of plan.successMetrics) lines.push(`- **${m.metric}:** ${m.target}`);
  lines.push("", "## Decision rule", "", `- **Continue:** ${plan.rule.continueIf}`, `- **Pivot:** ${plan.rule.pivotIf}`, `- **Stop:** ${plan.rule.stopIf}`, "", "## Before you start", "");
  for (const v of [...plan.validationSteps, ...plan.compliance]) lines.push(`- ${v}`);
  const first = plan.shortlist[0];
  if (first) lines.push("", `## Draft message to ${first.name}`, "", "```", `Subject: ${first.outreach.email.subject}`, "", first.outreach.email.body, "```");
  lines.push("", "---", "", `_${DISCLAIMER}_`, "", `_Made with Culture2Commerce. ${TEAM_CREDIT}._`, "");
  return lines.join("\n");
}
