"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { AgentTrace, QlooCall } from "@/lib/schemas";
import { AGENT_INFO } from "@/lib/trace";
import { SourceBadge, StatusBadge } from "./badges";

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
    <li className="rounded-lg border border-line bg-paper p-2.5">
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

function AgentCard({ trace, defaultOpen }: { trace: AgentTrace; defaultOpen: boolean }) {
  const info = AGENT_INFO[trace.agent];
  const [open, setOpen] = useState(defaultOpen);
  const [showAllCalls, setShowAllCalls] = useState(false);
  const panelId = `agent-panel-${info.step}`;
  const calls = showAllCalls ? trace.qlooCalls : trace.qlooCalls.slice(0, 4);
  const latestNote = trace.notes.at(-1);

  return (
    <li
      className={`rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-colors ${
        trace.status === "running" ? "border-brand ring-2 ring-brand/15" : trace.status === "failed" ? "border-bad/50" : "border-line"
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 rounded-2xl p-4 text-left"
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            trace.status === "completed" ? "bg-leaf text-white" : trace.status === "running" ? "bg-brand text-white" : trace.status === "failed" ? "bg-bad text-white" : "bg-line text-muted"
          }`}
        >
          {trace.status === "completed" ? "✓" : info.step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-lg font-semibold">{trace.agent}</span>
            <StatusBadge status={trace.status} />
            {trace.durationMs !== undefined && trace.status === "completed" && (
              <span className="text-xs text-muted">{trace.durationMs < 1000 ? `${trace.durationMs} ms` : `${(trace.durationMs / 1000).toFixed(1)} s`}</span>
            )}
            {trace.qlooCalls.length > 0 && <span className="text-xs font-medium text-muted">{trace.qlooCalls.length} Qloo calls</span>}
          </span>
          <span className="mt-1 block text-sm text-muted">
            {trace.status === "completed" && trace.outputSummary
              ? trace.outputSummary
              : trace.status === "failed"
                ? `Failed: ${trace.error ?? "unknown error"}`
                : trace.status === "skipped"
                  ? (trace.warnings[0] ?? "Skipped")
                  : trace.status === "running" && latestNote
                    ? latestNote
                    : info.role}
          </span>
          {trace.status === "running" && !latestNote && (
            <span aria-hidden="true" className="mt-2 block space-y-1.5">
              <span className="skeleton block h-2.5 w-3/4" />
              <span className="skeleton block h-2.5 w-1/2" />
            </span>
          )}
        </span>
        <span aria-hidden="true" className={`mt-1 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div id={panelId} className="space-y-4 border-t border-line px-4 pb-4 pt-3 text-sm">
          <p className="text-muted">{info.role}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-paper p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Received</p>
              <p className="mt-1">{trace.inputSummary ?? "Waiting for the previous agent."}</p>
            </div>
            <div className="rounded-xl bg-paper p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Produced</p>
              <p className="mt-1">{trace.outputSummary ?? (trace.error ? `Nothing: ${trace.error}` : "Not finished yet.")}</p>
            </div>
          </div>

          {trace.notes.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">What it did</p>
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

          {trace.warnings.length > 0 && trace.status !== "skipped" && (
            <ul className="space-y-1 rounded-xl border border-warn/30 bg-warn-soft p-3 text-warn">
              {trace.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
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
      )}
    </li>
  );
}

export function AgentPipeline({ traces, running }: { traces: AgentTrace[]; running: boolean }) {
  const done = traces.filter((t) => t.status === "completed").length;
  const totalCalls = traces.reduce((n, t) => n + t.qlooCalls.length, 0);

  return (
    <section aria-labelledby="pipeline-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">Four agents, one recommendation</p>
          <h2 id="pipeline-heading" className="text-3xl font-semibold">
            Agent workflow
          </h2>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {running ? `Working… ${done} of 4 agents finished.` : `${done} of 4 agents finished · ${totalCalls} Qloo calls in total.`}
          </p>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line/70" role="progressbar" aria-label="Agents finished" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done}>
        <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-series-1" initial={false} animate={{ width: `${(done / 4) * 100}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
      </div>

      {/* Compact flow strip: who hands what to whom. */}
      <ol className="mt-4 hidden items-stretch gap-1 lg:flex" aria-label="How data flows between agents">
        {traces.map((trace, i) => {
          const info = AGENT_INFO[trace.agent];
          return (
            <li key={trace.agent} className="flex flex-1 items-center gap-1">
              <div
                className={`flex-1 rounded-xl border px-3 py-2 ${
                  trace.status === "completed" ? "border-leaf/40 bg-leaf-soft" : trace.status === "running" ? "border-brand bg-brand-soft" : trace.status === "failed" ? "border-bad/40 bg-bad-soft" : "border-line bg-card"
                }`}
              >
                <p className="text-xs font-bold">
                  {info.step}. {trace.agent}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted">Hands over: {info.handsOver.toLowerCase()}</p>
              </div>
              {i < traces.length - 1 && (
                <span aria-hidden="true" className={`text-lg ${trace.status === "completed" ? "text-leaf" : "text-line"}`}>
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <ol className="mt-4 space-y-3">
        {traces.map((trace) => (
          <AgentCard key={trace.agent} trace={trace} defaultOpen={false} />
        ))}
      </ol>
    </section>
  );
}
