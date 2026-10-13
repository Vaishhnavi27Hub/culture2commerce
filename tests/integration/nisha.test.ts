import { describe, expect, it } from "vitest";
import { NISHA_EXAMPLE } from "@/lib/nisha";
import { AGENT_NAMES, runResultSchema, type AgentEvent } from "@/lib/schemas";
import { runPipeline } from "@/server/orchestrator";
import { readServerEnv } from "@/server/env";
import { createQlooClient } from "@/server/qloo";
import { clearQlooCache } from "@/server/qloo/live";
import { makeMockFetch, TEST_KEY } from "../fixtures/raw-qloo";
import { sampleOnlyQloo } from "../helpers/ctx";

/**
 * Nisha's scenario end to end with no network: the Qloo client serves only the bundled
 * sample data, exactly as the app does when no key is set or the API is down.
 */
describe("Nisha's scenario on fallback data", () => {
  const run = (overrides: Parameters<typeof runPipeline>[1] = {}) => {
    const events: AgentEvent[] = [];
    return runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo(), onEvent: (e) => events.push(e), ...overrides }).then(
      (result) => ({ result, events }),
    );
  };

  it("completes with all four agents and a schema-valid result", async () => {
    const { result } = await run();
    expect(() => runResultSchema.parse(result)).not.toThrow();
    expect(result.status).toBe("completed");
    expect(result.agents.map((a) => a.agent)).toEqual([...AGENT_NAMES]);
    expect(result.agents.every((a) => a.status === "completed")).toBe(true);
    expect(result.qlooSource).toBe("sample");
    expect(result.qlooCallCounts).toEqual({ live: 0, recorded: 0, sample: 30 });
    expect(result.disclaimer).toMatch(/not financial or legal advice/);
  });

  it("downgrades or rejects the over-budget coffee pop-up, with the reason shown", async () => {
    const { result } = await run();
    const coffee = result.options.filter((o) => o.conceptId === "coffee-popup");
    expect(coffee).toHaveLength(3);
    for (const option of coffee) {
      expect(["downgraded", "rejected"]).toContain(option.verdict);
      expect(option.totalCostInr).toBeGreaterThan(NISHA_EXAMPLE.budgetInr);
      expect(option.verdictReasons[0]).toMatch(/₹15,000 budget/);
      expect(option.verdictReasons.join(" ")).toMatch(/espresso machine and grinder rental/i);
      expect(option.scores.final).toBeLessThan(option.scores.weighted);
    }
    const winner = result.options.find((o) => o.id === result.winnerId)!;
    expect(winner.conceptId).not.toBe("coffee-popup");
    expect(Math.max(...coffee.map((o) => o.scores.final))).toBeLessThan(winner.scores.final);
  });

  it("recommends a concept, locality, audience and pilot plan with a success metric", async () => {
    const { result } = await run();
    const winner = result.options.find((o) => o.id === result.winnerId)!;
    expect(winner.rank).toBe(1);
    expect(winner.verdict).toBe("accepted");
    expect(NISHA_EXAMPLE.conceptIds).toContain(winner.conceptId);
    expect(NISHA_EXAMPLE.localities).toContain(winner.locality);
    expect(winner.targetAudience).toMatch(/People/);
    expect(winner.totalCostInr).toBeLessThanOrEqual(NISHA_EXAMPLE.budgetInr);

    const plan = result.pilotPlan!;
    expect(plan.optionId).toBe(winner.id);
    expect(plan.locality).toBe(winner.locality);
    expect(plan.successMetrics.length).toBeGreaterThan(0);
    expect(plan.successMetrics[0]?.target).toMatch(/At least \d+/);
    expect(plan.rule.continueIf).toMatch(/At least \d+ .* sold or at least ₹[\d,]+ revenue across 2 weekends: continue/);
    expect(plan.rule.continueUnits).toBeGreaterThan(0);
    expect(result.narrative?.headline).toContain(winner.locality);
    expect(result.narrative?.source).toBe("template");
    expect(result.baseline?.options).toHaveLength(3);
  });

  it("labels every piece of evidence, cost and Qloo call with its source", async () => {
    const { result } = await run();
    const sources = new Set(["live", "recorded", "sample", "estimate", "llm", "template", "user"]);
    for (const option of result.options) {
      expect(option.evidence.length).toBeGreaterThan(0);
      for (const e of option.evidence) expect(sources.has(e.source), `${option.id}: ${e.label}`).toBe(true);
      for (const c of option.costs) expect(c.source).toBe("estimate");
    }
    for (const agent of result.agents) {
      for (const call of agent.qlooCalls) expect(call.source).toBe("sample");
      expect(agent.dataSources.length).toBeGreaterThan(0);
    }
    for (const locality of result.localities) {
      expect(locality.qlooSource).toBe("sample");
      expect(locality.market.source).toBe("estimate");
    }
    // Qloo-derived evidence on a sample run is labelled sample, never live.
    const qlooEvidence = result.options.flatMap((o) => o.evidence).filter((e) => e.kind !== "cost");
    expect(qlooEvidence.every((e) => e.source === "sample")).toBe(true);
  });

  it("never reports High confidence on fallback data", async () => {
    const { result } = await run();
    for (const option of result.options) {
      expect(option.confidence.level).not.toBe("High");
      expect(option.confidence.level).toBe("Low");
      expect(option.confidence.reasons.some((r) => /sample/.test(r.text))).toBe(true);
    }
  });

  it("is deterministic: the same input gives the same scores and ranking", async () => {
    const a = (await run()).result;
    const b = (await run()).result;
    expect(b.options.map((o) => [o.id, o.scores, o.verdict])).toEqual(a.options.map((o) => [o.id, o.scores, o.verdict]));
    expect(b.pilotPlan).toEqual(a.pilotPlan);
  });

  it("emits queued, running and completed events in pipeline order, with calls and sources", async () => {
    const { events } = await run();
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
    expect(events.slice(0, 4).map((e) => [e.agent, e.status])).toEqual(AGENT_NAMES.map((a) => [a, "queued"]));
    const completed = events.filter((e) => e.status === "completed");
    expect(completed.map((e) => e.agent)).toEqual([...AGENT_NAMES]);
    for (const e of completed) {
      expect(e.outputSummary).toBeTruthy();
      expect(typeof e.durationMs).toBe("number");
      expect(e.dataSources.length).toBeGreaterThan(0);
    }
    expect(completed[0]?.qlooCalls).toHaveLength(12);
    expect(completed[1]?.qlooCalls).toHaveLength(18);
    expect(completed[2]?.qlooCalls).toHaveLength(0);
    expect(events.some((e) => e.status === "running" && e.note)).toBe(true);
    for (const agent of AGENT_NAMES) {
      const firstRunning = events.findIndex((e) => e.agent === agent && e.status === "running");
      const done = events.findIndex((e) => e.agent === agent && e.status === "completed");
      expect(firstRunning).toBeGreaterThan(-1);
      expect(done).toBeGreaterThan(firstRunning);
    }
  });

  it("uses an LLM narrative only for wording, and keeps template text if the LLM fails", async () => {
    const polished = await run({
      narrate: async (facts) => ({ headline: `Go: ${facts.conceptLabel}`, whyThis: "Because.", pilotPitch: "Try it.", source: "llm" }),
    });
    expect(polished.result.narrative?.source).toBe("llm");
    expect(polished.result.agents[3]?.dataSources).toContain("llm");

    const broken = await run({
      narrate: async () => {
        throw new Error("LLM down");
      },
    });
    expect(broken.result.status).toBe("completed");
    expect(broken.result.narrative?.source).toBe("template");
    expect(broken.result.narrative?.note).toMatch(/template text/);
    expect(broken.result.options.map((o) => o.scores)).toEqual(polished.result.options.map((o) => o.scores));
  });
});

describe("error handling", () => {
  const boom = async () => {
    throw new Error("simulated failure");
  };

  it("stops cleanly and skips later agents when the Local Researcher fails", async () => {
    const events: AgentEvent[] = [];
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo(), onEvent: (e) => events.push(e), agents: { localResearcher: boom } });
    expect(result.status).toBe("failed");
    expect(result.agents.map((a) => a.status)).toEqual(["failed", "skipped", "skipped", "skipped"]);
    expect(result.agents[0]?.error).toBe("simulated failure");
    expect(result.message).toMatch(/Local Researcher/);
    expect(result.options).toEqual([]);
    expect(events.filter((e) => e.status === "skipped")).toHaveLength(3);
  });

  it("continues with neutral cultural scores and Low confidence when the Cultural Opportunity Finder fails", async () => {
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo(), agents: { culturalOpportunityFinder: boom } });
    expect(result.status).toBe("partial");
    expect(result.agents.map((a) => a.status)).toEqual(["completed", "failed", "completed", "completed"]);
    expect(result.options.every((o) => o.scores.culturalFit === 50)).toBe(true);
    expect(result.options.every((o) => o.confidence.level === "Low")).toBe(true);
    expect(result.pilotPlan).toBeDefined();
    expect(result.message).toMatch(/neutral/);
  });

  it("skips the Pilot Planner when the Feasibility Critic fails", async () => {
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo(), agents: { feasibilityCritic: boom } });
    expect(result.status).toBe("failed");
    expect(result.agents.map((a) => a.status)).toEqual(["completed", "completed", "failed", "skipped"]);
    expect(result.localities.length).toBe(3);
  });

  it("still returns the recommendation when only the Pilot Planner fails", async () => {
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo(), agents: { pilotPlanner: boom } });
    expect(result.status).toBe("partial");
    expect(result.winnerId).toBeDefined();
    expect(result.pilotPlan).toBeUndefined();
    expect(result.narrative).toBeDefined();
  });

  it("explains itself when no option fits the budget", async () => {
    const result = await runPipeline({ ...NISHA_EXAMPLE, budgetInr: 2000 }, { qloo: sampleOnlyQloo() });
    expect(result.winnerId).toBeUndefined();
    expect(result.agents[3]?.status).toBe("skipped");
    expect(result.message).toMatch(/No option fits the budget/);
  });

  it("rejects invalid input before running anything", async () => {
    await expect(runPipeline({ ...NISHA_EXAMPLE, budgetInr: -5 }, { qloo: sampleOnlyQloo() })).rejects.toThrow();
    await expect(runPipeline({ city: "Bengaluru" }, { qloo: sampleOnlyQloo() })).rejects.toThrow();
  });
});

describe("live API failing mid-run", () => {
  it("falls back to sample data, records why in the trace and caps confidence", async () => {
    clearQlooCache();
    const { fetchImpl } = makeMockFetch(() => new Response("{}", { status: 429 }));
    const qloo = createQlooClient({
      env: readServerEnv({ QLOO_API_URL: "https://qloo.test", QLOO_API_KEY: TEST_KEY, QLOO_MODE: "live" }),
      snapshot: null,
      fetchImpl,
    });
    // maxRetries backoff would slow the test; the breaker trips after the first failed call.
    const result = await runPipeline({ ...NISHA_EXAMPLE, localities: ["Indiranagar"], conceptIds: ["art-prints"] }, { qloo });
    expect(result.status).toBe("completed");
    expect(result.qlooSource).toBe("sample");
    expect(result.qlooCallCounts.live).toBe(0);
    const calls = result.agents.flatMap((a) => a.qlooCalls);
    expect(calls.every((c) => c.fallbackReason?.includes("HTTP 429"))).toBe(true);
    expect(result.agents[0]?.warnings.join(" ")).toMatch(/Qloo fallback used/);
    expect(result.options.every((o) => o.confidence.level === "Low")).toBe(true);
    expect(JSON.stringify(result)).not.toContain(TEST_KEY);
  }, 20_000);
});
