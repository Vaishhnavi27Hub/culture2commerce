import { randomUUID } from "node:crypto";
import { DISCLAIMER } from "@/lib/brand";
import {
  AGENT_NAMES,
  runInputSchema,
  runResultSchema,
  type AgentEvent,
  type AgentName,
  type AgentTrace,
  type CulturalOutput,
  type DataSource,
  type FeasibilityOutput,
  type LocalResearchOutput,
  type Narrative,
  type PilotPlan,
  type QlooCall,
  type RunInput,
  type RunResult,
} from "@/lib/schemas";
import { culturalOpportunityFinder, neutralOpportunities } from "./agents/cultural-opportunity-finder";
import { feasibilityCritic, type FeasibilityInput } from "./agents/feasibility-critic";
import { localResearcher, type LocalResearchInput } from "./agents/local-researcher";
import { pilotPlanner, type PilotPlanInput } from "./agents/pilot-planner";
import { inr, uniq, type Agent, type AgentContext } from "./agents/types";
import { getConcept, type Concept } from "./data/concepts";
import { buildBaseline, buildNarrativeFacts, templateNarrative, type NarrativeFacts } from "./llm/templates";
import { getQlooClient } from "./qloo";
import { bindAll } from "./qloo/recorded";
import type { QlooClient, QlooMethodName, QlooMethods, Sourced } from "./qloo/types";

/**
 * Runs the four agents in order and reports every state change as an event:
 *
 *   Local Researcher → Cultural Opportunity Finder → Feasibility Critic → Pilot Planner
 *
 * One agent failing never crashes the run. Where possible the pipeline continues with
 * degraded output; otherwise later agents are marked `skipped` and the result explains why.
 */

export interface PipelineAgents {
  localResearcher: Agent<LocalResearchInput, LocalResearchOutput>;
  culturalOpportunityFinder: Agent<LocalResearchOutput, CulturalOutput>;
  feasibilityCritic: Agent<FeasibilityInput, FeasibilityOutput>;
  pilotPlanner: Agent<PilotPlanInput, PilotPlan>;
}

export interface RunOptions {
  qloo?: QlooClient;
  onEvent?: (event: AgentEvent) => void;
  /** Optional narrative writer (LLM). Must only rephrase the given facts. Falls back to templates. */
  narrate?: (facts: NarrativeFacts) => Promise<Narrative>;
  runId?: string;
  now?: () => Date;
  /** Replace individual agents (used by tests to simulate failures). */
  agents?: Partial<PipelineAgents>;
}

const SOURCE_RANK = { live: 0, recorded: 1, sample: 2 } as const;

function safeMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : "Unexpected error";
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

/** Wraps a Qloo client so every call an agent makes is logged for the trace. */
function withCallLog(client: QlooClient, sink: QlooCall[]): QlooClient {
  return bindAll(async <M extends QlooMethodName>(method: M, args: QlooMethods[M]["args"]) => {
    const fn = client[method] as (a: QlooMethods[M]["args"]) => Promise<Sourced<QlooMethods[M]["result"]>>;
    const result = await fn(args);
    sink.push(result.call);
    return result;
  });
}

export async function runPipeline(rawInput: unknown, options: RunOptions = {}): Promise<RunResult> {
  const input: RunInput = runInputSchema.parse(rawInput);
  const now = options.now ?? (() => new Date());
  const runId = options.runId ?? randomUUID();
  const startedAt = now().toISOString();
  const qloo = options.qloo ?? getQlooClient();
  const agents: PipelineAgents = {
    localResearcher,
    culturalOpportunityFinder,
    feasibilityCritic,
    pilotPlanner,
    ...options.agents,
  };

  const concepts = input.conceptIds.map(getConcept).filter((c): c is Concept => Boolean(c));
  const unknownConcepts = input.conceptIds.filter((id) => !getConcept(id));

  const traces = new Map<AgentName, AgentTrace>(
    AGENT_NAMES.map((agent) => [agent, { agent, status: "queued", notes: [], qlooCalls: [], dataSources: [], warnings: [] }]),
  );
  let seq = 0;
  const emit = (agent: AgentName, patch: Partial<AgentEvent> & Pick<AgentEvent, "status">) => {
    const event: AgentEvent = {
      runId,
      seq: seq++,
      timestamp: now().toISOString(),
      agent,
      qlooCalls: [],
      dataSources: [],
      warnings: [],
      ...patch,
    };
    try {
      options.onEvent?.(event);
    } catch {
      // A broken listener (e.g. a closed stream) must not stop the run.
    }
  };

  for (const agent of AGENT_NAMES) emit(agent, { status: "queued" });

  /** Runs one agent with event reporting. Returns undefined when it fails. */
  async function step<I, O>(
    name: AgentName,
    fn: Agent<I, O>,
    agentInput: I,
    describe: {
      input: string;
      output: (out: O) => string;
      warnings?: (out: O) => string[];
      extraSources?: DataSource[];
    },
  ): Promise<O | undefined> {
    const trace = traces.get(name)!;
    const calls: QlooCall[] = [];
    const started = Date.now();
    trace.status = "running";
    trace.inputSummary = describe.input;
    emit(name, { status: "running", inputSummary: describe.input });
    const ctx: AgentContext = {
      qloo: withCallLog(qloo, calls),
      input,
      concepts,
      note: (text) => {
        trace.notes.push(text);
        emit(name, { status: "running", note: text });
      },
    };
    const sourcesSoFar = (): DataSource[] => uniq([...calls.map((c) => c.source as DataSource), ...(describe.extraSources ?? [])]);
    try {
      const out = await fn(agentInput, ctx);
      Object.assign(trace, {
        status: "completed",
        outputSummary: describe.output(out),
        qlooCalls: calls,
        dataSources: sourcesSoFar(),
        durationMs: Date.now() - started,
        warnings: uniq([
          ...(describe.warnings?.(out) ?? []),
          ...uniq(calls.filter((c) => c.fallbackReason).map((c) => `Qloo fallback used (${c.fallbackReason})`)),
        ]),
      } satisfies Partial<AgentTrace>);
      emit(name, {
        status: "completed",
        outputSummary: trace.outputSummary,
        qlooCalls: calls,
        dataSources: trace.dataSources,
        durationMs: trace.durationMs,
        warnings: trace.warnings,
      });
      return out;
    } catch (err) {
      Object.assign(trace, {
        status: "failed",
        qlooCalls: calls,
        dataSources: sourcesSoFar(),
        durationMs: Date.now() - started,
        error: safeMessage(err),
      } satisfies Partial<AgentTrace>);
      emit(name, { status: "failed", qlooCalls: calls, dataSources: trace.dataSources, durationMs: trace.durationMs, error: trace.error });
      return undefined;
    }
  }

  const skip = (name: AgentName, reason: string) => {
    const trace = traces.get(name)!;
    trace.status = "skipped";
    trace.warnings = [reason];
    emit(name, { status: "skipped", warnings: [reason] });
  };

  let status: RunResult["status"] = "completed";
  let message: string | undefined;
  let local: LocalResearchOutput | undefined;
  let cultural: CulturalOutput | undefined;
  let feasible: FeasibilityOutput | undefined;
  let pilotPlan: PilotPlan | undefined;
  let narrative: Narrative | undefined;

  const conceptNames = concepts.map((c) => c.label.toLowerCase()).join(", ");

  if (concepts.length === 0) {
    status = "failed";
    message = "None of the selected business ideas are in the catalogue.";
    for (const agent of AGENT_NAMES) skip(agent, message);
  } else {
    // 1. Local Researcher
    local = await step("Local Researcher", agents.localResearcher, { city: input.city, localities: input.localities }, {
      input: `${input.city}; ${input.localities.length ? input.localities.join(", ") : "localities to be suggested"}; checking ${conceptNames}`,
      output: (o) =>
        `${o.localities.length} ${o.localities.length === 1 ? "area" : "areas"} profiled: ` +
        o.localities.map((l) => `${l.name} (${l.anchors.length} anchor venues)`).join(", "),
      warnings: (o) => [...o.warnings, ...unknownConcepts.map((id) => `Unknown business idea ignored: ${id}`)],
      extraSources: ["estimate"],
    });

    if (!local) {
      status = "failed";
      message = "The Local Researcher could not find usable data, so the run stopped.";
      for (const agent of AGENT_NAMES.slice(1)) skip(agent, "Skipped because the Local Researcher failed.");
    } else {
      // 2. Cultural Opportunity Finder (degrades to neutral scores on failure)
      cultural = await step("Cultural Opportunity Finder", agents.culturalOpportunityFinder, local, {
        input: `${local.localities.length} locality profiles × ${concepts.length} concepts; interests: ${input.interests.join(", ") || "none given"}`,
        output: (o) => {
          const best = [...o.opportunities].sort((a, b) => b.culturalFit - a.culturalFit)[0];
          const label = best ? concepts.find((c) => c.id === best.conceptId)?.label.toLowerCase() : undefined;
          return `${o.opportunities.length} concept-locality pairs scored` + (best ? `; strongest cultural fit: ${label} in ${best.locality} (${best.culturalFit})` : "");
        },
        warnings: (o) => o.warnings,
      });
      if (!cultural) {
        status = "partial";
        message = "Cultural analysis failed, so neutral cultural-fit scores were used. Treat the ranking with caution.";
        cultural = neutralOpportunities(local, concepts);
      }

      // 3. Feasibility Critic
      feasible = await step("Feasibility Critic", agents.feasibilityCritic, { local, cultural }, {
        input: `${cultural.opportunities.length} options; budget ${inr(input.budgetInr)}; ${input.weekends} ${input.weekends === 1 ? "weekend" : "weekends"}; ${input.riskPreference} risk`,
        output: (o) => {
          const winner = o.options.find((x) => x.id === o.winnerId);
          const rejected = o.options.filter((x) => x.verdict === "rejected").length;
          return winner
            ? `Top pick: ${winner.conceptLabel.toLowerCase()} in ${winner.locality} (${winner.scores.final}/100); ${rejected} rejected`
            : `No option fits the budget; ${rejected} rejected`;
        },
        warnings: (o) => o.warnings,
        extraSources: ["estimate", "user"],
      });

      if (!feasible) {
        status = "failed";
        message = "The Feasibility Critic failed, so no recommendation could be made.";
        skip("Pilot Planner", "Skipped because the Feasibility Critic failed.");
      } else {
        const winner = feasible.options.find((o) => o.id === feasible!.winnerId);
        const profile = winner ? local.localities.find((l) => l.name === winner.locality) : undefined;
        if (!winner || !profile) {
          message = "No option fits the budget. See the reasons on each option, then try a larger budget, fewer weekends or a simpler idea.";
          skip("Pilot Planner", "Skipped because no option was accepted.");
        } else {
          // 4. Pilot Planner (the narrative is written in the same step)
          let narrativeSource: DataSource = "template";
          const planned = await step(
            "Pilot Planner",
            async (planInput: PilotPlanInput, ctx) => {
              const plan = await agents.pilotPlanner(planInput, ctx);
              const facts = buildNarrativeFacts({ city: input.city, winner, options: feasible!.options, plan, budgetInr: input.budgetInr, weekends: input.weekends });
              narrative = templateNarrative(facts);
              if (options.narrate) {
                try {
                  narrative = await options.narrate(facts);
                } catch {
                  narrative = { ...narrative, note: "The LLM was unavailable, so template text is shown." };
                }
              }
              narrativeSource = narrative.source;
              ctx.note(narrative.source === "llm" ? "Explanation polished by the LLM" : "Explanation written from templates (no LLM)");
              return plan;
            },
            { option: winner, profile },
            {
              input: `Winner: ${winner.conceptLabel.toLowerCase()} in ${winner.locality}; ${winner.plannedUnits} ${winner.unitLabel}s expected; budget ${inr(input.budgetInr)}`,
              output: (o) => `${o.days}-day pilot costing ${inr(o.totalCostInr)}; continue at ${o.rule.continueUnits} sold or ${inr(o.rule.continueRevenueInr)}`,
              extraSources: ["estimate"],
            },
          );
          const plannerTrace = traces.get("Pilot Planner")!;
          plannerTrace.dataSources = uniq([...plannerTrace.dataSources, narrativeSource]);
          if (planned) {
            pilotPlan = planned;
          } else {
            status = status === "completed" ? "partial" : status;
            message = "The recommendation is ready, but the Pilot Planner failed to build the plan.";
            if (!narrative) {
              narrative = templateNarrative(buildNarrativeFacts({ city: input.city, winner, options: feasible.options, budgetInr: input.budgetInr, weekends: input.weekends }));
            }
          }
        }
      }
    }
  }

  const allCalls = [...traces.values()].flatMap((t) => t.qlooCalls);
  const qlooCallCounts = { live: 0, recorded: 0, sample: 0 };
  for (const call of allCalls) qlooCallCounts[call.source]++;
  const qlooSource = allCalls.reduce<"live" | "recorded" | "sample">(
    (worst, c) => (SOURCE_RANK[c.source] > SOURCE_RANK[worst] ? c.source : worst),
    allCalls.length ? "live" : "sample",
  );

  return runResultSchema.parse({
    runId,
    startedAt,
    finishedAt: now().toISOString(),
    status,
    ...(message ? { message } : {}),
    input,
    agents: AGENT_NAMES.map((a) => traces.get(a)!),
    localities: local?.localities ?? [],
    options: feasible?.options ?? [],
    ...(feasible ? { weights: feasible.weights } : {}),
    ...(feasible?.winnerId ? { winnerId: feasible.winnerId } : {}),
    ...(pilotPlan ? { pilotPlan } : {}),
    ...(concepts.length ? { baseline: buildBaseline(concepts, input.city) } : {}),
    ...(narrative ? { narrative } : {}),
    qlooCallCounts,
    qlooSource,
    disclaimer: DISCLAIMER,
  } satisfies RunResult);
}
