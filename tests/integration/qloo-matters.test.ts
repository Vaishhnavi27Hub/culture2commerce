import { describe, expect, it } from "vitest";
import { NISHA_EXAMPLE } from "@/lib/nisha";
import { culturalOpportunityFinder, localityLift } from "@/server/agents/cultural-opportunity-finder";
import { feasibilityCritic } from "@/server/agents/feasibility-critic";
import { localResearcher } from "@/server/agents/local-researcher";
import { runPipeline } from "@/server/orchestrator";
import { bindAll } from "@/server/qloo/recorded";
import type { Place, QlooClient, QlooMethodName, QlooMethods, Sourced } from "@/server/qloo/types";
import { makeCtx, sampleOnlyQloo } from "../helpers/ctx";

/**
 * "If your submission would work the same without Qloo, you're building the wrong thing."
 *
 * These tests guard that property: the recommendation must follow Qloo's cultural signals,
 * and the app must report honestly what happens when they are removed.
 */

/** A Qloo client whose concept-affinity answers are rewritten by `affinityFor`. Everything else is sample data. */
function withAffinities(affinityFor: (locality: string, tagIds: string[]) => number): QlooClient {
  const inner = sampleOnlyQloo();
  return bindAll(async <M extends QlooMethodName>(method: M, args: QlooMethods[M]["args"]) => {
    const fn = inner[method] as (a: QlooMethods[M]["args"]) => Promise<Sourced<QlooMethods[M]["result"]>>;
    const result = await fn(args);
    if (method !== "getAudienceAffinity") return result;
    const a = args as QlooMethods["getAudienceAffinity"]["args"];
    const value = affinityFor(a.context?.locality ?? "", a.tagIds);
    const data = (result.data as Place[]).map((p) => ({ ...p, affinity: value }));
    return { ...result, data } as Sourced<QlooMethods[M]["result"]>;
  });
}

const isArt = (tagIds: string[]) => tagIds.some((t) => t.includes("art_gallery"));
const isThrift = (tagIds: string[]) => tagIds.some((t) => t.includes("thrift"));

describe("the recommendation follows Qloo's cultural signals", () => {
  const input = { ...NISHA_EXAMPLE, conceptIds: ["art-prints", "thrift-stall"] };

  it("moves the recommended locality to wherever the concept has the strongest pull", async () => {
    for (const hotspot of NISHA_EXAMPLE.localities) {
      const qloo = withAffinities((locality, tags) => (isArt(tags) ? (locality === hotspot ? 0.96 : 0.9) : 0.8));
      const result = await runPipeline(input, { qloo });
      const winner = result.options.find((o) => o.id === result.winnerId)!;
      expect(winner.conceptId, hotspot).toBe("art-prints");
      expect(winner.locality, hotspot).toBe(hotspot);
    }
  });

  it("moves the recommended concept when the audience's affinities swap", async () => {
    const artLed = await runPipeline(input, { qloo: withAffinities((_l, tags) => (isArt(tags) ? 0.97 : 0.74)) });
    const thriftLed = await runPipeline(input, { qloo: withAffinities((_l, tags) => (isThrift(tags) ? 0.97 : 0.74)) });
    expect(artLed.options.find((o) => o.id === artLed.winnerId)?.conceptId).toBe("art-prints");
    expect(thriftLed.options.find((o) => o.id === thriftLed.winnerId)?.conceptId).toBe("thrift-stall");
  });

  it("still rejects an over-budget idea however strong its cultural fit is", async () => {
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: withAffinities((_l, tags) => (isArt(tags) || isThrift(tags) ? 0.75 : 0.98)) });
    expect(result.options.filter((o) => o.conceptId === "coffee-popup").every((o) => o.verdict === "rejected")).toBe(true);
    expect(result.options.find((o) => o.id === result.winnerId)?.conceptId).not.toBe("coffee-popup");
  });
});

describe("locality lift", () => {
  it("is the gap between this area and the average of the others", () => {
    expect(localityLift(0.95, [0.9, 0.92])).toBe(0.04);
    expect(localityLift(0.9, [0.95])).toBe(-0.05);
  });

  it("is undefined when there is nothing to compare with", () => {
    expect(localityLift(0.95, [])).toBeUndefined();
    expect(localityLift(0.95, [undefined])).toBeUndefined();
    expect(localityLift(undefined, [0.9])).toBeUndefined();
  });

  it("is reported as evidence and sums to zero across two localities", async () => {
    const ctx = makeCtx({ localities: ["Indiranagar", "Jayanagar"], conceptIds: ["thrift-stall"] });
    const local = await localResearcher({ city: "Bengaluru", localities: ctx.input.localities }, ctx);
    const out = await culturalOpportunityFinder(local, ctx);
    const lifts = out.opportunities.map((o) => o.breakdown.localityLift ?? NaN);
    expect(lifts[0]! + lifts[1]!).toBeCloseTo(0, 5);
    expect(lifts[0]).toBeGreaterThan(0);
    for (const o of out.opportunities) {
      const item = o.evidence.find((e) => e.kind === "locality_lift");
      expect(item?.value).toBe(o.breakdown.localityLift);
      expect(item?.source).toBe("sample");
    }
  });

  it("is neutral, not invented, when only one locality is analysed", async () => {
    const ctx = makeCtx({ localities: ["Indiranagar"] });
    const local = await localResearcher({ city: "Bengaluru", localities: ["Indiranagar"] }, ctx);
    const out = await culturalOpportunityFinder(local, ctx);
    expect(out.opportunities.every((o) => o.breakdown.localityLift === undefined && o.breakdown.liftScore === 50)).toBe(true);
    expect(out.opportunities.some((o) => o.evidence.some((e) => e.kind === "locality_lift"))).toBe(false);
  });
});

describe("the without-Qloo counterfactual", () => {
  it("is included in every run with a ranking and uses neutral cultural fit and no competitor data", async () => {
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo() });
    const cf = result.counterfactual!;
    expect(cf.totalOptions).toBe(result.options.length);
    expect(cf.top).toHaveLength(3);
    expect(cf.ranksChanged).toBeGreaterThan(0);

    const ctx = makeCtx();
    const local = await localResearcher({ city: "Bengaluru", localities: ctx.input.localities }, ctx);
    const cultural = await culturalOpportunityFinder(local, ctx);
    const real = await feasibilityCritic({ local, cultural }, ctx);
    expect(cf.winnerChanged).toBe(cf.winnerId !== real.winnerId);
  });

  it("reports a changed answer when Qloo's signals point away from the cheapest option", async () => {
    // Jayanagar has the lowest estimated stall fee, so costs alone favour it.
    const qloo = withAffinities((locality, tags) => (isArt(tags) ? (locality === "Indiranagar" ? 0.97 : 0.88) : 0.8));
    const result = await runPipeline({ ...NISHA_EXAMPLE, conceptIds: ["art-prints", "thrift-stall"] }, { qloo });
    expect(result.options.find((o) => o.id === result.winnerId)?.locality).toBe("Indiranagar");
    expect(result.counterfactual?.winnerChanged).toBe(true);
    expect(result.counterfactual?.winnerId).not.toBe(result.winnerId);
  });

  it("is honest when Qloo's signals do not change the top pick", async () => {
    const flat = await runPipeline({ ...NISHA_EXAMPLE, localities: ["Jayanagar"], conceptIds: ["art-prints"] }, { qloo: sampleOnlyQloo() });
    expect(flat.counterfactual?.winnerChanged).toBe(false);
    expect(flat.counterfactual?.winnerId).toBe(flat.winnerId);
  });
});
