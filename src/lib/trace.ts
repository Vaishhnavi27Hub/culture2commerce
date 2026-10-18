import { AGENT_NAMES, type AgentEvent, type AgentName, type AgentTrace } from "./schemas";

/** Static description of each agent for the workflow view. */
export const AGENT_INFO: Record<AgentName, { step: number; purpose: string; role: string; handsOver: string; usesQloo: boolean }> = {
  "Local Researcher": {
    purpose: "Research locally",
    step: 1,
    role: "Finds candidate areas, their most popular venues, existing competitors, stall fees and permit notes.",
    handsOver: "Locality profiles with anchor venues",
    usesQloo: true,
  },
  "Cultural Opportunity Finder": {
    purpose: "Find cultural fit",
    step: 2,
    role: "Uses Qloo affinities to test how well each idea fits the people who spend time in each area.",
    handsOver: "Cultural-fit scores with evidence",
    usesQloo: true,
  },
  "Feasibility Critic": {
    purpose: "Evaluate feasibility",
    step: 3,
    role: "Costs every option against your budget, then downgrades or rejects what does not fit.",
    handsOver: "Ranked options and the winner",
    usesQloo: false,
  },
  "Pilot Planner": {
    purpose: "Plan a pilot",
    step: 4,
    role: "Turns the winner into a small experiment with quantities, prices, a schedule and a continue, pivot or stop rule.",
    handsOver: "Pilot plan",
    usesQloo: false,
  },
};

export function emptyTraces(): AgentTrace[] {
  return AGENT_NAMES.map((agent) => ({ agent, status: "queued", notes: [], qlooCalls: [], dataSources: [], warnings: [] }));
}

/** Folds one streamed event into the per-agent view state. Pure. */
export function applyEvent(traces: AgentTrace[], event: AgentEvent): AgentTrace[] {
  return traces.map((trace) => {
    if (trace.agent !== event.agent) return trace;
    const next: AgentTrace = { ...trace, status: event.status };
    if (event.note) next.notes = [...trace.notes, event.note];
    if (event.inputSummary) next.inputSummary = event.inputSummary;
    if (event.outputSummary) next.outputSummary = event.outputSummary;
    if (event.qlooCalls.length) next.qlooCalls = event.qlooCalls;
    if (event.dataSources.length) next.dataSources = event.dataSources;
    if (event.durationMs !== undefined) next.durationMs = event.durationMs;
    if (event.warnings.length) next.warnings = event.warnings;
    if (event.error) next.error = event.error;
    return next;
  });
}
