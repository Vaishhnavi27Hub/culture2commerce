import { describe, expect, it } from "vitest";
import { runResultSchema, type RunInput } from "@/lib/schemas";
import { readServerEnv } from "@/server/env";
import { runPipeline } from "@/server/orchestrator";
import { createQlooClient } from "@/server/qloo";
import { clearQlooCache } from "@/server/qloo/live";
import type { QlooClient } from "@/server/qloo/types";
import { makeMockFetch, TEST_KEY } from "../fixtures/raw-qloo";
import { sampleOnlyQloo } from "../helpers/ctx";

/**
 * Partnership features end to end, on bundled sample data (no network). Expected outcomes
 * are derived from the run's own numbers, not hard-coded winners.
 */

const brownies: RunInput = {
  city: "Bengaluru",
  localities: [],
  budgetInr: 10_000,
  weekends: 2,
  interests: ["baking"],
  conceptIds: ["baked-goods"],
  riskPreference: "low",
  launchMode: "partner",
  productDescription: "I make eggless brownies, vegan cupcakes and homemade plum cakes.",
};

const run = (input: Partial<RunInput>, qloo: QlooClient = sampleOnlyQloo(), extra: Parameters<typeof runPipeline>[1] = {}) =>
  runPipeline({ ...brownies, ...input }, { qloo, ...extra });

describe("1. Homemade brownies in Bengaluru, ₹10,000, partnership mode", () => {
  it("finds similar, complementary and host partners and builds a partner pilot within budget", async () => {
    const r = await run({});
    expect(() => runResultSchema.parse(r)).not.toThrow();
    expect(r.status).toBe("completed");
    expect(r.localitySource).toBe("qloo_heatmap");
    const types = new Set(r.partners.map((p) => p.partnerType));
    expect(types).toEqual(new Set(["similar", "complementary", "host"]));
    expect(r.partners.every((p) => !/butcher|meat/i.test(p.genre ?? ""))).toBe(true);

    const s = r.partnerStrategy!;
    expect(s.status).toBe("ready");
    const best = s.options.find((o) => o.id === s.bestOptionId)!;
    expect(best.upfrontInr).toBeLessThanOrEqual(brownies.budgetInr);
    expect(best.verdict).not.toBe("rejected");

    const plan = r.partnerPlan!;
    expect(plan.shortlist.length).toBeGreaterThan(0);
    expect(plan.shortlist[0]?.partnerId).toBe(best.partnerId);
    expect(plan.upfrontInr).toBe(best.upfrontInr);
    expect(plan.successMetrics.length).toBeGreaterThanOrEqual(3);
    expect(plan.compliance.join(" ")).toMatch(/FSSAI/);
    const email = plan.shortlist[0]!.outreach.email.body;
    expect(email).toMatch(/eggless brownies/);
    expect(email).toContain("[Your name]");
    // The solo plan is not built in partnership-only mode.
    expect(r.pilotPlan).toBeUndefined();
  });

  it("uses the product description: Qloo tags are matched and shown", async () => {
    const r = await run({});
    expect(r.productProfile?.source).toBe("user");
    expect(r.productProfile?.terms).toEqual(["eggless brownies", "vegan cupcakes", "plum cakes"]);
    expect(r.partners.some((p) => p.partnerType === "similar" && p.productMatches.length > 0)).toBe(true);
    expect(r.agents[1]?.notes.join(" ")).toMatch(/Product read as/);
  });

  it("estimates a price range from venue price levels without treating them as product prices", async () => {
    const r = await run({});
    const p = r.pricing!;
    expect(p.rangeInr[0]).toBeGreaterThanOrEqual(p.floorInr);
    expect(p.explanation.join(" ")).toMatch(/not the price of your product/);
  });

  it("every partner card carries evidence, risks and verification steps from real fields only", async () => {
    const r = await run({});
    for (const p of r.partners) {
      expect(p.reasons.length).toBeGreaterThan(0);
      expect(p.verifySteps.length).toBeGreaterThan(1);
      expect(p.source).toBe("sample");
      if (p.partnerType === "host") expect(p.risks.join(" ")).toMatch(/not verified footfall/);
      if (p.partnerType === "similar") expect(p.risks.join(" ")).toMatch(/competitor/);
    }
  });
});

describe("2. Art prints with a small budget, looking for cafés and bookshops", () => {
  it("recommends complementary cafés or bookshops with a consignment-style format", async () => {
    const r = await run({ conceptIds: ["art-prints"], budgetInr: 6_000, productDescription: "Original illustrated art prints and postcards", interests: ["illustration"] });
    const complementary = r.partners.filter((p) => p.partnerType === "complementary");
    expect(complementary.some((p) => /cafe|book/i.test(p.genre ?? ""))).toBe(true);
    expect(r.partnerStrategy?.options.some((o) => o.model === "consignment")).toBe(true);
    expect(r.partnerStrategy?.options.filter((o) => o.verdict !== "rejected").every((o) => o.upfrontInr <= 6_000 * 1.25)).toBe(true);
  });
});

describe("3. Thrift clothing, showing both approaches", () => {
  it("builds the solo plan, the partner plan and a like-for-like comparison", async () => {
    const r = await run({ conceptIds: ["thrift-stall"], budgetInr: 15_000, launchMode: "both", productDescription: "Curated vintage jackets and denim" });
    const c = r.comparison!;
    expect(c).toBeDefined();
    expect(c.solo.available || c.partner.available).toBe(true);
    if (c.solo.available && c.partner.available) {
      const scoreGap = Math.abs(c.solo.score - c.partner.score);
      const expected = scoreGap < 3 ? (c.partner.upfrontInr <= c.solo.upfrontInr ? "partner" : "solo") : c.partner.score > c.solo.score ? "partner" : "solo";
      expect(c.recommended).toBe(expected);
    }
    expect(r.pilotPlan).toBeDefined();
    expect(r.partnerPlan).toBeDefined();
  });
});

describe("4. No suitable partners found", () => {
  it("says so clearly, skips the partner plan, and still offers the solo plan in comparison mode", async () => {
    const inner = sampleOnlyQloo();
    const empty: QlooClient = {
      ...inner,
      getNearbyAffinityPlaces: async (a) => ({ ...(await inner.getNearbyAffinityPlaces(a)), data: [] }),
      getPlacesByTag: async (a) => ({ ...(await inner.getPlacesByTag(a)), data: [] }),
    };
    const partnerOnly = await run({ localities: ["Jayanagar"] }, empty);
    expect(partnerOnly.partners).toEqual([]);
    expect(partnerOnly.partnerStrategy?.status).toBe("no_partners");
    expect(partnerOnly.agents[3]?.status).toBe("skipped");
    expect(partnerOnly.message).toMatch(/No suitable partner/);

    const both = await run({ localities: ["Jayanagar"], launchMode: "both", conceptIds: ["art-prints"], budgetInr: 15_000 }, empty);
    expect(both.comparison?.partner.available).toBe(false);
    expect(both.comparison?.recommended).toBe("solo");
    expect(both.pilotPlan).toBeDefined();
  });
});

describe("5. Collaboration costs that exceed the budget", () => {
  it("rejects options over budget with the reason, and builds no plan", async () => {
    const r = await run({ budgetInr: 1_500, localities: ["Jayanagar"] });
    const s = r.partnerStrategy!;
    expect(s.status).toBe("none_affordable");
    expect(s.options.length).toBeGreaterThan(0);
    expect(s.options.every((o) => o.verdict === "rejected")).toBe(true);
    expect(s.options.some((o) => /budget|lose money/.test(o.reasons.join(" ")))).toBe(true);
    expect(r.partnerPlan).toBeUndefined();
  });
});

describe("6. Ambiguous or unknown admired business", () => {
  it("reports an unknown name without inventing a match", async () => {
    const r = await run({ admiredBusiness: "Totally Unknown Bakehouse", localities: ["Jayanagar"] });
    expect(r.admired?.status).toBe("not_found");
    expect(r.admired?.match).toBeUndefined();
    expect(r.partners.some((p) => p.viaAdmired)).toBe(false);
  });

  it("uses a matched reference business and marks the places found through it", async () => {
    const r = await run({ admiredBusiness: "Twelfth Main Roasters", localities: ["Jayanagar"] });
    expect(r.admired?.status).toBe("matched");
    expect(r.partners.some((p) => p.viaAdmired && p.signalNote?.includes("Twelfth Main Roasters"))).toBe(true);
  });

  it("flags an inexact match and names that live in another city", async () => {
    const inner = sampleOnlyQloo();
    const ambiguous: QlooClient = {
      ...inner,
      searchEntities: async (a) => ({ ...(await inner.searchEntities(a)), data: [{ id: "x1", name: "Cake Corner", types: ["urn:entity:place"], city: "Bengaluru" }, { id: "x2", name: "Cake World", types: ["urn:entity:place"], city: "Bengaluru" }] }),
    };
    const r1 = await run({ admiredBusiness: "Cakery", localities: ["Jayanagar"] }, ambiguous);
    expect(r1.admired?.status).toBe("ambiguous");
    expect(r1.admired?.alternatives).toEqual(["Cake World"]);

    const elsewhere: QlooClient = {
      ...inner,
      searchEntities: async (a) => ({ ...(await inner.searchEntities(a)), data: [{ id: "y", name: "Cakery", types: ["urn:entity:place"], city: "Paris" }] }),
    };
    const r2 = await run({ admiredBusiness: "Cakery", localities: ["Jayanagar"] }, elsewhere);
    expect(r2.admired?.status).toBe("not_in_city");
    expect(r2.admired?.alternatives[0]).toMatch(/Paris/);
  });
});

describe("7. Qloo timeout or rate limit", () => {
  it("falls back to labelled sample data and still produces a partner plan", async () => {
    clearQlooCache();
    const { fetchImpl } = makeMockFetch(() => new Response("{}", { status: 429 }));
    const qloo = createQlooClient({ env: readServerEnv({ QLOO_API_URL: "https://qloo.test", QLOO_API_KEY: TEST_KEY, QLOO_MODE: "live" }), snapshot: null, fetchImpl });
    const r = await run({ localities: ["Indiranagar"] }, qloo);
    expect(r.status).toBe("completed");
    expect(r.qlooSource).toBe("sample");
    expect(r.agents[0]?.warnings.join(" ")).toMatch(/HTTP 429/);
    expect(r.partnerPlan).toBeDefined();
    expect(JSON.stringify(r)).not.toContain(TEST_KEY);
  }, 20_000);
});

describe("8. A city with limited data", () => {
  it("completes for an unknown city with generic estimates and low confidence", async () => {
    const r = await run({ city: "Mysuru", launchMode: "both", conceptIds: ["handmade-jewellery"], productDescription: "Handmade silver earrings", budgetInr: 8_000 });
    expect(r.status).not.toBe("failed");
    expect(r.localities.every((l) => !l.market.localitySpecific)).toBe(true);
    expect(r.options.every((o) => o.confidence.level === "Low")).toBe(true);
  });
});

describe("9 and 10. Comparison outcomes follow the numbers", () => {
  it("10: recommends the partnership when no solo stall fits the budget", async () => {
    const r = await run({ launchMode: "both" });
    expect(r.options.every((o) => o.verdict === "rejected")).toBe(true);
    expect(r.comparison?.solo.available).toBe(false);
    expect(r.comparison?.recommended).toBe("partner");
  });

  it("9: recommends going solo when no partnership format is affordable but a solo stall is", async () => {
    const inner = sampleOnlyQloo();
    // Partners exist but only as expensive hosts: drop similar and complementary venues.
    const hostsOnly: QlooClient = {
      ...inner,
      getNearbyAffinityPlaces: async (a) => {
        const res = await inner.getNearbyAffinityPlaces(a);
        return { ...res, data: res.data.filter((p) => /mall/i.test(p.genre ?? "")) };
      },
      getPlacesByTag: async (a) => ({ ...(await inner.getPlacesByTag(a)), data: [] }),
    };
    const r = await run({ conceptIds: ["art-prints"], budgetInr: 15_000, launchMode: "both", localities: ["Jayanagar"] }, hostsOnly, {});
    const c = r.comparison!;
    expect(c.solo.available).toBe(true);
    if (!c.partner.available || c.solo.score - c.partner.score >= 3) expect(c.recommended).toBe("solo");
  });
});

describe("Qloo call budget", () => {
  it("refuses calls beyond the per-run budget and keeps going", async () => {
    const r = await run({ localities: ["Indiranagar", "Jayanagar"] }, sampleOnlyQloo(), { callBudget: 8 });
    expect(r.status).not.toBe("failed");
    const used = r.agents.reduce((n, a) => n + a.qlooCalls.length, 0);
    expect(used).toBeLessThanOrEqual(8);
    expect(r.agents[1]?.warnings.join(" ")).toMatch(/per-run budget of 8/);
  });
});

describe("solo mode is unchanged", () => {
  it("does not search for partners", async () => {
    const r = await run({ launchMode: "solo", conceptIds: ["art-prints"], budgetInr: 15_000 });
    expect(r.partners).toEqual([]);
    expect(r.partnerStrategy).toBeUndefined();
    expect(r.pilotPlan).toBeDefined();
  });
});
