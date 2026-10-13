"use client";

import { useState } from "react";
import { inr, score } from "@/lib/format";
import type { Evidence, RunResult, ScoredOption, Weights } from "@/lib/schemas";
import { ConfidenceBadge, SourceBadge, VerdictBadge } from "./badges";

// ---------------------------------------------------------------------------
// Score bars and the scoring explanation
// ---------------------------------------------------------------------------

function Bar({ label, value, hint, tone = "brand" }: { label: string; value: number; hint?: string; tone?: "brand" | "muted" }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={tone === "brand" ? "font-semibold" : "text-muted"}>{label}</span>
        <span className="tabular-nums font-semibold">{score(value)}</span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className={`h-full rounded-full ${tone === "brand" ? "bg-brand" : "bg-muted/50"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
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
          <div key={g.title} className="rounded-xl border border-line p-3">
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
          <div key={group.title} className="rounded-xl border border-line p-3">
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
    <div className="rounded-xl border border-line p-3">
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
// Winner and ranked alternatives
// ---------------------------------------------------------------------------

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-snug">{value}</p>
    </div>
  );
}

export function WinnerCard({ result, winner, onOpenPlan }: { result: RunResult; winner: ScoredOption; onOpenPlan: () => void }) {
  const plan = result.pilotPlan;
  const narrative = result.narrative;
  return (
    <section aria-labelledby="winner-heading" className="animate-rise overflow-hidden rounded-3xl bg-ink text-white shadow-lg">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-spark px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">Your best bet</span>
          <ConfidenceBadge level={winner.confidence.level} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h2 id="winner-heading" className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            {narrative?.headline ?? `${winner.conceptLabel} in ${winner.locality}`}
          </h2>
          <p className="text-right">
            <span className="font-display text-5xl font-bold tabular-nums">{score(winner.scores.final)}</span>
            <span className="text-white/70"> / 100</span>
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Concept" value={winner.conceptLabel} />
          <Tile label="Locality" value={`${winner.locality}, ${result.input.city}`} />
          <Tile label="Target audience" value={winner.targetAudience} />
          <Tile
            label="Pilot experiment"
            value={
              plan
                ? `${plan.weekends} ${plan.weekends === 1 ? "weekend" : "weekends"}, ${inr(plan.totalCostInr)}. Continue at ${plan.rule.continueUnits} ${plan.unitLabel}s sold or ${inr(plan.rule.continueRevenueInr)}.`
                : "The pilot plan could not be built for this run."
            }
          />
        </div>

        {narrative && (
          <div className="mt-5">
            <p className="text-sm leading-6 text-white/90">{narrative.whyThis}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SourceBadge source={narrative.source} long />
              {narrative.note && <span className="text-xs text-white/70">{narrative.note}</span>}
            </div>
          </div>
        )}

        {plan && (
          <button
            type="button"
            onClick={onOpenPlan}
            className="no-print mt-6 inline-flex items-center gap-2 rounded-xl bg-spark px-5 py-3 text-sm font-bold text-ink hover:brightness-110"
          >
            See the pilot plan <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </section>
  );
}

export function RankedOptions({ result, selectedId, onSelect }: { result: RunResult; selectedId: string; onSelect: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const options = showAll ? result.options : result.options.slice(0, 6);
  return (
    <div>
      <ul className="space-y-2">
        {options.map((o) => {
          const selected = o.id === selectedId;
          return (
            <li key={o.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(o.id)}
                className={`w-full rounded-xl border p-3 text-left ${selected ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-brand/50"}`}
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{o.rank}</span>
                  <span className="font-semibold">
                    {o.conceptLabel} <span className="font-normal text-muted">in {o.locality}</span>
                  </span>
                  <VerdictBadge verdict={o.verdict} />
                  {o.id === result.winnerId && <span className="rounded-full bg-spark px-2 py-0.5 text-xs font-bold text-ink">Top pick</span>}
                  <span className="ml-auto flex items-center gap-3">
                    <ConfidenceBadge level={o.confidence.level} />
                    <span className="font-display text-xl font-bold tabular-nums">{score(o.scores.final)}</span>
                  </span>
                </span>
                <span className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted sm:max-w-md">
                  <span>Cultural fit {score(o.scores.culturalFit)}</span>
                  <span>Feasibility {score(o.scores.feasibility)}</span>
                  <span>Risk {score(o.scores.riskAdjustment)}</span>
                </span>
                <span className={`mt-1.5 block text-sm ${o.verdict === "accepted" ? "text-muted" : o.verdict === "rejected" ? "text-bad" : "text-warn"}`}>
                  {o.verdict === "accepted" ? "" : o.verdict === "rejected" ? "Rejected: " : "Downgraded: "}
                  {o.verdictReasons.join(" ")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {result.options.length > 6 && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-3 text-sm font-semibold text-brand hover:underline">
          {showAll ? "Show top 6 only" : `Show all ${result.options.length} options`}
        </button>
      )}
    </div>
  );
}
