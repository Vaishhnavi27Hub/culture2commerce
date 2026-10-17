"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DISCLAIMER } from "@/lib/brand";
import { RunRequestError, streamRun } from "@/lib/run-client";
import { runResultSchema, type AgentTrace, type RunInput, type RunResult } from "@/lib/schemas";
import { applyEvent, emptyTraces } from "@/lib/trace";
import { AgentPipeline } from "./agent-pipeline";
import { RunSourceBadge } from "./badges";
import { LocalityCompare, WithWithoutQloo } from "./compare";
import { InputForm, type ConceptOption } from "./input-form";
import { CollabCalculator, ComparisonPanel, NeighbourhoodPanel, PartnerList, PartnerStrategyCard, PricingPanel } from "./partners";
import { PartnerPlanView, PilotPlanView } from "./pilot-plan";
import { CityHero, HeroHeadline } from "./hero";
import { OptionDetail, RankedOptions, WinnerCard } from "./recommendation";
import { Reveal, SectionHeading, Stagger, StaggerItem } from "./ui";

type Stage = "input" | "agents" | "recommendation" | "plan";

const STAGES: { id: Stage; label: string }[] = [
  { id: "input", label: "Your idea" },
  { id: "agents", label: "Agents at work" },
  { id: "recommendation", label: "Recommendation" },
  { id: "plan", label: "Pitch & Pilot" },
];

const HOW_IT_WORKS = [
  { title: "Cultural fit", text: "Qloo taste relationships show which ideas resonate with the people who already spend time in each area.", tone: "bg-lavender text-lavender-ink" },
  { title: "Feasibility", text: "Budget, competition, logistics and venues are checked. Ideas that don’t fit are rejected with reasons.", tone: "bg-sage text-brand" },
  { title: "Validation", text: "The winner becomes a small real-world experiment with a continue, pivot or stop rule.", tone: "bg-spark-soft text-spark-dark" },
];

const STORAGE_KEY = "c2c:last-run";

interface Props {
  concepts: ConceptOption[];
  knownLocalities: Record<string, string[]>;
  /** What the server is configured to use, shown before the first run. */
  qlooStatus: "live" | "recorded" | "sample";
}

export function App({ concepts, knownLocalities, qlooStatus }: Props) {
  const [stage, setStage] = useState<Stage>("input");
  const [traces, setTraces] = useState<AgentTrace[]>(emptyTraces);
  const [result, setResult] = useState<RunResult | undefined>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [partnerId, setPartnerId] = useState<string | undefined>();
  const [planTab, setPlanTab] = useState<"solo" | "partner">("solo");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore the last run after a refresh (kept only in this browser tab).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = runResultSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        setResult(parsed.data);
        setTraces(parsed.data.agents);
        setSelectedId(parsed.data.winnerId ?? parsed.data.options[0]?.id);
      }
    } catch {
      // Storage can be unavailable (private mode); the app works without it.
    }
  }, []);

  const persist = (r: RunResult) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } catch {
      // ignore
    }
  };

  const scrollToId = (id: string, focusSelector?: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (focusSelector) el.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
  };

  const go = useCallback((next: Stage) => {
    setStage(next);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      headingRef.current?.focus();
    });
  }, []);

  const start = useCallback(
    async (input: RunInput) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(undefined);
      setIssues([]);
      setResult(undefined);
      setPartnerId(undefined);
      setPlanTab(input.launchMode === "partner" ? "partner" : "solo");
      setTraces(emptyTraces());
      setRunning(true);
      go("agents");
      try {
        const finished = await streamRun(input, (event) => setTraces((t) => applyEvent(t, event)), controller.signal);
        setResult(finished);
        setTraces(finished.agents);
        setSelectedId(finished.winnerId ?? finished.options[0]?.id);
        persist(finished);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof RunRequestError) {
          setError(err.message);
          setIssues(err.issues);
          if (err.issues.length > 0) go("input");
        } else {
          setError("Could not reach the server. Check your connection and try again.");
        }
      } finally {
        if (abortRef.current === controller) setRunning(false);
      }
    },
    [go],
  );

  const saveResults = (pilotResults: NonNullable<RunResult["pilotResults"]>) => {
    if (!result) return;
    const next = { ...result, pilotResults };
    setResult(next);
    persist(next);
  };

  const winner = result?.options.find((o) => o.id === result.winnerId);
  const selected = result?.options.find((o) => o.id === selectedId) ?? winner ?? result?.options[0];
  const available: Record<Stage, boolean> = {
    input: true,
    agents: running || Boolean(result) || Boolean(error),
    recommendation: Boolean(result && result.options.length > 0),
    plan: Boolean(result?.pilotPlan || result?.partnerPlan),
  };
  const shownSource = result?.qlooSource ?? qlooStatus;
  const categoryOf = (conceptId: string) => concepts.find((c) => c.id === conceptId)?.category;
  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <nav aria-label="Steps" className="no-print sticky top-0 z-20 -mx-4 border-b border-line/70 bg-paper/90 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ol className="flex flex-wrap gap-1">
            {STAGES.map((s, i) => {
              const current = stage === s.id;
              const done = i < stageIndex && available[s.id];
              return (
                <li key={s.id}>
                  <button suppressHydrationWarning
                    type="button"
                    disabled={!available[s.id]}
                    aria-current={current ? "step" : undefined}
                    onClick={() => go(s.id)}
                    className={`relative flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      current ? "text-white" : "text-ink hover:bg-brand-soft/70"
                    }`}
                  >
                    {current && <motion.span layoutId="stage-pill" className="absolute inset-0 rounded-full bg-brand shadow-sm" transition={{ type: "spring", stiffness: 450, damping: 36 }} />}
                    <span aria-hidden="true" className={`relative flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${current ? "bg-white/20" : done ? "bg-leaf text-white" : "bg-line"}`}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="relative">{s.label}</span>
                    {s.id === "agents" && running && <span aria-hidden="true" className="animate-status relative h-2 w-2 rounded-full bg-current" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <RunSourceBadge source={shownSource} />
        </div>
      </nav>

      <main className={stage === "input" ? "pt-0" : "pt-8"}>
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stage} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
        {stage === "input" && (
          <div>
            <CityHero onDiscover={() => scrollToId("plan-form", "input, button")} onExplore={() => scrollToId("examples")}>
              <HeroHeadline ref={headingRef} />
            </CityHero>

            <section aria-labelledby="how-heading" className="mt-6 sm:mt-10">
              <Reveal>
                <SectionHeading id="how-heading" eyebrow="How it works" title="From what people love to a tested idea" subtitle="Four agents do the research; you get one clear bet and a small, low-risk way to test it." />
              </Reveal>
              <Stagger as="ol" className="mt-6 grid gap-3 md:grid-cols-3">
                {HOW_IT_WORKS.map((h, i) => (
                  <StaggerItem as="li" key={h.title}>
                    <div className="card lift h-full p-5">
                      <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-lg font-semibold ${h.tone}`}>
                        {i + 1}
                      </span>
                      <p className="mt-3 font-display text-xl font-semibold">{h.title}</p>
                      <p className="mt-1 text-sm text-muted">{h.text}</p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              {qlooStatus !== "live" && (
                <p className="mt-4 rounded-2xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
                  {qlooStatus === "recorded"
                    ? "The live Qloo API is not configured, so runs use a recorded Qloo snapshot."
                    : "No Qloo API key is configured, so runs use bundled sample data. Results are illustrative, not real Qloo signals."}
                </p>
              )}
            </section>

            <section id="plan-form" aria-labelledby="form-heading" className="mt-12 scroll-mt-20 sm:mt-16">
              <Reveal>
                <div className="rounded-[1.75rem] border border-line bg-card p-5 shadow-[var(--shadow-lift)] sm:p-8">
                  <SectionHeading id="form-heading" eyebrow="Discover my opportunity" title="Tell us where, how much and what you might sell" subtitle="Takes about a minute. Nothing personal is needed." />
                  <div className="mt-8">
                    <InputForm concepts={concepts} knownLocalities={knownLocalities} busy={running} serverIssues={issues} onSubmit={start} />
                  </div>
                </div>
              </Reveal>
            </section>
          </div>
        )}

        {stage === "agents" && (
          <div className="space-y-6">
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
              Agents at work
            </h1>
            {error && (
              <div role="alert" className="rounded-2xl border border-bad/30 bg-bad-soft p-4 text-bad">
                <p className="font-semibold">The run could not finish.</p>
                <p className="mt-1 text-sm">{error}</p>
                <button suppressHydrationWarning type="button" onClick={() => go("input")} className="mt-3 rounded-xl bg-bad px-4 py-2 text-sm font-semibold text-white">
                  Back to inputs
                </button>
              </div>
            )}
            <AgentPipeline traces={traces} running={running} />
            {result && (
              <div className="animate-rise card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="font-semibold">
                    {result.status === "completed" ? "All done." : result.status === "partial" ? "Finished with reduced detail." : "The run stopped early."}{" "}
                    <span className="font-normal text-muted">
                      {result.qlooCallCounts.live} live, {result.qlooCallCounts.recorded} recorded and {result.qlooCallCounts.sample} sample Qloo calls.
                    </span>
                  </p>
                  {result.message && <p className="mt-1 text-sm text-warn">{result.message}</p>}
                </div>
                {available.recommendation && (
                  <button suppressHydrationWarning type="button" onClick={() => go("recommendation")} className="btn-primary mt-3 w-full shrink-0 px-5 py-3 text-sm sm:mt-0 sm:w-auto">
                    See the recommendation <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {stage === "recommendation" && result && (
          <div className="space-y-10">
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
              Recommendation
            </h1>
            {result.message && <p className="rounded-2xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">{result.message}</p>}

            {result.comparison && <ComparisonPanel comparison={result.comparison} />}

            {result.input.launchMode !== "solo" && (
              <PartnerStrategyCard
                result={result}
                onOpenPlan={() => {
                  setPlanTab("partner");
                  go("plan");
                }}
              />
            )}

            {result.input.launchMode !== "partner" &&
              (winner ? (
                <WinnerCard
                  result={result}
                  winner={winner}
                  onOpenPlan={() => {
                    setPlanTab("solo");
                    go("plan");
                  }}
                />
              ) : (
                <div className="rounded-2xl border border-bad/30 bg-bad-soft p-5">
                  <h2 className="text-2xl font-semibold text-bad">No solo option fits this budget</h2>
                  <p className="mt-1 text-sm">Each option below shows why. Try a larger budget, fewer weekends, a simpler idea, or a partnership.</p>
                </div>
              ))}

            {result.input.launchMode !== "solo" && result.partners.length > 0 && (
              <>
                <PartnerList result={result} selectedId={partnerId} onSelect={setPartnerId} />
                <CollabCalculator result={result} partnerId={partnerId} />
              </>
            )}

            <PricingPanel result={result} />
            <NeighbourhoodPanel result={result} />

            {result.input.launchMode === "partner" && (
              <div className="border-t border-line pt-8">
                <SectionHeading title="Cultural analysis of the areas" subtitle="How each idea fits each locality’s audience if you ran it yourself. This is what the partner search builds on." />
              </div>
            )}

            <Reveal>
              <LocalityCompare result={result} />
            </Reveal>

            <section aria-labelledby="ranked-heading" className="space-y-6">
              <SectionHeading
                id="ranked-heading"
                level={3}
                eyebrow="Compare every option"
                title="All options, ranked"
                subtitle="Search or filter, then select an option to see its cultural signals, budget and the reasoning behind its score."
              />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_1fr]">
                <div className="xl:sticky xl:top-20 xl:self-start">
                  <RankedOptions result={result} selectedId={selected?.id ?? ""} onSelect={setSelectedId} categoryOf={categoryOf} />
                </div>
                {selected && result.weights && <OptionDetail result={result} option={selected} weights={result.weights} />}
              </div>
            </section>

            {winner && (
              <Reveal>
                <WithWithoutQloo result={result} winner={winner} />
              </Reveal>
            )}
          </div>
        )}

        {stage === "plan" && result && (result.pilotPlan || result.partnerPlan) && (
          <div className="space-y-5">
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
              Pilot plan
            </h1>
            {result.pilotPlan && result.partnerPlan && (
              <div className="no-print inline-flex rounded-xl border border-line bg-card p-1 shadow-sm" role="tablist" aria-label="Choose a pilot plan">
                {(
                  [
                    ["solo", "On your own"],
                    ["partner", "With a partner"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={planTab === value}
                    onClick={() => setPlanTab(value)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${planTab === value ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
                  >
                    {label}
                    {result.comparison?.recommended === value && <span className="ml-1.5 rounded-full bg-spark px-1.5 py-0.5 text-[10px] text-ink">Recommended</span>}
                  </button>
                ))}
              </div>
            )}
            {result.partnerPlan && (planTab === "partner" || !result.pilotPlan) ? (
              <PartnerPlanView result={result} plan={result.partnerPlan} onEditInputs={() => go("input")} />
            ) : (
              result.pilotPlan && <PilotPlanView result={result} plan={result.pilotPlan} onSaveResults={saveResults} onEditInputs={() => go("input")} />
            )}
          </div>
        )}

        </motion.div>
        </AnimatePresence>
        <p className="mt-12 border-t border-line pt-4 text-center text-xs text-muted">{DISCLAIMER}</p>
      </main>
    </div>
    </MotionConfig>
  );
}
