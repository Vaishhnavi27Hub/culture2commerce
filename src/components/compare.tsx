"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { localityLead, signed } from "@/lib/explain";
import { inr, score } from "@/lib/format";
import type { LocalityProfile, RunResult, ScoredOption } from "@/lib/schemas";
import { SourceBadge, VerdictBadge } from "./badges";
import { ChartFrame, GroupedHBarChart, LegendRow, SERIES } from "./charts";
import { PinIcon, Segmented } from "./ui";

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
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">Does the cultural data matter?</p>
          <h3 id="compare-heading" className="text-2xl font-semibold">
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
        <div className="no-print">
          <Segmented
            label="Choose which answer to show"
            value={view}
            onChange={setView}
            options={[
              ["both", "Side by side"],
              ["without", "Without Qloo"],
              ["with", "With Qloo"],
            ]}
          />
        </div>
      </div>

      <div className={`mt-4 grid gap-4 ${view === "both" ? "lg:grid-cols-2" : ""}`}>
        {view !== "with" && (
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xl font-semibold text-muted">Without Qloo</p>
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
          <div className="rounded-[1.25rem] border-2 border-brand bg-card p-4 shadow-[var(--shadow-lift)] sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xl font-semibold text-brand">{qlooLabel}</p>
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
// Locality comparison: map, metric chart, explanation, score matrix
// ---------------------------------------------------------------------------

const METRICS = [
  { key: "fit", label: "Cultural fit", help: "How well the idea matches the area's audience in Qloo's taste data" },
  { key: "budget", label: "Budget fit", help: "How comfortably the estimated cost fits your budget" },
  { key: "room", label: "Room vs competitors", help: "Higher means fewer similar places within 2 km" },
] as const;

/** Places localities by their real coordinates (equirectangular, fine at city scale). No street map is drawn. */
function LocalityMap({ localities, selected, onSelect, best }: { localities: LocalityProfile[]; selected: string; onSelect: (name: string) => void; best: (name: string) => ScoredOption | undefined }) {
  const located = localities.filter((l) => l.lat !== undefined && l.lon !== undefined);
  if (located.length === 0) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-line bg-paper/60 p-4 text-center text-sm text-muted">
        Qloo returned no coordinates for these areas, so they cannot be placed on a map.
      </div>
    );
  }
  const lats = located.map((l) => l.lat!);
  const lons = located.map((l) => l.lon!);
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = (Math.max(...lons) - Math.min(...lons)) * kx;
  const spanY = Math.max(...lats) - Math.min(...lats);
  const span = Math.max(spanX, spanY, 0.01);
  const pos = (l: LocalityProfile) => ({
    x: 50 + (((l.lon! - Math.min(...lons)) * kx - spanX / 2) / span) * 52,
    y: 50 - ((l.lat! - Math.min(...lats) - spanY / 2) / span) * 52,
  });
  const km = span * 111;
  const scaleKm = km > 8 ? 5 : km > 3 ? 2 : 1;
  const scalePct = (scaleKm / km) * 52;
  const winnerScore = Math.max(...located.map((l) => best(l.name)?.scores.final ?? 0));

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-[#f4efe4]">
      <div aria-hidden="true" className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e6dccd 1px, transparent 1px), linear-gradient(90deg, #e6dccd 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div aria-hidden="true" className="absolute -left-10 top-1/4 h-40 w-56 rounded-full bg-sage/70 blur-2xl" />
      <div aria-hidden="true" className="absolute bottom-0 right-6 h-32 w-40 rounded-full bg-lavender/60 blur-2xl" />
      <ul className="absolute inset-0">
        {located.map((l, i) => {
          const p = pos(l);
          const top = best(l.name);
          const isSel = selected === l.name;
          const lead = top !== undefined && top.scores.final === winnerScore;
          return (
            <motion.li
              key={l.name}
              className="absolute"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              initial={{ opacity: 0, scale: 0.6, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.1 + i * 0.1 }}
            >
              <button
                type="button"
                onClick={() => onSelect(l.name)}
                aria-pressed={isSel}
                aria-label={`${l.name}${top ? `, best idea ${top.conceptLabel}, score ${score(top.scores.final)}` : ", nothing fits the budget"}`}
                className="group absolute -translate-x-1/2 -translate-y-full rounded-full"
              >
                <span className="relative flex flex-col items-center">
                  <span className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform group-hover:scale-110 ${isSel ? "scale-110 bg-spark text-ink" : lead ? "bg-brand text-white" : "bg-card text-brand"}`}>
                    {isSel && <span aria-hidden="true" className="animate-ping-soft absolute inset-0 rounded-full bg-spark" />}
                    <span className="relative">
                      <PinIcon />
                    </span>
                  </span>
                  <span className={`mt-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm ${isSel ? "bg-ink text-white" : "bg-card/95 text-ink"}`}>
                    {l.name}
                    {top && <span className="ml-1 tabular-nums opacity-70">{score(top.scores.final)}</span>}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
      {located.length > 1 && (
        <div className="absolute bottom-2 left-3 text-[10px] text-muted" aria-hidden="true">
          <span className="block h-1 border-x border-b border-muted" style={{ width: `${scalePct}%`, minWidth: 24 }} />
          about {scaleKm} km
        </div>
      )}
      <p className="absolute bottom-2 right-3 text-[10px] text-muted">Positions from Qloo coordinates · not a street map</p>
    </div>
  );
}

function LocalityCard({ l, top }: { l: LocalityProfile; top: ScoredOption | undefined }) {
  return (
    <div className="card h-full p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-xl font-semibold">{l.name}</p>
          <p className="text-xs text-muted">
            {l.level === "locality" ? `Qloo matched “${l.resolvedName ?? l.name}”` : "City-level data only"} · {l.placesSeen} places
          </p>
        </div>
        <SourceBadge source={l.qlooSource} />
      </div>

      <div className="mt-3 rounded-xl bg-brand-soft/60 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Best idea here</p>
        {top ? (
          <p className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-semibold">{top.conceptLabel}</span>
            <span className="font-display text-2xl font-semibold tabular-nums">{score(top.scores.final)}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-bad">Nothing fits the budget here.</p>
        )}
      </div>

      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted">Anchor venues</p>
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
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted">Distinctive vibe</p>
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
}

export function LocalityCompare({ result }: { result: RunResult }) {
  const conceptIds = [...new Set(result.options.map((o) => o.conceptId))];
  const labelOf = (id: string) => result.options.find((o) => o.conceptId === id)?.conceptLabel ?? id;
  const cell = (conceptId: string, locality: string) => result.options.find((o) => o.conceptId === conceptId && o.locality === locality);
  const best = (locality: string) =>
    result.options.filter((o) => o.locality === locality && o.verdict !== "rejected").sort((a, b) => b.scores.final - a.scores.final)[0];
  const winner = result.options.find((o) => o.id === result.winnerId);
  const [conceptId, setConceptId] = useState(winner?.conceptId ?? conceptIds[0] ?? "");
  const [selected, setSelected] = useState(winner?.locality ?? result.localities[0]?.name ?? "");

  if (result.localities.length === 0) return null;
  const several = result.localities.length > 1;
  const forConcept = result.localities.map((l) => cell(conceptId, l.name)).filter((o): o is ScoredOption => o !== undefined);
  const lead = localityLead(forConcept);
  const rows = result.localities.map((l) => {
    const o = cell(conceptId, l.name);
    return { label: l.name, fit: o?.scores.culturalFit, budget: o?.feasibilityBreakdown.budgetScore, room: o?.feasibilityBreakdown.competitionScore };
  });
  const selectedProfile = result.localities.find((l) => l.name === selected) ?? result.localities[0]!;
  const finals = result.options.map((o) => o.scores.final);
  const lo = Math.min(...finals);
  const hi = Math.max(...finals);

  return (
    <section aria-labelledby="locality-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">Explore neighbourhoods</p>
          <h3 id="locality-heading" className="text-2xl font-semibold">
            {several ? "How the answer changes by locality" : "Locality profile"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {several ? "The same inputs, run on each area. Select an area on the map to see who is there." : "Add more localities on the input screen to compare areas side by side."}
          </p>
        </div>
        {several && conceptIds.length > 1 && (
          <label className="no-print flex items-center gap-2 text-sm">
            <span className="font-semibold">Compare for</span>
            <select value={conceptId} onChange={(e) => setConceptId(e.target.value)} className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium shadow-sm focus:border-brand">
              {conceptIds.map((id) => (
                <option key={id} value={id}>
                  {labelOf(id)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <LocalityMap localities={result.localities} selected={selectedProfile.name} onSelect={setSelected} best={best} />
        <AnimatePresence mode="wait">
          <motion.div key={selectedProfile.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22 }}>
            <LocalityCard l={selectedProfile} top={best(selectedProfile.name)} />
          </motion.div>
        </AnimatePresence>
      </div>

      {several && forConcept.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ChartFrame
            title={`${labelOf(conceptId)}: area by area`}
            caption="Scores from 0 to 100, higher is better on each. They are separate measures; read each bar against its own kind."
            legend={<LegendRow items={METRICS.map((m, i) => ({ label: m.label, color: SERIES[i]! }))} />}
            table={{ headers: ["Locality", ...METRICS.map((m) => m.label)], rows: rows.map((r) => [r.label, ...METRICS.map((m) => (r[m.key] === undefined ? "n/a" : score(r[m.key]!)))]) }}
            footer={
              <ul className="space-y-0.5">
                {METRICS.map((m) => (
                  <li key={m.key}>
                    <span className="font-semibold text-ink">{m.label}:</span> {m.help}.
                  </li>
                ))}
              </ul>
            }
          >
            <GroupedHBarChart rows={rows} series={METRICS.map((m) => ({ key: m.key, label: m.label }))} format={(n) => score(Math.round(n * 10) / 10)} />
          </ChartFrame>

          <div className="rounded-[1.25rem] border border-lavender-ink/15 bg-lavender/60 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-lavender-ink">Why one area leads</p>
            {lead ? (
              <>
                <p className="mt-2 font-display text-xl font-semibold leading-snug">
                  {lead.runnerUp ? (
                    <>
                      {lead.leader.locality} leads {lead.runnerUp.locality} by {score(lead.margin)} points
                    </>
                  ) : (
                    <>{lead.leader.locality} is the only area where this idea fits</>
                  )}
                </p>
                {lead.diffs.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {lead.diffs.map((d) => (
                      <li key={d.label} className="flex items-center justify-between gap-3 rounded-xl bg-card/80 px-3 py-2">
                        <span>{d.label.charAt(0).toUpperCase() + d.label.slice(1)}</span>
                        <span className={`font-semibold tabular-nums ${d.delta > 0 ? "text-leaf" : "text-bad"}`}>
                          {signed(d.delta)} <span className="sr-only">{d.delta > 0 ? "in its favour" : "against it"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  lead.runnerUp && <p className="mt-2 text-sm">The two areas score almost the same on every measure; treat them as equally good bets.</p>
                )}
                {lead.runnerUp && <p className="mt-3 text-xs text-muted">Difference on each 0–100 measure, {lead.leader.locality} minus {lead.runnerUp.locality}. Cultural fit is audience affinity, not proven customer demand.</p>}
              </>
            ) : (
              <p className="mt-2 text-sm">This idea does not fit the budget in any area analysed.</p>
            )}
          </div>
        </div>
      )}

      {several && conceptIds.length > 0 && (
        <div className="card overflow-x-auto">
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
                    const t = o && hi > lo ? (o.scores.final - lo) / (hi - lo) : 0.5;
                    return (
                      <td key={l.name} className="p-1.5">
                        {o ? (
                          <span className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: o.verdict === "rejected" ? "transparent" : `rgba(31,138,106,${(0.06 + t * 0.22).toFixed(2)})` }}>
                            <span className={`font-display text-lg font-semibold tabular-nums ${o.id === result.winnerId ? "text-brand" : ""}`}>{score(o.scores.final)}</span>
                            {o.verdict !== "accepted" && <VerdictBadge verdict={o.verdict} />}
                            {o.id === result.winnerId && <span className="rounded-full bg-spark px-2 py-0.5 text-xs font-bold text-ink">Top pick</span>}
                          </span>
                        ) : (
                          <span className="px-2 text-muted">n/a</span>
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
