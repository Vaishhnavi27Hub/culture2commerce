"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { inr, score, splitAudience } from "@/lib/format";
import type { Evidence, RunResult, ScoredOption } from "@/lib/schemas";
import { VerdictBadge } from "./badges";
import { PeopleIcon, WalletIcon, PinIcon, ChartIcon, CheckIcon } from "./ui";

/**
 * Story-scroll visuals — like Spotify Wrapped for your business idea.
 * Each card is one insight, animated when scrolled into view.
 * Big visuals, minimal text, maximum clarity.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const tok = (name: string) => `var(--color-${name})`;
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

type Band = { label: "Strong" | "OK" | "Weak"; token: "leaf" | "warn" | "bad"; pill: string; mark: string };
export function bandOf(v: number): Band {
  if (v >= 70) return { label: "Strong", token: "leaf", pill: "bg-leaf-soft text-leaf", mark: "✓" };
  if (v >= 50) return { label: "OK", token: "warn", pill: "bg-warn-soft text-warn", mark: "!" };
  return { label: "Weak", token: "bad", pill: "bg-bad-soft text-bad", mark: "✕" };
}

function BandPill({ value }: { value: number }) {
  const b = bandOf(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${b.pill}`}>
      <span aria-hidden="true">{b.mark}</span> {b.label}
    </span>
  );
}

function CountUp({ value, format = (n: number) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!inView || reduce) { setN(value); return; }
    const controls = animate(0, value, { duration: 1.2, ease: EASE, onUpdate: setN });
    return () => controls.stop();
  }, [inView, reduce, value]);
  return <span ref={ref}>{format(n)}</span>;
}

/** A single story card — fades + rises when scrolled into view. */
function StoryCard({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      id={id}
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className={`rounded-3xl p-6 sm:p-10 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Filled dots rating ●●●○○ — everyone understands this instantly. */
function Dots({ value, max = 5 }: { value: number; max?: number }) {
  const filled = Math.round((clamp(value) / 100) * max);
  return (
    <span className="inline-flex gap-1" aria-label={`${filled} out of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < filled ? "bg-brand" : "bg-line/50"}`} />
      ))}
    </span>
  );
}

// ============================================================================
// CARD 1: The big reveal — "We found your idea"
// ============================================================================

export function StoryIntro({ winner, total }: { winner: ScoredOption; total: number }) {
  const s = winner.scores.final;
  const b = bandOf(s);
  const reduce = useReducedMotion();
  const r = 62;
  const c = 2 * Math.PI * r;
  const pct = clamp(s) / 100;

  return (
    <StoryCard className="bg-hero relative overflow-hidden text-white">
      {/* Decorative glow */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#7dd3fc]/15 blur-3xl" />

      <p className="relative text-sm font-semibold uppercase tracking-widest text-white/60">
        We compared {total} idea{total !== 1 ? "s" : ""} for you
      </p>
      <h3 className="relative mt-6 font-display text-4xl font-bold leading-tight sm:text-5xl">
        {winner.conceptLabel}
      </h3>
      <p className="relative mt-2 flex items-center gap-2 text-lg text-white/70">
        <PinIcon /> {winner.locality}
      </p>

      {/* Animated score ring */}
      <div className="relative mt-8 flex flex-col items-center sm:flex-row sm:items-center sm:gap-10">
        <div className="relative h-40 w-40 shrink-0 sm:h-48 sm:w-48" role="img" aria-label={`Score ${score(s)} out of 100`}>
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="70" cy="70" r={r} fill="none" strokeWidth="10" className="stroke-white/10" />
            <motion.circle
              cx="70" cy="70" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={c}
              style={{ stroke: tok(b.token) }}
              initial={{ strokeDashoffset: reduce ? c * (1 - pct) : c }}
              animate={{ strokeDashoffset: c * (1 - pct) }}
              transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-5xl font-bold tabular-nums sm:text-6xl">
              <CountUp value={s} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">out of 100</span>
          </div>
        </div>
        <div className="mt-6 text-center sm:mt-0 sm:text-left">
          <p className="text-2xl font-bold sm:text-3xl">
            {s >= 70 ? "Good fit." : s >= 50 ? "Worth a look." : "Needs work."}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
            A planning score from fixed formulas — how well this idea fits your budget, location and audience. Not a forecast of sales.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <BandPill value={winner.scores.culturalFit} />
            <BandPill value={winner.scores.feasibility} />
            <BandPill value={winner.scores.riskAdjustment} />
          </div>
        </div>
      </div>
    </StoryCard>
  );
}

// ============================================================================
// CARD 2: People — "People here already love..."
// ============================================================================

const SIGNAL_KIND: Partial<Record<Evidence["kind"], string>> = { concept_affinity: "Similar place", taste_tag: "Genre", brand: "Brand" };

export function signalsOf(option: ScoredOption) {
  return option.evidence
    .filter((e) => e.kind in SIGNAL_KIND && e.value !== undefined && !e.detail?.includes("shown for context"))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 4);
}

export function StoryPeople({ option }: { option: ScoredOption }) {
  const aud = splitAudience(option.targetAudience);
  const signals = signalsOf(option);
  const venues = option.evidence.filter((e) => e.kind === "anchor_venue").slice(0, 4);
  const vibes = option.evidence.filter((e) => e.kind === "vibe_tag").slice(0, 4);
  const fit = option.scores.culturalFit;
  const hasData = option.culturalBreakdown.meanAffinity !== undefined;

  return (
    <StoryCard className="border border-line bg-card">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand">
        <PeopleIcon /> People
      </div>

      <h3 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
        {hasData
          ? (fit >= 70 ? "People here already love this." : fit >= 50 ? "There's an audience here." : "The match is light.")
          : "We couldn't find strong cultural data."}
      </h3>

      <div className="mt-2 flex items-center gap-3">
        <Dots value={fit} />
        <BandPill value={fit} />
      </div>

      {/* Signals as big tag-style cards */}
      {signals.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-semibold text-muted">People who visit these places also like your kind of business:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {signals.map((e) => {
              const v = e.value as number;
              return (
                <span
                  key={`${e.kind}-${e.label}`}
                  className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold ${
                    v >= 0.6 ? "border-leaf/30 bg-leaf-soft text-leaf" : v >= 0.4 ? "border-warn/30 bg-warn-soft text-warn" : "border-line bg-paper text-muted"
                  }`}
                >
                  {e.label}
                  <span className="ml-2 text-xs font-normal opacity-70">{SIGNAL_KIND[e.kind]}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Audience + venues + vibes in a horizontal layout */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-paper p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">👥 Your audience</p>
          <p className="mt-1.5 text-lg font-bold">{aud.who}</p>
          {aud.detail && <p className="mt-0.5 text-xs text-muted">{aud.detail}</p>}
        </div>
        {venues.length > 0 && (
          <div className="rounded-2xl bg-paper p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">📍 Busy spots nearby</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {venues.map((v) => (
                <span key={v.label} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium">{v.label}</span>
              ))}
            </div>
          </div>
        )}
        {vibes.length > 0 && (
          <div className="rounded-2xl bg-paper p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">✨ Area vibe</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vibes.map((v) => (
                <span key={v.label} className="rounded-full bg-lavender px-2.5 py-1 text-xs font-medium text-lavender-ink">{v.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted">An association, not proof of demand. Verify locally before committing.</p>
    </StoryCard>
  );
}

export function peopleAnswer(option: ScoredOption): string {
  const fit = option.scores.culturalFit;
  return fit >= 70 ? "Strong match" : fit >= 50 ? "Some match" : "Light match";
}

// ============================================================================
// CARD 3: Money — "Where your money goes"
// ============================================================================

const COST_COLORS = ["#6b5bd2", "#1f8a6a", "#e89a2c", "#8f8aa8"];

export function StoryMoney({ option, budgetInr }: { option: ScoredOption; budgetInr: number }) {
  const costs = [...option.costs].filter((c) => c.amountInr > 0).sort((a, b) => b.amountInr - a.amountInr);
  const total = option.totalCostInr;
  const left = budgetInr - total;
  const fits = left >= 0;
  const covers = option.projectedRevenueInr >= option.runningCostInr;
  const salesGap = Math.abs(option.projectedRevenueInr - option.runningCostInr);

  return (
    <StoryCard className="border border-line bg-card">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand">
        <WalletIcon /> Money
      </div>

      <h3 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
        {fits
          ? `₹${Math.round(left / 1000)}k stays in your pocket.`
          : `₹${Math.round(-left / 1000)}k over budget.`}
      </h3>

      {/* Big budget bar */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">{inr(total)} spent</span>
          <span className="text-muted">of {inr(budgetInr)}</span>
        </div>
        <div className="mt-2 flex h-8 overflow-hidden rounded-2xl bg-line/30">
          {costs.slice(0, 4).map((c, i) => (
            <motion.div
              key={c.item}
              className="h-full"
              style={{
                width: `${(c.amountInr / Math.max(budgetInr, total)) * 100}%`,
                background: COST_COLORS[i],
              }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
            />
          ))}
          {fits && <div className="h-full flex-1" style={{ background: "var(--color-line)", opacity: 0.15 }} />}
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {costs.slice(0, 4).map((c, i) => (
            <span key={c.item} className="flex items-center gap-1.5 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COST_COLORS[i] }} />
              {c.item} <span className="font-semibold tabular-nums">{inr(c.amountInr)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Two big KPI cards side by side */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-2xl p-5 ${fits ? "bg-leaf-soft" : "bg-bad-soft"}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${fits ? "text-leaf" : "text-bad"}`}>
            {fits ? "✓ Under budget" : "! Over budget"}
          </p>
          <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${fits ? "text-leaf" : "text-bad"}`}>
            {fits ? inr(left) : inr(-left)}
          </p>
          <p className="mt-0.5 text-xs text-muted">{fits ? "left to spare" : "you'd need to find"}</p>
        </div>
        <div className={`rounded-2xl p-5 ${covers ? "bg-leaf-soft" : "bg-warn-soft"}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${covers ? "text-leaf" : "text-warn"}`}>
            {covers ? "✓ Sales cover costs" : "! Sales may fall short"}
          </p>
          <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${covers ? "text-leaf" : "text-warn"}`}>
            {covers ? `+${inr(salesGap)}` : `-${inr(salesGap)}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {option.plannedUnits} {option.unitLabel}s at ~{inr(option.unitPriceInr)} each
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">Costs are planning estimates. Sales are projections, not promises. Verify locally.</p>
    </StoryCard>
  );
}

export function moneyAnswer(option: ScoredOption, budgetInr: number): string {
  const left = budgetInr - option.totalCostInr;
  if (left >= 0) return `Yes — ${inr(left)} left in budget.`;
  return `Tight — ${inr(-left)} over budget.`;
}

// ============================================================================
// CARD 4: Competition — "How your ideas stack up"
// ============================================================================

export function StoryCompare({ result, selectedId, onSelect }: { result: RunResult; selectedId: string; onSelect: (id: string) => void }) {
  const sorted = [...result.options].sort((a, b) => b.scores.final - a.scores.final);
  const top = sorted.slice(0, 5);

  return (
    <StoryCard className="border border-line bg-card">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand">
        <ChartIcon /> Comparison
      </div>

      <h3 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
        How all {result.options.length} ideas stack up
      </h3>
      <p className="mt-2 text-muted">Tap any row to learn more. The winner is highlighted.</p>

      {/* Visual comparison table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wider text-muted">
              <th className="pb-3 pr-4">Idea</th>
              <th className="pb-3 px-3 text-center">People</th>
              <th className="pb-3 px-3 text-center">Budget</th>
              <th className="pb-3 px-3 text-center">Risk</th>
              <th className="pb-3 pl-3 text-center">Overall</th>
              <th className="pb-3 pl-3"></th>
            </tr>
          </thead>
          <tbody>
            {top.map((o) => {
              const isWinner = o.id === result.winnerId;
              const isSelected = o.id === selectedId;
              return (
                <tr
                  key={o.id}
                  onClick={() => onSelect(o.id)}
                  className={`cursor-pointer border-b border-line/50 transition-colors ${
                    isSelected ? "bg-brand-soft/50" : "hover:bg-paper/80"
                  } ${isWinner ? "font-semibold" : ""}`}
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2">
                      {isWinner && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">★</span>}
                      <div className="min-w-0">
                        <p className="truncate">{o.conceptLabel}</p>
                        <p className="text-xs text-muted">{o.locality} · {inr(o.totalCostInr)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 text-center"><Dots value={o.scores.culturalFit} /></td>
                  <td className="px-3 text-center"><Dots value={o.scores.feasibility} /></td>
                  <td className="px-3 text-center"><Dots value={o.scores.riskAdjustment} /></td>
                  <td className="px-3 text-center">
                    <span className="font-display text-xl font-bold tabular-nums">{score(o.scores.final)}</span>
                  </td>
                  <td className="pl-3"><VerdictBadge verdict={o.verdict} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length > 5 && (
          <p className="mt-3 text-center text-xs text-muted">
            Showing top 5 of {sorted.length}. Open &ldquo;Show the numbers&rdquo; below for all.
          </p>
        )}
      </div>

      {/* Selected idea detail */}
      {(() => {
        const sel = result.options.find((o) => o.id === selectedId);
        if (!sel) return null;
        const isWinner = sel.id === result.winnerId;
        return (
          <div className="mt-4 rounded-2xl border border-line bg-paper/60 p-4" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{sel.conceptLabel} <span className="font-normal text-muted">in {sel.locality}</span></p>
              {isWinner && <span className="rounded-full bg-spark px-2 py-0.5 text-xs font-bold text-ink">Our pick</span>}
              <VerdictBadge verdict={sel.verdict} />
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {sel.verdict === "accepted"
                ? `Costs about ${inr(sel.totalCostInr)} (${sel.budgetUsedPct}% of budget).`
                : sel.verdict === "rejected"
                  ? `Ruled out: ${sel.verdictReasons[0] ?? "over budget or too risky"}`
                  : `Marked down: ${sel.verdictReasons[0] ?? "some concerns"}`}
            </p>
          </div>
        );
      })()}
    </StoryCard>
  );
}

export function othersAnswer(result: RunResult): string {
  const total = result.options.length;
  const ok = result.options.filter((o) => o.verdict === "accepted").length;
  return `${total} ideas compared, ${ok} passed.`;
}

// ============================================================================
// CARD 5: Summary bento — everything at a glance for reference
// ============================================================================

export function StorySummary({ winner, result }: { winner: ScoredOption; result: RunResult }) {
  const s = winner.scores;
  const budget = result.input.budgetInr;
  const left = budget - winner.totalCostInr;
  const aud = splitAudience(winner.targetAudience);
  const covers = winner.projectedRevenueInr >= winner.runningCostInr;

  return (
    <StoryCard className="border border-line bg-card" id="summary">
      <p className="text-sm font-bold uppercase tracking-widest text-brand">📋 Quick reference</p>
      <h3 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Everything at a glance</h3>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Score */}
        <div className="rounded-2xl bg-paper p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Overall score</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{score(s.final)}<span className="text-sm text-muted"> / 100</span></p>
          <BandPill value={s.final} />
        </div>
        {/* Budget */}
        <div className={`rounded-2xl p-4 ${left >= 0 ? "bg-leaf-soft" : "bg-bad-soft"}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Budget</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{inr(winner.totalCostInr)}</p>
          <p className={`text-sm font-semibold ${left >= 0 ? "text-leaf" : "text-bad"}`}>
            {left >= 0 ? `${inr(left)} left` : `${inr(-left)} over`}
          </p>
        </div>
        {/* Audience */}
        <div className="rounded-2xl bg-paper p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Audience</p>
          <p className="mt-1 text-lg font-bold">{aud.who}</p>
          <p className="text-xs text-muted">{winner.locality}</p>
        </div>
        {/* Sales */}
        <div className={`rounded-2xl p-4 ${covers ? "bg-leaf-soft" : "bg-warn-soft"}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Sales outlook</p>
          <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${covers ? "text-leaf" : "text-warn"}`}>
            {inr(winner.projectedRevenueInr)}
          </p>
          <p className="text-xs text-muted">
            vs {inr(winner.runningCostInr)} costs
          </p>
        </div>
      </div>

      {/* Three scores as simple bars */}
      <div className="mt-6 space-y-3">
        {[
          { label: "People like it", value: s.culturalFit, icon: "👥" },
          { label: "Affordable", value: s.feasibility, icon: "💰" },
          { label: "Low risk", value: s.riskAdjustment, icon: "📊" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-5 text-center">{row.icon}</span>
            <span className="w-28 text-sm">{row.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-line/30">
              <div className="h-full rounded-full" style={{ width: `${clamp(row.value)}%`, background: tok(bandOf(row.value).token) }} />
            </div>
            <span className="w-8 text-right text-sm font-bold tabular-nums">{score(row.value)}</span>
            <BandPill value={row.value} />
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted">
        Data quality: <span className="font-semibold text-ink">{winner.confidence.level}</span>. This says how solid the information is, not how likely you are to succeed.
      </p>
    </StoryCard>
  );
}

export { CheckIcon };
