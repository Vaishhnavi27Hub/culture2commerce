"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { CATEGORY_LABEL, CATEGORY_ORDER, type ConceptCategory } from "@/lib/categories";
import { budgetSplit } from "@/lib/explain";
import { inr, score, splitAudience } from "@/lib/format";
import type { Evidence, RunResult, ScoredOption, Weights } from "@/lib/schemas";
import { ConfidenceBadge, EstimateHint, SourceBadge, VerdictBadge } from "./badges";
import { ConceptImage } from "./concept-art";
import { ChartFrame, HBarChart, StackedBar } from "./charts";
import { AlertIcon, ArrowIcon, ChevronIcon, ClockIcon, Disclosure, EmptyState, FilterChips, PeopleIcon, PinIcon, SearchIcon, SparkIcon, WalletIcon } from "./ui";

// ---------------------------------------------------------------------------
// Score bars and the scoring explanation
// ---------------------------------------------------------------------------

function Bar({ label, value, hint, tone = "brand" }: { label: string; value: number; hint?: string; tone?: "brand" | "muted" }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={tone === "brand" ? "font-semibold" : "text-muted"}>{label}</span>
        <span className="tabular-nums font-semibold">{score(value)}</span>
      </div>
      <div ref={ref} className="mt-1 h-2 overflow-hidden rounded-full bg-line/70" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <motion.div
          className={`h-full origin-left rounded-full ${tone === "brand" ? "bg-series-1" : "bg-muted/45"}`}
          style={{ width: `${pct}%` }}
          initial={{ scaleX: reduce ? 1 : 0 }}
          animate={inView ? { scaleX: 1 } : undefined}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ScoreBreakdown({ option, weights }: { option: ScoredOption; weights: Weights }) {
  const s = option.scores;
  const affinity = option.evidence.filter((e) => e.kind === "concept_affinity" && e.value !== undefined);
  const groups = [
    {
      title: "Cultural fit",
      weight: weights.culturalFit,
      value: s.culturalFit,
      formula: "0.45 × affinity + 0.35 × locality lift + 0.20 × resonance",
      note: affinity.length
        ? `Based on Qloo affinities such as ${affinity
            .slice(0, 2)
            .map((e) => `${e.label} (${(e.value as number).toFixed(2)})`)
            .join(" and ")}.`
        : "No Qloo affinity data was available, so a neutral value was used.",
      parts: [
        { label: "Affinity", value: option.culturalBreakdown.affinityScore },
        { label: "Locality lift", value: option.culturalBreakdown.liftScore },
        { label: "Resonance", value: option.culturalBreakdown.resonanceScore },
      ] as { label: string; value: number }[],
      extra:
        option.culturalBreakdown.evidenceWeight < 1
          ? `Only ${option.culturalBreakdown.affinityPlaces} comparable ${option.culturalBreakdown.affinityPlaces === 1 ? "place" : "places"} found, so affinity and lift are pulled towards neutral (weight ${option.culturalBreakdown.evidenceWeight}).`
          : undefined,
    },
    {
      title: "Feasibility",
      weight: weights.feasibility,
      value: s.feasibility,
      formula: "0.50 × budget + 0.20 × competition + 0.15 × logistics + 0.15 × permits",
      note: `Uses ${option.budgetUsedPct}% of the budget; ${option.competitorCount} similar places within 2 km.`,
      parts: [
        { label: "Budget", value: option.feasibilityBreakdown.budgetScore },
        { label: "Competition", value: option.feasibilityBreakdown.competitionScore },
        { label: "Logistics", value: option.feasibilityBreakdown.logisticsScore },
        { label: "Permits", value: option.feasibilityBreakdown.permitScore },
      ],
    },
    {
      title: "Risk adjustment",
      weight: weights.riskAdjustment,
      value: s.riskAdjustment,
      formula: "0.40 × recoverable spend + 0.40 × break-even + 0.20 × skill match (higher is safer)",
      note: `Projected sales ${inr(option.projectedRevenueInr)} against running costs ${inr(option.runningCostInr)}.`,
      parts: [
        { label: "Recoverable spend", value: option.riskBreakdown.recoverabilityScore },
        { label: "Break-even", value: option.riskBreakdown.breakevenScore },
        { label: "Skill match", value: option.riskBreakdown.skillScore },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-paper p-3 text-sm">
        <p className="font-semibold">How the final score is computed</p>
        <p className="mt-1 font-mono text-[13px] leading-6">
          final = {weights.culturalFit} × {score(s.culturalFit)} + {weights.feasibility} × {score(s.feasibility)} + {weights.riskAdjustment} ×{" "}
          {score(s.riskAdjustment)} = {score(s.weighted)}
          {s.penaltyFactor !== 1 && (
            <>
              {" "}
              × {s.penaltyFactor} ({option.verdict}) = <strong>{score(s.final)}</strong>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          Weights come from your risk preference. Scores are calculated with fixed formulas, never by a language model, so the same inputs always give the same result.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="rounded-xl border border-line bg-card p-3">
            <Bar label={`${g.title} · weight ${g.weight}`} value={g.value} />
            <p className="mt-2 text-xs text-muted">{g.formula}</p>
            {g.parts.length > 0 && (
              <div className="mt-3 space-y-2">
                {g.parts.map((p) => (
                  <Bar key={p.label} label={p.label} value={p.value} tone="muted" />
                ))}
              </div>
            )}
            <p className="mt-3 text-xs">{g.note}</p>
            {"extra" in g && g.extra && <p className="mt-1 text-xs text-warn">{g.extra}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Why this?" evidence trail
// ---------------------------------------------------------------------------

const EVIDENCE_GROUPS: { kinds: Evidence["kind"][]; title: string; help: string; format: (e: Evidence) => string | undefined }[] = [
  {
    kinds: ["locality_lift", "concept_affinity"],
    title: "Similar places this audience already likes",
    help: "Qloo affinity (0 to 1) between existing places of this type and the people who visit the area’s anchor venues. Lift compares this area with the others.",
    format: (e) => (e.value === undefined ? undefined : e.kind === "locality_lift" ? `lift ${e.value >= 0 ? "+" : ""}${e.value.toFixed(3)}` : `affinity ${e.value.toFixed(2)}`),
  },
  {
    kinds: ["taste_tag"],
    title: "Genres this audience over-indexes on",
    help: "From Qloo taste analysis of the anchor venues.",
    format: (e) => (e.value !== undefined ? `affinity ${e.value.toFixed(2)}` : undefined),
  },
  {
    kinds: ["brand"],
    title: "Brands this audience favours",
    help: "Cross-domain signal: brand affinities of the same audience.",
    format: (e) => (e.value !== undefined ? `affinity ${e.value.toFixed(2)}` : undefined),
  },
  {
    kinds: ["anchor_venue", "vibe_tag", "demographic"],
    title: "Who is here: anchor venues, vibe and age",
    help: "The area’s most popular places stand in for its regular crowd.",
    format: (e) =>
      e.value === undefined
        ? undefined
        : e.kind === "anchor_venue"
          ? `rated ${e.value.toFixed(1)}`
          : e.kind === "demographic"
            ? `skew ${e.value > 0 ? "+" : ""}${e.value.toFixed(2)}`
            : `on ${e.value} places`,
  },
  {
    kinds: ["competitor", "cost", "venue", "permit"],
    title: "Competition and costs",
    help: "Competitors come from Qloo place data; costs are illustrative estimates.",
    format: () => undefined,
  },
];

export function EvidenceTrail({ option }: { option: ScoredOption }) {
  if (option.evidence.length === 0) {
    return <p className="text-sm text-muted">No evidence was collected for this option.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {EVIDENCE_GROUPS.map((group) => {
        const items = option.evidence.filter((e) => group.kinds.includes(e.kind));
        if (items.length === 0) return null;
        return (
          <div key={group.title} className="rounded-xl border border-line bg-card p-3">
            <p className="text-sm font-semibold">{group.title}</p>
            <p className="mt-0.5 text-xs text-muted">{group.help}</p>
            <ul className="mt-2 divide-y divide-line">
              {items.map((e, i) => {
                const value = group.format(e);
                return (
                  <li key={i} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium [overflow-wrap:anywhere]">{e.label}</span>
                      {e.detail && <span className="block text-xs text-muted">{e.detail}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {value && <span className="text-xs font-semibold tabular-nums">{value}</span>}
                      <SourceBadge source={e.source} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export function ConfidencePanel({ option }: { option: ScoredOption }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">How sure are we about the data?</p>
        <ConfidenceBadge level={option.confidence.level} />
      </div>
      <p className="mt-1 text-xs text-muted">
        Confidence describes the quality of the evidence, not the chance of success. There is no accuracy figure because nothing can be measured until a pilot runs.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {option.confidence.reasons.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className={`font-bold ${r.effect === "up" ? "text-leaf" : r.effect === "cap" ? "text-bad" : "text-warn"}`}>
              {r.effect === "up" ? "+" : r.effect === "cap" ? "!" : "−"}
            </span>
            <span>
              <span className="sr-only">{r.effect === "up" ? "Raises confidence: " : r.effect === "cap" ? "Limits confidence: " : "Lowers confidence: "}</span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts for one option: cultural affinity and feasibility
// ---------------------------------------------------------------------------

const AFFINITY_KIND: Partial<Record<Evidence["kind"], string>> = {
  concept_affinity: "Similar place",
  taste_tag: "Genre",
  brand: "Brand",
};

/** Raw Qloo affinities (0–1) behind an option's cultural fit, adapted to whatever the response contained. */
export function CulturalAffinityChart({ option }: { option: ScoredOption }) {
  const items = option.evidence
    .filter((e) => e.kind in AFFINITY_KIND && e.value !== undefined && !e.detail?.includes("shown for context"))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 8);
  const sampleOnly = items.length > 0 && items.every((e) => e.source === "sample");
  if (items.length === 0) {
    return (
      <EmptyState title="No Qloo affinity values for this option">
        Qloo returned no comparable places, genres or brands for this audience, so cultural fit used a neutral value. See “Why this recommendation?” for details.
      </EmptyState>
    );
  }
  return (
    <ChartFrame
      title="Cultural affinity"
      caption={`How strongly ${option.locality}’s audience is associated with each signal in Qloo’s taste data (0 to 1). An association, not proof of demand.`}
      table={{ headers: ["Signal", "Type", "Affinity"], rows: items.map((e) => [e.label, AFFINITY_KIND[e.kind] ?? "", (e.value as number).toFixed(2)]) }}
      footer={
        <span className="flex flex-wrap items-center gap-2">
          <SourceBadge source={items[0]!.source} long />
          {sampleOnly && <span>Sample values are illustrative, not real Qloo signals.</span>}
          {option.culturalBreakdown.meanAffinity !== undefined && <span>Mean affinity of similar places: {option.culturalBreakdown.meanAffinity.toFixed(2)}.</span>}
        </span>
      }
    >
      <HBarChart data={items.map((e) => ({ label: e.label, value: e.value as number, note: AFFINITY_KIND[e.kind] }))} domain={[0, 1]} format={(n) => n.toFixed(2)} valueName="Qloo affinity" />
    </ChartFrame>
  );
}

export function FeasibilityBreakdown({ option, budgetInr }: { option: ScoredOption; budgetInr: number }) {
  const b = budgetSplit(option.totalCostInr, option.runningCostInr, budgetInr);
  return (
    <ChartFrame
      title="Budget feasibility"
      caption={`Estimated cost of the pilot against your ${inr(budgetInr)} budget. All costs are planning estimates.`}
      table={{
        headers: ["Item", "Amount"],
        rows: [...option.costs.map((c) => [c.item, inr(c.amountInr)]), ["Total estimated cost", inr(option.totalCostInr)], ["Your budget", inr(budgetInr)]],
      }}
      footer={<SourceBadge source="estimate" long />}
    >
      <StackedBar
        ariaLabel="Budget split"
        total={b.scale}
        format={inr}
        segments={[
          { label: "Reusable equipment", value: b.equipment, color: "#6b5bd2", hint: "Keeps its value after the pilot" },
          { label: "Running costs", value: b.running, color: "#1f8a6a", hint: "What sales must earn back" },
          { label: "Left in budget", value: b.buffer, color: "#8fb39c", pattern: true },
          { label: "Over budget", value: b.over, color: "#b42318", pattern: true },
        ]}
      />
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-paper p-2.5">
          <dt className="text-xs text-muted">Estimated startup cost</dt>
          <dd className="font-semibold tabular-nums">{inr(option.totalCostInr)}</dd>
        </div>
        <div className="rounded-xl bg-paper p-2.5">
          <dt className="text-xs text-muted">{b.over > 0 ? "Funding gap" : "Remaining budget"}</dt>
          <dd className={`font-semibold tabular-nums ${b.over > 0 ? "text-bad" : "text-leaf"}`}>{inr(b.over > 0 ? b.over : b.buffer)}</dd>
        </div>
        <div className="col-span-2 rounded-xl bg-paper p-2.5 sm:col-span-1">
          <dt className="text-xs text-muted">Projected sales (estimate)</dt>
          <dd className="font-semibold tabular-nums">{inr(option.projectedRevenueInr)}</dd>
          <dd className="text-[11px] text-muted">
            {option.plannedUnits} {option.unitLabel}s at about {inr(option.unitPriceInr)}
          </dd>
        </div>
      </dl>
      <Disclosure title="Cost breakdown" hint={`${option.costs.length} line items`} className="mt-3">
        <table className="w-full">
          <caption className="sr-only">Estimated cost lines</caption>
          <tbody>
            {option.costs.map((c) => (
              <tr key={c.item} className="border-b border-line last:border-0">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {c.item}
                  {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                </th>
                <td className="py-1.5 text-right align-top tabular-nums">{inr(c.amountInr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Disclosure>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Winner
// ---------------------------------------------------------------------------

/** Circular 0–100 gauge for the final score. */
function ScoreRing({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Final score ${score(value)} out of 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#ff9db5"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - pct) : c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="font-display text-3xl font-semibold tabular-nums">{score(value)}</span>
        <span className="text-[10px] uppercase tracking-wider text-white/70">of 100</span>
      </div>
    </div>
  );
}

/** Two or three plain sentences built only from the run's own numbers. */
export function executiveSummary(result: RunResult, winner: ScoredOption): string[] {
  const out: string[] = [];
  const cb = winner.culturalBreakdown;
  if (cb.meanAffinity !== undefined) {
    out.push(
      `Qloo links ${winner.locality}’s regular crowd to existing ${winner.conceptLabel.toLowerCase()}-type places (mean affinity ${cb.meanAffinity.toFixed(2)}${
        cb.localityLift !== undefined && cb.localityLift > 0.004 ? `, ${cb.localityLift.toFixed(3)} above the other areas compared` : ""
      }), for a cultural fit of ${score(winner.scores.culturalFit)}/100.`,
    );
  } else {
    out.push(`Cultural data was limited for this option, so its cultural fit is neutral (${score(winner.scores.culturalFit)}/100).`);
  }
  out.push(
    winner.verdict === "accepted"
      ? `The pilot fits your budget: about ${inr(winner.totalCostInr)} of ${inr(result.input.budgetInr)}.`
      : (winner.verdictReasons[0] ?? "It was marked down on cost."),
  );
  const next = result.options.find((o) => o.id !== winner.id && o.verdict !== "rejected");
  if (next) {
    const gap = winner.scores.final - next.scores.final;
    out.push(
      gap < 3
        ? `It only narrowly leads ${next.conceptLabel.toLowerCase()} in ${next.locality} (${score(gap)} points), so that is a reasonable alternative.`
        : `It leads the next option, ${next.conceptLabel.toLowerCase()} in ${next.locality}, by ${score(gap)} points.`,
    );
  }
  return out;
}

/** The single most important caveat: the first factor that lowered confidence, or a cost warning. */
export function mainCaveat(winner: ScoredOption): string {
  const lowered = winner.confidence.reasons.find((r) => r.effect === "cap") ?? winner.confidence.reasons.find((r) => r.effect === "down");
  return lowered?.text ?? winner.verdictReasons[1] ?? "Costs are planning estimates; verify them locally before spending.";
}

/** At most two short sentences: cultural relevance, then whether the pilot is affordable. */
export function shortWhy(result: RunResult, winner: ScoredOption): string[] {
  const fit = winner.scores.culturalFit;
  const strength = fit >= 75 ? "a strong" : fit >= 60 ? "a clear" : "some";
  const first =
    winner.culturalBreakdown.meanAffinity !== undefined
      ? `People who spend time in ${winner.locality} show ${strength} taste affinity for places like ${article(winner.conceptLabel)} ${winner.conceptLabel.toLowerCase()} (cultural fit ${score(fit)}/100).`
      : `It ranked highest overall in ${winner.locality}, although Qloo had little cultural data for this idea there.`;
  const second =
    winner.verdict === "accepted"
      ? `A small pilot fits your budget at about ${inr(result.pilotPlan?.totalCostInr ?? winner.totalCostInr)}.`
      : (winner.verdictReasons[0] ?? "Costs need a closer look before you commit.");
  return [first, second];
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** The suggested test price: Qloo-informed pricing for this concept when available, otherwise the plan's unit price. */
function testPrice(result: RunResult, winner: ScoredOption): string | undefined {
  const p = result.pricing;
  if (p && p.conceptId === winner.conceptId && p.rangeInr[1] > 0) {
    const [lo, hi] = p.rangeInr;
    return `${lo === hi ? inr(lo) : `${inr(lo)}–${inr(hi)}`} per ${winner.unitLabel}`;
  }
  if (winner.unitPriceInr > 0) return `About ${inr(winner.unitPriceInr)} per ${winner.unitLabel}`;
  return undefined;
}

export function WinnerCard({ result, winner, category, onOpenPlan }: { result: RunResult; winner: ScoredOption; category?: string; onOpenPlan: () => void }) {
  const [open, setOpen] = useState(false);
  const plan = result.pilotPlan;
  const narrative = result.narrative;
  const cost = plan?.totalCostInr ?? winner.totalCostInr;
  const left = result.input.budgetInr - cost;
  const price = testPrice(result, winner);
  const audience = splitAudience(winner.targetAudience);
  const whyId = "winner-why";
  return (
    <section aria-labelledby="winner-heading" className="overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-lift)]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="bg-hero relative grid text-white md:grid-cols-[1.15fr_1fr]"
      >
        {/* Picture of the recommended business (first on small screens). */}
        <div className="relative order-first aspect-[16/10] bg-gradient-to-b from-[#1f1846] via-[#16122e] to-[#0a0817] md:order-last md:aspect-auto md:min-h-full">
          <ConceptImage conceptId={winner.conceptId} category={category} label={winner.conceptLabel} className="absolute inset-0" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#141230]/70 via-transparent to-transparent md:bg-gradient-to-r md:from-[#1d1840] md:via-transparent" />
        </div>

        <div className="relative p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Your Top Recommendation</p>
            <span className="rounded-full bg-gradient-to-r from-[#c4b5fd] to-[#7dd3fc] px-2.5 py-0.5 text-[11px] font-bold text-[#0b0b14]">Top pick</span>
          </div>
          <h2 id="winner-heading" className="mt-2 text-3xl font-bold leading-tight sm:text-[2.4rem]">
            {winner.conceptLabel}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-white/80">
            <PinIcon /> {winner.locality}, {result.input.city}
          </p>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/90">{shortWhy(result, winner).join(" ")}</p>

          {/* The two numbers that matter most for a first decision. */}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-[1.1rem] bg-white/10 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
                <WalletIcon /> Estimated pilot budget
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{inr(cost)}</p>
              <p className="text-xs text-white/70">{left >= 0 ? `${inr(left)} left of your ${inr(result.input.budgetInr)}` : `${inr(-left)} over your ${inr(result.input.budgetInr)}`}</p>
            </div>
            <div className="rounded-[1.1rem] bg-white/10 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
                <ClockIcon /> Pilot duration
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {result.input.weekends} {result.input.weekends === 1 ? "weekend" : "weekends"}
              </p>
              <p className="text-xs text-white/70">{plan ? `${plan.days} selling days` : `${result.input.weekends * 2} selling days`}</p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="mt-0.5 shrink-0 text-white/60">
                <PeopleIcon />
                <span className="sr-only">Target audience</span>
              </dt>
              <dd>
                <span className="font-semibold">Audience: </span>
                <span className="text-white/85">
                  {audience.who}
                  {audience.detail ? ` ${audience.detail}` : ""}
                </span>
              </dd>
            </div>
            {price && (
              <div className="flex gap-2">
                <dt className="mt-0.5 shrink-0 text-white/60">
                  <SparkIcon />
                  <span className="sr-only">Suggested test price</span>
                </dt>
                <dd>
                  <span className="font-semibold">Suggested test price: </span>
                  <span className="text-white/85">{price}</span>{" "}
                  <EstimateHint text="estimate to test" detail="A starting price to test at the stall, based on local price levels and costs. Not a confirmed market price." className="text-white/55" />
                </dd>
              </div>
            )}
          </dl>

          <div className="no-print mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            {plan && (
              <button type="button" onClick={onOpenPlan} className="btn-primary px-6 py-3 text-sm">
                View My Pilot Plan <ArrowIcon />
              </button>
            )}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={whyId}
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold text-white/85 hover:text-white"
            >
              See why we recommend this
              <motion.span aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronIcon />
              </motion.span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Detailed reasoning, only on request. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={whyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-x border-b border-line bg-card"
          >
            <div className="grid gap-5 p-5 text-sm sm:grid-cols-[auto_1fr] sm:p-6">
              <div className="flex items-center gap-3 sm:flex-col sm:text-center">
                <ScoreRing value={winner.scores.final} />
                <p className="max-w-[11rem] text-xs leading-4 text-muted">
                  <span className="font-semibold text-ink">Overall score.</span> Cultural fit, feasibility and risk with fixed weights. Not a success probability.
                </p>
              </div>
              <div className="space-y-3">
                <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
                  {executiveSummary(result, winner).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                {narrative?.whyThis && <p className="leading-relaxed text-muted">{narrative.whyThis}</p>}
                <p className="flex gap-2 rounded-xl bg-paper p-3">
                  <span aria-hidden="true" className="text-spark-dark">
                    <AlertIcon />
                  </span>
                  <span>
                    <span className="font-semibold">Worth checking: </span>
                    {mainCaveat(winner)}
                  </span>
                </p>
                <p className="text-xs text-muted">Cultural affinity shows who already enjoys similar places; it is not proof that people will buy.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ranked options, with search and filters
// ---------------------------------------------------------------------------

type VerdictFilter = "all" | ScoredOption["verdict"];

export function RankedOptions({
  result,
  selectedId,
  onSelect,
  categoryOf,
}: {
  result: RunResult;
  selectedId: string;
  onSelect: (id: string) => void;
  categoryOf?: (conceptId: string) => ConceptCategory | undefined;
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<VerdictFilter>("all");
  const [category, setCategory] = useState<"all" | ConceptCategory>("all");
  const q = query.trim().toLowerCase();
  const filtered = result.options.filter(
    (o) =>
      (verdict === "all" || o.verdict === verdict) &&
      (category === "all" || categoryOf?.(o.conceptId) === category) &&
      (!q || `${o.conceptLabel} ${o.locality}`.toLowerCase().includes(q)),
  );
  const filtering = q !== "" || verdict !== "all" || category !== "all";
  const options = showAll || filtering ? filtered : filtered.slice(0, 6);
  const count = (v: ScoredOption["verdict"]) => result.options.filter((o) => o.verdict === v).length;
  const categories = categoryOf ? CATEGORY_ORDER.filter((c) => result.options.some((o) => categoryOf(o.conceptId) === c)) : [];

  return (
    <div>
      <div className="no-print flex flex-col gap-3">
        <span className="relative block">
          <label htmlFor="option-search" className="sr-only">
            Search by locality or business idea
          </label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            id="option-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a locality or idea"
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 text-base shadow-sm placeholder:text-muted/70 focus:border-brand"
          />
        </span>
        <FilterChips
          label="Filter options by verdict"
          value={verdict}
          onChange={setVerdict}
          options={[
            { value: "all" as const, label: "All" },
            { value: "accepted" as const, label: "Fits", count: count("accepted") },
            { value: "downgraded" as const, label: "Downgraded", count: count("downgraded") },
            { value: "rejected" as const, label: "Rejected", count: count("rejected") },
          ]}
        />
      </div>
      {categories.length > 1 && (
        <div className="no-print mt-2">
          <FilterChips
            label="Filter options by category"
            value={category}
            onChange={setCategory}
            options={[{ value: "all" as const, label: "All categories" }, ...categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]}
          />
        </div>
      )}

      {options.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">No options match these filters.</p>
      ) : (
        <motion.ul layout className="mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {options.map((o) => {
              const selected = o.id === selectedId;
              return (
                <motion.li layout key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(o.id)}
                    className={`w-full rounded-2xl border p-3.5 text-left transition-all ${selected ? "border-brand bg-brand-soft/70 shadow-sm" : "border-line bg-card hover:-translate-y-px hover:border-brand/50 hover:shadow-[var(--shadow-card)]"}`}
                  >
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${o.id === result.winnerId ? "bg-spark text-[#2b2540]" : "bg-brand text-on-brand"}`}>{o.rank}</span>
                      <span className="font-semibold">
                        {o.conceptLabel} <span className="font-normal text-muted">in {o.locality}</span>
                      </span>
                      <VerdictBadge verdict={o.verdict} />
                      {o.id === result.winnerId && <span className="rounded-full bg-spark px-2 py-0.5 text-xs font-bold text-ink">Top pick</span>}
                      <span className="ml-auto flex items-center gap-3">
                        <ConfidenceBadge level={o.confidence.level} />
                        <span className="font-display text-2xl font-semibold tabular-nums">{score(o.scores.final)}</span>
                      </span>
                    </span>
                    <span className="mt-2 grid grid-cols-3 gap-3 text-xs text-muted sm:max-w-lg">
                      {(
                        [
                          ["Cultural fit", o.scores.culturalFit],
                          ["Feasibility", o.scores.feasibility],
                          ["Risk", o.scores.riskAdjustment],
                        ] as const
                      ).map(([label, v]) => (
                        <span key={label}>
                          {label} {score(v)}
                          <span aria-hidden="true" className="mt-1 block h-1 overflow-hidden rounded-full bg-line">
                            <span className="block h-full rounded-full bg-series-1" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                          </span>
                        </span>
                      ))}
                    </span>
                    {o.verdict !== "accepted" && (
                      <span className={`mt-2 block text-sm ${o.verdict === "rejected" ? "text-bad" : "text-warn"}`}>
                        {o.verdict === "rejected" ? "Rejected: " : "Downgraded: "}
                        {o.verdictReasons.join(" ")}
                      </span>
                    )}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}
      {!filtering && result.options.length > 6 && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-3 text-sm font-semibold text-brand underline-offset-2 hover:underline">
          {showAll ? "Show top 6 only" : `Show all ${result.options.length} options`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selected option: the headline insight, two charts, and the details on demand
// ---------------------------------------------------------------------------

export function OptionDetail({ result, option, weights }: { result: RunResult; option: ScoredOption; weights: Weights }) {
  const isWinner = option.id === result.winnerId;
  const tone = option.verdict === "rejected" ? "border-bad/30 bg-bad-soft" : option.verdict === "downgraded" ? "border-warn/30 bg-warn-soft" : "border-leaf/25 bg-leaf-soft";
  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={option.id}
        aria-labelledby="why-heading"
        aria-live="polite"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">{isWinner ? "Top pick" : `Option ranked ${option.rank}`}</p>
            <h3 id="why-heading" className="text-2xl font-semibold">
              {option.conceptLabel} <span className="font-normal text-muted">in {option.locality}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={option.verdict} />
            <ConfidenceBadge level={option.confidence.level} />
          </div>
        </div>

        {/* One primary insight, styled by what kind of message it is. */}
        <div className={`flex gap-3 rounded-2xl border p-4 text-sm ${tone}`}>
          <span aria-hidden="true" className="mt-0.5">
            <WalletIcon />
          </span>
          <p>
            {option.verdict === "accepted" ? (
              <>
                <span className="font-semibold">Why it matters:</span> {option.hypothesis}
              </>
            ) : (
              <>
                <span className="font-semibold">{option.verdict === "rejected" ? "Ruled out:" : "Marked down:"}</span> {option.verdictReasons.join(" ")}
              </>
            )}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
          <CulturalAffinityChart option={option} />
          <FeasibilityBreakdown option={option} budgetInr={result.input.budgetInr} />
        </div>

        <Disclosure tone="card" icon={<SparkIcon />} title="Why it scored this way" hint="Score formula, data confidence and every signal used">
          <div className="space-y-4">
            <ScoreBreakdown option={option} weights={weights} />
            <ConfidencePanel option={option} />
            <div>
              <p className="mb-2 text-sm font-semibold">Evidence trail</p>
              <EvidenceTrail option={option} />
            </div>
          </div>
        </Disclosure>
      </motion.section>
    </AnimatePresence>
  );
}
