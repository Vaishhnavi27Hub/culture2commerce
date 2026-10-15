import { describe, expect, it } from "vitest";
import { culturalOpportunityFinder, describeAudience, summariseDemographics } from "@/server/agents/cultural-opportunity-finder";
import { buildCostModel, feasibilityCritic, skillMatch } from "@/server/agents/feasibility-critic";
import { countVibeTags, localResearcher, pickAnchors, vibeFingerprint } from "@/server/agents/local-researcher";
import { pilotPlanner } from "@/server/agents/pilot-planner";
import { matchesAny } from "@/server/agents/types";
import { CONCEPTS, getConcept } from "@/server/data/concepts";
import { getMarketEstimate, suggestLocalities } from "@/server/data/local-market";
import type { Place } from "@/server/qloo/types";
import { makeCtx, sampleOnlyQloo } from "../helpers/ctx";

const place = (name: string, genre: string, tags: string[] = []): Place => ({
  id: name,
  name,
  genre,
  tags: tags.map((t) => ({ id: t, name: t, type: "urn:tag:ambience:qloo" })),
});

describe("keyword matching", () => {
  it("matches at the start of a word only", () => {
    expect(matchesAny("Art gallery", ["art"])).toBe(true);
    expect(matchesAny("Culture arts", ["art"])).toBe(true);
    expect(matchesAny("Party store", ["art"])).toBe(false);
    expect(matchesAny("Apartment complex", ["art"])).toBe(false);
  });

  it("respects exclude fragments", () => {
    expect(matchesAny("Martial arts school", ["art"], ["martial"])).toBe(false);
    expect(matchesAny("Designer clothing store", ["art", "craft"], ["clothing"])).toBe(false);
  });
});

describe("concept catalogue and market data", () => {
  it("every concept has Qloo tags, a positive margin and a product mix that sums to 1", () => {
    for (const c of CONCEPTS) {
      expect(c.qlooTagIds.length, c.id).toBeGreaterThan(0);
      expect(c.qlooTagIds.every((t) => t.startsWith("urn:tag:genre:place:")), c.id).toBe(true);
      expect(c.unitPriceInr, c.id).toBeGreaterThan(c.unitCostInr);
      expect(c.products.reduce((s, p) => s + p.share, 0), c.id).toBeCloseTo(1, 5);
    }
  });

  it("labels every market estimate as an estimate", () => {
    const m = getMarketEstimate("Bengaluru", "Indiranagar");
    expect(m.source).toBe("estimate");
    expect(m.localitySpecific).toBe(true);
    expect(m.venueOptions.every((v) => v.source === "estimate")).toBe(true);
    expect(getMarketEstimate("Pune", "Koregaon Park").localitySpecific).toBe(false);
  });

  it("suggests localities for a known city and falls back to the city itself otherwise", () => {
    expect(suggestLocalities("bangalore").localities).toEqual(["Indiranagar", "Koramangala", "Jayanagar"]);
    expect(suggestLocalities("Pune")).toEqual({ localities: ["Pune"], cityKnown: false });
  });
});

describe("Local Researcher", () => {
  it("skips hotels and delivery services when picking anchor venues", () => {
    const anchors = pickAnchors([
      place("Grand Hotel", "Hotel"),
      place("Taproom", "Brewpub"),
      place("FreshToDoor", "Grocery delivery service"),
      place("Cafe One", "Cafe"),
      place("Book Nook", "Book store"),
    ]);
    expect(anchors.map((a) => a.name)).toEqual(["Taproom", "Cafe One", "Book Nook"]);
  });

  it("ranks vibe tags by what sets an area apart from the others", () => {
    const here = { counts: countVibeTags([place("a", "x", ["Trendy", "Bustling"]), place("b", "x", ["Trendy", "Bustling"])]), placesSeen: 2 };
    const there = { counts: countVibeTags([place("c", "x", ["Bustling", "Traditional"]), place("d", "x", ["Bustling"])]), placesSeen: 2 };
    expect(vibeFingerprint(here, [there])[0]?.name).toBe("Trendy");
    expect(vibeFingerprint(here, [there]).some((t) => t.name === "City center")).toBe(false);
  });

  it("profiles each requested locality with anchors, competitors and estimates", async () => {
    const ctx = makeCtx();
    const out = await localResearcher({ city: "Bengaluru", localities: ["Indiranagar", "Jayanagar"] }, ctx);
    expect(out.localities.map((l) => l.name)).toEqual(["Indiranagar", "Jayanagar"]);
    for (const l of out.localities) {
      expect(l.anchors.length).toBeGreaterThanOrEqual(3);
      expect(l.competitors.map((c) => c.conceptId).sort()).toEqual([...ctx.input.conceptIds].sort());
      expect(l.market.source).toBe("estimate");
      expect(l.level).toBe("locality");
      expect(l.qlooSource).toBe("sample");
    }
    expect(ctx.notes.length).toBeGreaterThan(0);
  });

  it("suggests localities when none are given", async () => {
    const out = await localResearcher({ city: "Bengaluru", localities: [] }, makeCtx({ localities: [] }));
    expect(out.suggestedByAgent).toBe(true);
    expect(out.localities).toHaveLength(3);
  });

  it("asks Qloo's heatmap for neighbourhoods in any city and drops administrative areas", async () => {
    const out = await localResearcher({ city: "Pune", localities: [] }, makeCtx({ city: "Pune", localities: [] }));
    expect(out.localitySource).toBe("qloo_heatmap");
    expect(out.localities).toHaveLength(3);
    expect(out.neighbourhoods.every((n) => n.name !== "Pune")).toBe(true);
    expect(out.neighbourhoods.filter((n) => n.selected).map((n) => n.name)).toEqual(out.localities.map((l) => l.name));
    expect(out.localities[0]?.market.localitySpecific).toBe(false);
  });

  it("analyses an unknown city as one area when Qloo has no neighbourhood ranking", async () => {
    const inner = sampleOnlyQloo();
    const qloo = { ...inner, getNeighbourhoodHeatmap: async () => Promise.reject(new Error("no heatmap")) };
    const out = await localResearcher({ city: "Pune", localities: [] }, makeCtx({ city: "Pune", localities: [] }, qloo));
    expect(out.localitySource).toBe("city_only");
    expect(out.localities).toHaveLength(1);
    expect(out.localities[0]?.level).toBe("city");
    expect(out.warnings.join(" ")).toMatch(/analysed as one area/);
  });

  it("suggests different neighbourhoods for different ideas", async () => {
    const pick = async (conceptIds: string[]) =>
      (await localResearcher({ city: "Bengaluru", localities: [] }, makeCtx({ localities: [], conceptIds }))).localities.map((l) => l.name);
    expect(await pick(["thrift-stall"])).not.toEqual(await pick(["baked-goods"]));
  });
});

describe("Cultural Opportunity Finder", () => {
  it("averages demographic skews and names the strongest age bands", () => {
    const demo = summariseDemographics([
      { entityId: "a", age: { "24_and_younger": 0.3, "25_to_29": 0.1, "45_to_54": -0.4 }, gender: { male: 0.4, female: -0.4 } },
      { entityId: "b", age: { "24_and_younger": 0.1, "25_to_29": 0.2, "45_to_54": -0.2 }, gender: { male: 0.2, female: -0.2 } },
    ]);
    expect(demo.ageBands).toEqual(["under 25", "25 to 29"]);
    expect(demo.genderNote).toBe("skews male");
    expect(demo.top).toEqual({ band: "under 25", skew: 0.2 });
  });

  it("scores every concept in every locality with sourced evidence", async () => {
    const ctx = makeCtx();
    const local = await localResearcher({ city: "Bengaluru", localities: ctx.input.localities }, ctx);
    const out = await culturalOpportunityFinder(local, ctx);
    expect(out.opportunities).toHaveLength(9);
    expect(out.degraded).toBe(false);
    for (const o of out.opportunities) {
      expect(o.culturalFit).toBeGreaterThanOrEqual(0);
      expect(o.culturalFit).toBeLessThanOrEqual(100);
      expect(o.breakdown.meanAffinity).toBeGreaterThan(0);
      expect(o.evidence.some((e) => e.kind === "concept_affinity")).toBe(true);
      expect(o.evidence.every((e) => Boolean(e.source))).toBe(true);
      expect(o.targetAudience.length).toBeGreaterThan(10);
    }
  });

  it("gives the same concept different cultural fit in different localities", async () => {
    const ctx = makeCtx();
    const local = await localResearcher({ city: "Bengaluru", localities: ctx.input.localities }, ctx);
    const out = await culturalOpportunityFinder(local, ctx);
    const thrift = out.opportunities.filter((o) => o.conceptId === "thrift-stall").map((o) => o.culturalFit);
    expect(new Set(thrift).size).toBeGreaterThan(1);
  });

  it("builds an audience sentence from venues, ages and vibe tags", async () => {
    const ctx = makeCtx();
    const local = await localResearcher({ city: "Bengaluru", localities: ["Koramangala"] }, ctx);
    const text = describeAudience(local.localities[0]!, { ageBands: ["25 to 29"] });
    expect(text).toMatch(/^People aged 25 to 29 who go to Koramangala places like /);
  });
});

describe("Feasibility Critic", () => {
  const indiranagar = async () => {
    const ctx = makeCtx();
    const local = await localResearcher({ city: "Bengaluru", localities: ["Indiranagar"] }, ctx);
    return { ctx, local, profile: local.localities[0]! };
  };

  it("costs a coffee pop-up well above a ₹15,000 budget, driven by equipment rental", async () => {
    const { profile } = await indiranagar();
    const model = buildCostModel(getConcept("coffee-popup")!, profile, 80, 2);
    expect(model.totalCostInr).toBeGreaterThan(15_000 * 1.25);
    expect(model.costs.some((c) => /Espresso machine/.test(c.item) && c.amountInr === 10_000)).toBe(true);
    expect(model.costs.every((c) => c.source === "estimate")).toBe(true);
  });

  it("cost lines add up to the total, and running cost excludes reusable equipment", async () => {
    const { profile } = await indiranagar();
    const model = buildCostModel(getConcept("art-prints")!, profile, 70, 2);
    expect(model.costs.reduce((s, c) => s + c.amountInr, 0)).toBe(model.totalCostInr);
    expect(model.runningCostInr).toBe(model.totalCostInr - 2000);
    expect(model.stockUnits).toBeGreaterThanOrEqual(model.plannedUnits);
  });

  it("expects more sales when cultural fit is higher", async () => {
    const { profile } = await indiranagar();
    const concept = getConcept("art-prints")!;
    expect(buildCostModel(concept, profile, 90, 2).plannedUnits).toBeGreaterThan(buildCostModel(concept, profile, 30, 2).plannedUnits);
  });

  it("matches user interests to concept skills", () => {
    expect(skillMatch(["illustration", "design"], getConcept("art-prints")!)).toBe(1);
    expect(skillMatch(["coding"], getConcept("art-prints")!)).toBe(0);
  });

  it("rejects or downgrades over-budget options with a reason and ranks them last", async () => {
    const ctx = makeCtx();
    const local = await localResearcher({ city: "Bengaluru", localities: ctx.input.localities }, ctx);
    const cultural = await culturalOpportunityFinder(local, ctx);
    const out = await feasibilityCritic({ local, cultural }, ctx);

    const coffee = out.options.filter((o) => o.conceptId === "coffee-popup");
    expect(coffee).toHaveLength(3);
    for (const o of coffee) {
      expect(o.verdict).not.toBe("accepted");
      expect(o.verdictReasons.join(" ")).toMatch(/budget/);
      expect(o.scores.final).toBeLessThan(o.scores.weighted);
    }
    const firstRejected = out.options.findIndex((o) => o.verdict === "rejected");
    expect(out.options.slice(firstRejected).every((o) => o.verdict === "rejected")).toBe(true);
    expect(out.options.map((o) => o.rank)).toEqual(out.options.map((_, i) => i + 1));
    expect(out.options.find((o) => o.id === out.winnerId)?.verdict).not.toBe("rejected");
    expect(out.options.every((o) => o.confidence.reasons.length > 0)).toBe(true);
  });

  it("declares no winner when nothing fits the budget", async () => {
    const ctx = makeCtx({ budgetInr: 2000 });
    const local = await localResearcher({ city: "Bengaluru", localities: ["Indiranagar"] }, ctx);
    const cultural = await culturalOpportunityFinder(local, ctx);
    const out = await feasibilityCritic({ local, cultural }, ctx);
    expect(out.winnerId).toBeUndefined();
    expect(out.options.every((o) => o.verdict === "rejected")).toBe(true);
    expect(out.warnings.join(" ")).toMatch(/exceeds the budget/);
  });
});

describe("Pilot Planner", () => {
  it("turns the winner into quantities, prices, schedule, budget and a measurable rule", async () => {
    const ctx = makeCtx();
    const local = await localResearcher({ city: "Bengaluru", localities: ctx.input.localities }, ctx);
    const cultural = await culturalOpportunityFinder(local, ctx);
    const feasible = await feasibilityCritic({ local, cultural }, ctx);
    const winner = feasible.options.find((o) => o.id === feasible.winnerId)!;
    const profile = local.localities.find((l) => l.name === winner.locality)!;
    const plan = await pilotPlanner({ option: winner, profile }, ctx);

    expect(plan.quantities.reduce((s, q) => s + q.quantity, 0)).toBe(winner.stockUnits);
    expect(plan.days).toBe(4);
    expect(plan.budget).toEqual(winner.costs);
    expect(plan.bufferInr).toBe(15_000 - winner.totalCostInr);
    expect(plan.rule.pivotUnits).toBeLessThan(plan.rule.continueUnits);
    expect(plan.rule.pivotRevenueInr).toBeLessThan(plan.rule.continueRevenueInr);
    expect(plan.rule.continueRevenueInr).toBeGreaterThanOrEqual(winner.runningCostInr);
    expect(plan.rule.continueIf).toMatch(/continue/);
    expect(plan.rule.pivotIf).toMatch(/pivot/);
    expect(plan.rule.stopIf).toMatch(/stop/);
    expect(plan.successMetrics.length).toBeGreaterThanOrEqual(3);
    expect(plan.schedule.some((s) => s.when === "Weekend 2: Sunday")).toBe(true);
    expect(plan.predicted.source).toBe("estimate");
    expect(plan.checklist.length).toBeGreaterThan(4);
  });
});
