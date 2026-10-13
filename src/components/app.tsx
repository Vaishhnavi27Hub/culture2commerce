"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DISCLAIMER } from "@/lib/brand";
import { RunRequestError, streamRun } from "@/lib/run-client";
import { runResultSchema, type AgentTrace, type RunInput, type RunResult } from "@/lib/schemas";
import { applyEvent, emptyTraces } from "@/lib/trace";
import { AgentPipeline } from "./agent-pipeline";
import { RunSourceBadge } from "./badges";
import { LocalityCompare, WithWithoutQloo } from "./compare";
import { InputForm, type ConceptOption } from "./input-form";
import { PilotPlanView } from "./pilot-plan";
import { ConfidencePanel, EvidenceTrail, RankedOptions, ScoreBreakdown, WinnerCard } from "./recommendation";

type Stage = "input" | "agents" | "recommendation" | "plan";

const STAGES: { id: Stage; label: string }[] = [
  { id: "input", label: "Your idea" },
  { id: "agents", label: "Agents at work" },
  { id: "recommendation", label: "Recommendation" },
  { id: "plan", label: "Pilot plan" },
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
    plan: Boolean(result?.pilotPlan),
  };
  const shownSource = result?.qlooSource ?? qlooStatus;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <nav aria-label="Steps" className="no-print sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ol className="flex flex-wrap gap-1.5">
            {STAGES.map((s, i) => {
              const current = stage === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!available[s.id]}
                    aria-current={current ? "step" : undefined}
                    onClick={() => go(s.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                      current ? "border-brand bg-brand text-white" : "border-line bg-card text-ink hover:border-brand"
                    }`}
                  >
                    <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${current ? "bg-white/25" : "bg-line"}`}>
                      {i + 1}
                    </span>
                    {s.label}
                    {s.id === "agents" && running && <span aria-hidden="true" className="animate-status h-2 w-2 rounded-full bg-current" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <RunSourceBadge source={shownSource} />
        </div>
      </nav>

      <main className="pt-8">
        {stage === "input" && (
          <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
            <div>
              <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold leading-tight outline-none sm:text-5xl">
                Find one small business bet <span className="text-brand">worth testing.</span>
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-muted">
                Tell us your city, budget and a few ideas. Four agents use Qloo’s taste graph and local cost estimates to recommend a specific concept, locality, audience and a
                low-cost pilot.
              </p>
              <div className="mt-8">
                <InputForm concepts={concepts} knownLocalities={knownLocalities} busy={running} serverIssues={issues} onSubmit={start} />
              </div>
            </div>
            <aside aria-label="How it works" className="space-y-3 lg:pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">How it works</p>
              {[
                ["Cultural fit", "Qloo taste relationships show which ideas resonate with the people who already spend time in each area."],
                ["Feasibility", "Budget, competition, logistics and venues are checked. Ideas that don’t fit are rejected with reasons."],
                ["Validation", "The winner becomes a small real-world experiment with a continue, pivot or stop rule."],
              ].map(([title, text], i) => (
                <div key={title} className="rounded-2xl border border-line bg-card p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-spark text-xs font-bold text-ink">
                      {i + 1}
                    </span>
                    {title}
                  </p>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              ))}
              {qlooStatus !== "live" && (
                <p className="rounded-2xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
                  {qlooStatus === "recorded"
                    ? "The live Qloo API is not configured, so runs use a recorded Qloo snapshot."
                    : "No Qloo API key is configured, so runs use bundled sample data. Results are illustrative, not real Qloo signals."}
                </p>
              )}
            </aside>
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
                <button type="button" onClick={() => go("input")} className="mt-3 rounded-xl bg-bad px-4 py-2 text-sm font-semibold text-white">
                  Back to inputs
                </button>
              </div>
            )}
            <AgentPipeline traces={traces} running={running} />
            {result && (
              <div className="animate-rise rounded-2xl border border-line bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
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
                  <button type="button" onClick={() => go("recommendation")} className="mt-3 inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark sm:mt-0 sm:w-auto">
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
            {winner ? (
              <WinnerCard result={result} winner={winner} onOpenPlan={() => go("plan")} />
            ) : (
              <div className="rounded-2xl border border-bad/30 bg-bad-soft p-5">
                <h2 className="text-2xl font-bold text-bad">No option fits this budget</h2>
                <p className="mt-1 text-sm">Each option below shows why. Try a larger budget, fewer weekends or a simpler idea.</p>
              </div>
            )}

            {winner && <WithWithoutQloo result={result} winner={winner} />}

            <section aria-labelledby="ranked-heading">
              <h3 id="ranked-heading" className="text-xl font-bold">
                All options, ranked
              </h3>
              <p className="mt-1 text-sm text-muted">Select any option to see its scores and evidence below.</p>
              <div className="mt-4">
                <RankedOptions result={result} selectedId={selected?.id ?? ""} onSelect={setSelectedId} />
              </div>
            </section>

            {selected && result.weights && (
              <section aria-labelledby="why-heading" className="space-y-4" aria-live="polite">
                <div>
                  <h3 id="why-heading" className="text-xl font-bold">
                    Why this? <span className="font-normal text-muted">{selected.conceptLabel} in {selected.locality}</span>
                  </h3>
                  <p className="mt-1 text-sm text-muted">{selected.hypothesis}</p>
                </div>
                <ScoreBreakdown option={selected} weights={result.weights} />
                <ConfidencePanel option={selected} />
                <div>
                  <p className="mb-2 text-sm font-semibold">Evidence trail</p>
                  <EvidenceTrail option={selected} />
                </div>
              </section>
            )}

            <LocalityCompare result={result} />
          </div>
        )}

        {stage === "plan" && result?.pilotPlan && (
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
              Pilot plan
            </h1>
            <PilotPlanView result={result} plan={result.pilotPlan} onSaveResults={saveResults} />
          </div>
        )}

        <p className="mt-12 border-t border-line pt-4 text-center text-xs text-muted">{DISCLAIMER}</p>
      </main>
    </div>
  );
}
