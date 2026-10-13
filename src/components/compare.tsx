"use client";

import { useState } from "react";
import { inr, score } from "@/lib/format";
import type { RunResult, ScoredOption } from "@/lib/schemas";
import { SourceBadge, VerdictBadge } from "./badges";

// ---------------------------------------------------------------------------
// Without Qloo vs With Qloo
// ---------------------------------------------------------------------------

export function WithWithoutQloo({ result, winner }: { result: RunResult; winner: ScoredOption }) {
  const [view, setView] = useState<"both" | "without" | "with">("both");
  const baseline = result.baseline;
  if (!baseline) return null;

  const signals = winner.evidence.filter((e) => ["concept_affinity", "taste_tag", "brand"].includes(e.kind) && !e.detail?.includes("shown for context")).slice(0, 5);
  const rejected = result.options.filter((o) => o.verdict !== "accepted").filter((o, i, all) => all.findIndex((x) => x.conceptId === o.conceptId) === i);
  const qlooLabel = result.qlooSource === "sample" ? "With cultural data (sample)" : "With Qloo";
  const cf = result.counterfactual;
  // On sample data the signals are illustrative, so the app must not credit Qloo for them.
  const signalOwner = result.qlooSource === "sample" ? "Cultural signals (sample data)" : "Qloo";

  return (
    <section aria-labelledby="compare-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="compare-heading" className="text-xl font-bold">
            Without Qloo vs With Qloo
          </h3>
          <p className="mt-1 text-sm text-muted">The same question, answered with and without cultural and local evidence.</p>
          {cf && (
            <p className={`mt-2 inline-block rounded-xl px-3 py-1.5 text-sm font-semibold ${cf.winnerChanged ? "bg-leaf-soft text-leaf" : "bg-warn-soft text-warn"}`}>
              {cf.winnerChanged
                ? `${signalOwner} changed the answer: without them the same scoring picks ${cf.winnerLabel ?? "nothing"}.`
                : `Same top pick either way for these inputs. ${signalOwner} moved ${cf.ranksChanged} of ${cf.totalOptions} rankings and supplied the audience and evidence.`}
            </p>
          )}
        </div>
        <div className="no-print inline-flex rounded-xl border border-line bg-card p-1" role="group" aria-label="Choose which answer to show">
          {(
            [
              ["both", "Side by side"],
              ["without", "Without Qloo"],
              ["with", "With Qloo"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === value ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`mt-4 grid gap-4 ${view === "both" ? "lg:grid-cols-2" : ""}`}>
        {view !== "with" && (
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-bold text-muted">Without Qloo</p>
              <SourceBadge source={baseline.source} long />
            </div>
            <p className="mt-2 text-sm">{baseline.summary}</p>
            <div className="mt-3 space-y-3">
              {baseline.options.map((o) => (
                <div key={o.conceptId} className="rounded-xl bg-paper p-3 text-sm">
                  <p className="font-semibold">{o.conceptLabel}</p>
                  <p className="mt-1 text-muted">
                    <span className="font-medium text-ink">Pros:</span> {o.pros.join("; ")}.
                  </p>
                  <p className="text-muted">
                    <span className="font-medium text-ink">Cons:</span> {o.cons.join("; ")}.
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-xl border border-dashed border-line p-3 text-sm text-muted">
              Verdict: “It depends.” No concept, no locality, no audience, no plan.
            </p>
            {cf && cf.top.length > 0 && (
              <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
                <p className="font-semibold">If we score it anyway, using costs alone</p>
                <p className="mt-0.5 text-xs text-muted">The same formulas with cultural fit set to neutral and no competitor data.</p>
                <ol className="mt-1.5 space-y-1">
                  {cf.top.map((o, i) => (
                    <li key={o.id} className="flex items-baseline justify-between gap-3">
                      <span>
                        {i + 1}. {o.label}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{o.score}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {view !== "without" && (
          <div className="rounded-2xl border-2 border-brand bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-bold text-brand">{qlooLabel}</p>
              <SourceBadge source={result.qlooSource} long />
            </div>
            <p className="mt-2 text-sm">
              One specific bet: <strong>{winner.conceptLabel.toLowerCase()}</strong> in <strong>{winner.locality}</strong>, for {winner.targetAudience.charAt(0).toLowerCase()}
              {winner.targetAudience.slice(1)}.
            </p>
            {signals.length > 0 && (
              <div className="mt-3 rounded-xl bg-brand-soft p-3">
                <p className="text-sm font-semibold">Signals that drove it</p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {signals.map((e, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3">
                      <span className="[overflow-wrap:anywhere]">{e.label}</span>
                      {e.value !== undefined && <span className="shrink-0 font-semibold tabular-nums">{e.value.toFixed(2)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rejected.length > 0 && (
              <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
                <p className="font-semibold">Ruled out or marked down, with reasons</p>
                <ul className="mt-1.5 space-y-1.5">
                  {rejected.slice(0, 3).map((o) => (
                    <li key={o.id}>
                      <span className="font-medium">
                        {o.conceptLabel} in {o.locality}:
                      </span>{" "}
                      <span className="text-muted">{o.verdictReasons[0]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 rounded-xl border border-brand/30 bg-brand-soft p-3 text-sm">
              Verdict: test it for {result.input.weekends} {result.input.weekends === 1 ? "weekend" : "weekends"} on {inr(winner.totalCostInr)}
              {result.pilotPlan ? `, and continue only if you sell ${result.pilotPlan.rule.continueUnits} ${result.pilotPlan.unitLabel}s or make ${inr(result.pilotPlan.rule.continueRevenueInr)}.` : "."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Locality comparison
// ---------------------------------------------------------------------------

export function LocalityCompare({ result }: { result: RunResult }) {
  const conceptIds = [...new Set(result.options.map((o) => o.conceptId))];
  const labelOf = (id: string) => result.options.find((o) => o.conceptId === id)?.conceptLabel ?? id;
  const cell = (conceptId: string, locality: string) => result.options.find((o) => o.conceptId === conceptId && o.locality === locality);
  const best = (locality: string) =>
    result.options.filter((o) => o.locality === locality && o.verdict !== "rejected").sort((a, b) => b.scores.final - a.scores.final)[0];

  if (result.localities.length === 0) return null;
  const several = result.localities.length > 1;

  return (
    <section aria-labelledby="locality-heading">
      <h3 id="locality-heading" className="text-xl font-bold">
        {several ? "How the answer changes by locality" : "Locality profile"}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {several
          ? "The same inputs, run on each area. Vibe tags are the ones that set an area apart from the others."
          : "Add more localities on the input screen to compare areas side by side."}
      </p>

      <div className={`mt-4 grid gap-4 ${result.localities.length >= 3 ? "lg:grid-cols-3" : result.localities.length === 2 ? "md:grid-cols-2" : ""}`}>
        {result.localities.map((l) => {
          const top = best(l.name);
          return (
            <div key={l.name} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">{l.name}</p>
                  <p className="text-xs text-muted">
                    {l.level === "locality" ? `Qloo matched “${l.resolvedName ?? l.name}”` : "City-level data only"} · {l.placesSeen} places
                  </p>
                </div>
                <SourceBadge source={l.qlooSource} />
              </div>

              <div className="mt-3 rounded-xl bg-paper p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Best idea here</p>
                {top ? (
                  <p className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{top.conceptLabel}</span>
                    <span className="font-display text-xl font-bold tabular-nums">{score(top.scores.final)}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-bad">Nothing fits the budget here.</p>
                )}
              </div>

              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Anchor venues</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {l.anchors.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="[overflow-wrap:anywhere]">{a.name}</span>
                    <span className="shrink-0 text-xs text-muted">{a.genre}</span>
                  </li>
                ))}
              </ul>

              {l.vibeTags.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Distinctive vibe</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {l.vibeTags.slice(0, 6).map((v) => (
                      <span key={v.name} className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs" title={`Tag on ${v.count} of ${l.placesSeen} places`}>
                        {v.name}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-3 flex items-center justify-between gap-2 text-sm">
                <span>
                  Stall fee about <strong>{inr(l.market.stallFeePerDayInr)}</strong> per day
                </span>
                <SourceBadge source="estimate" />
              </p>
            </div>
          );
        })}
      </div>

      {several && conceptIds.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[480px] text-sm">
            <caption className="sr-only">Final score of each business idea in each locality</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="p-3 font-semibold">
                  Final score
                </th>
                {result.localities.map((l) => (
                  <th key={l.name} scope="col" className="p-3 font-semibold">
                    {l.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conceptIds.map((id) => (
                <tr key={id} className="border-b border-line last:border-0">
                  <th scope="row" className="p-3 text-left font-medium">
                    {labelOf(id)}
                  </th>
                  {result.localities.map((l) => {
                    const o = cell(id, l.name);
                    return (
                      <td key={l.name} className="p-3">
                        {o ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`font-display text-lg font-bold tabular-nums ${o.id === result.winnerId ? "text-brand" : ""}`}>{score(o.scores.final)}</span>
                            {o.verdict !== "accepted" && <VerdictBadge verdict={o.verdict} />}
                            {o.id === result.winnerId && <span className="rounded-full bg-spark px-2 py-0.5 text-xs font-bold text-ink">Top pick</span>}
                          </span>
                        ) : (
                          <span className="text-muted">n/a</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
