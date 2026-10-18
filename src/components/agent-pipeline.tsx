"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { AgentTrace, QlooCall } from "@/lib/schemas";
import { AGENT_INFO } from "@/lib/trace";
import { SourceBadge, StatusBadge } from "./badges";
import { Disclosure } from "./ui";

const METHOD_LABEL: Record<string, string> = {
  searchEntities: "Look up an entity",
  searchTags: "Look up tags",
  getLocalityPlaces: "Popular places in the area",
  getPlacesByTag: "Existing competitors nearby",
  getAudienceAffinity: "Concept affinity for the local audience",
  getTasteTags: "Genres the audience over-indexes on",
  getBrandAffinity: "Brands the audience favours",
  getDemographics: "Audience demographics",
};

/** Shortens long ID lists so a call fits on one line. The API key is never part of a call record. */
function shortParams(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => {
      const parts = value.split(",");
      const shown = parts.length > 2 ? `${parts[0]}, … (${parts.length} ids)` : value;
      return `${key}=${shown.length > 70 ? `${shown.slice(0, 67)}…` : shown}`;
    })
    .join("  ");
}

function QlooCallRow({ call }: { call: QlooCall }) {
  return (
    <li className="rounded-lg border border-line bg-card p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{METHOD_LABEL[call.method] ?? call.method}</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {call.resultCount} {call.resultCount === 1 ? "result" : "results"}
          {call.source === "live" && <span>· {call.cached ? "cached" : `${call.durationMs} ms`}</span>}
          <SourceBadge source={call.source} />
        </span>
      </div>
      <code className="mt-1.5 block overflow-x-auto whitespace-pre text-[11px] leading-5 text-muted">
        GET {call.endpoint}  {shortParams(call.params)}
      </code>
      {call.fallbackReason && <p className="mt-1 text-xs text-warn">Fallback reason: {call.fallbackReason}</p>}
    </li>
  );
}

function AgentCard({ trace, next }: { trace: AgentTrace; next: AgentTrace | undefined }) {
  const info = AGENT_INFO[trace.agent];
  const [showAllCalls, setShowAllCalls] = useState(false);
  const calls = showAllCalls ? trace.qlooCalls : trace.qlooCalls.slice(0, 4);
  const latestNote = trace.notes.at(-1);
  const active = trace.status === "running";
  // Plain-language headline for the card: what this agent found, or what it is doing now.
  const finding =
    trace.status === "completed"
      ? trace.outputSummary
      : trace.status === "failed"
        ? `Could not finish: ${trace.error ?? "unknown error"}`
        : trace.status === "skipped"
          ? (trace.warnings[0] ?? "Skipped because an earlier step did not finish.")
          : active
            ? latestNote
            : undefined;
  const userWarnings = trace.status === "skipped" ? [] : trace.warnings;

  return (
    <motion.li
      layout="position"
      className={`relative rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-colors duration-300 ${
        active ? "border-brand ring-2 ring-brand/20" : trace.status === "failed" ? "border-bad/50" : trace.status === "completed" ? "border-leaf/30" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span
          aria-hidden="true"
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${
            trace.status === "completed" ? "bg-leaf text-on-brand" : active ? "bg-brand text-on-brand" : trace.status === "failed" ? "bg-bad text-on-brand" : "bg-line text-muted"
          }`}
        >
          {active && <span className="animate-ping-soft absolute inset-0 rounded-full bg-brand/40" />}
          <span className="relative">{trace.status === "completed" ? "✓" : trace.status === "failed" ? "!" : info.step}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-display text-lg font-semibold leading-tight">{trace.agent}</h3>
            <StatusBadge status={trace.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-semibold text-ink">{info.purpose}.</span> {info.role}
          </p>

          <AnimatePresence initial={false} mode="wait">
            {finding && (
              <motion.p
                key={finding}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`mt-3 rounded-xl px-3 py-2.5 text-sm ${
                  trace.status === "failed" ? "bg-bad-soft text-bad" : trace.status === "completed" ? "bg-leaf-soft text-ink" : trace.status === "skipped" ? "bg-paper text-muted" : "bg-brand-soft/60 text-ink"
                }`}
              >
                {trace.status === "completed" && <span className="font-semibold">Found: </span>}
                {finding}
              </motion.p>
            )}
          </AnimatePresence>
          {active && !latestNote && (
            <span aria-hidden="true" className="mt-2 block space-y-1.5">
              <span className="skeleton block h-2.5 w-3/4" />
              <span className="skeleton block h-2.5 w-1/2" />
            </span>
          )}

          {userWarnings.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
              {userWarnings.map((w, i) => (
                <li key={i} className="flex gap-1.5">
                  <span aria-hidden="true">⚠</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          {trace.status === "completed" && next && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted">
              <span aria-hidden="true" className="text-leaf">↳</span> Handed to {next.agent}: {info.handsOver.toLowerCase()}
            </p>
          )}

          {(trace.status !== "queued" || trace.qlooCalls.length > 0) && (
            <Disclosure className="mt-3" title="View technical details" hint={`Inputs, outputs, activity log${trace.qlooCalls.length ? ` and ${trace.qlooCalls.length} Qloo calls` : ""}`}>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">Received</p>
                    <p className="mt-1">{trace.inputSummary ?? "Waiting for the previous agent."}</p>
                  </div>
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">Produced</p>
                    <p className="mt-1">{trace.outputSummary ?? (trace.error ? `Nothing: ${trace.error}` : "Not finished yet.")}</p>
                  </div>
                </div>
                {trace.durationMs !== undefined && <p className="text-xs text-muted">Took {trace.durationMs < 1000 ? `${trace.durationMs} ms` : `${(trace.durationMs / 1000).toFixed(1)} s`}.</p>}
                {trace.notes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">Activity log</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {trace.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {trace.dataSources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">Data used</span>
                    {trace.dataSources.map((s) => (
                      <SourceBadge key={s} source={s} long />
                    ))}
                  </div>
                )}
                {trace.qlooCalls.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">Qloo calls ({trace.qlooCalls.length})</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {calls.map((call, i) => (
                        <QlooCallRow key={i} call={call} />
                      ))}
                    </ul>
                    {trace.qlooCalls.length > 4 && (
                      <button type="button" onClick={() => setShowAllCalls((s) => !s)} className="mt-2 text-sm font-semibold text-brand hover:underline">
                        {showAllCalls ? "Show fewer calls" : `Show all ${trace.qlooCalls.length} calls`}
                      </button>
                    )}
                  </div>
                ) : (
                  trace.status === "completed" &&
                  !info.usesQloo && <p className="text-muted">This agent makes no Qloo calls. It works only with what the earlier agents found, plus cost estimates.</p>
                )}
              </div>
            </Disclosure>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export function AgentPipeline({ traces, running }: { traces: AgentTrace[]; running: boolean }) {
  const done = traces.filter((t) => t.status === "completed").length;
  const finished = traces.filter((t) => t.status === "completed" || t.status === "failed" || t.status === "skipped").length;
  const totalCalls = traces.reduce((n, t) => n + t.qlooCalls.length, 0);
  const activeAgent = traces.find((t) => t.status === "running");

  return (
    <section aria-labelledby="pipeline-heading">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">Four agents, one recommendation</p>
      <h1 id="pipeline-heading" tabIndex={-1} className="text-3xl font-semibold outline-none sm:text-4xl">
        {running ? "Discovering your opportunity" : "Your agents have finished"}
      </h1>
      <p className="mt-1.5 max-w-2xl text-muted">
        Four AI agents work in sequence: each one hands its findings to the next, from local research to a pilot you can run.
      </p>
      <p className="mt-3 text-sm font-medium" aria-live="polite">
        {running
          ? `${done} of 4 agents finished${activeAgent ? ` · now: ${activeAgent.agent}` : ""}`
          : `${done} of 4 agents completed${finished > done ? `, ${finished - done} did not` : ""} · ${totalCalls} Qloo calls in total`}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70" role="progressbar" aria-label="Agents finished" aria-valuemin={0} aria-valuemax={4} aria-valuenow={finished}>
        <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-series-1" initial={false} animate={{ width: `${(finished / 4) * 100}%` }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
      </div>

      {/* Flow strip: who hands what to whom. */}
      <ol className="mt-5 hidden items-stretch gap-1 lg:flex" aria-label="How information flows between agents">
        {traces.map((trace, i) => {
          const info = AGENT_INFO[trace.agent];
          return (
            <li key={trace.agent} className="flex flex-1 items-center gap-1">
              <div
                className={`flex-1 rounded-xl border px-3 py-2 transition-colors duration-300 ${
                  trace.status === "completed" ? "border-leaf/40 bg-leaf-soft" : trace.status === "running" ? "border-brand bg-brand-soft" : trace.status === "failed" ? "border-bad/40 bg-bad-soft" : "border-line bg-card"
                }`}
              >
                <p className="text-xs font-bold">
                  {info.step}. {info.purpose}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted">Hands over: {info.handsOver.toLowerCase()}</p>
              </div>
              {i < traces.length - 1 && (
                <motion.span aria-hidden="true" animate={{ opacity: trace.status === "completed" ? 1 : 0.35 }} transition={{ duration: 0.35 }} className={`text-lg ${trace.status === "completed" ? "text-leaf" : "text-muted"}`}>
                  →
                </motion.span>
              )}
            </li>
          );
        })}
      </ol>

      <ol className="mt-5 space-y-3">
        {traces.map((trace, i) => (
          <AgentCard key={trace.agent} trace={trace} next={traces[i + 1]} />
        ))}
      </ol>
    </section>
  );
}
