import { describe, expect, it } from "vitest";
import { computeCollab, type CollabInputs } from "@/lib/collab";
import { buildOutreach } from "@/lib/outreach";
import { median, pricePositioning } from "@/lib/pricing";
import type { PartnerLead, ScoredOption } from "@/lib/schemas";
import { getCollabProfile } from "@/server/data/collab-profiles";
import { getConcept } from "@/server/data/concepts";
import {
  classifyVenue,
  compareStrategies,
  extractProductTerms,
  isAdministrativeArea,
  looksLikeChainBranch,
  pickPartnerConcept,
  productMatches,
  scorePartner,
  stems,
} from "@/server/partners";
import { COLLAB_PROFILES } from "@/server/data/collab-profiles";
import { CONCEPTS } from "@/server/data/concepts";

const bakery = getCollabProfile("baked-goods")!;
const art = getCollabProfile("art-prints")!;

describe("venue classification", () => {
  it("separates similar, complementary, host and unsuitable venues for cakes", () => {
    expect(classifyVenue("Bakery", "Nest Bakery", bakery)).toBe("similar");
    expect(classifyVenue("Dessert shop", "AvocadoandBrownies", bakery)).toBe("similar");
    expect(classifyVenue("Cafe", "C Cafe", bakery)).toBe("complementary");
    expect(classifyVenue("Juice shop", "Bread & Beans Cafe", bakery)).toBe("complementary");
    expect(classifyVenue("Food court", "Pyramid Food Court", bakery)).toBe("host");
    expect(classifyVenue("Shopping mall", "Max - Marathahalli", bakery)).toBe("host");
    expect(classifyVenue("Butcher shop", "Vikky's Fresh Cold Storages", bakery)).toBe("excluded");
    expect(classifyVenue("Hotel", "Grand Hotel", bakery)).toBe("excluded");
    expect(classifyVenue("Car repair", "Auto Fix", bakery)).toBe("excluded");
  });

  it("depends on the idea: a café is complementary for art prints, a gallery is similar", () => {
    expect(classifyVenue("Cafe", "Blue Door Cafe", art)).toBe("complementary");
    expect(classifyVenue("Book store", "Sapna Book House", art)).toBe("complementary");
    expect(classifyVenue("Art gallery", "Oviyam Gallery", art)).toBe("similar");
  });

  it("flags chain branches", () => {
    expect(looksLikeChainBranch("Starbucks - Indiranagar")).toBe(true);
    expect(looksLikeChainBranch("Lamara Patisserie")).toBe(false);
  });
});

describe("product interpretation", () => {
  it("extracts product phrases from a free-text description", () => {
    expect(extractProductTerms("I make eggless brownies, vegan cupcakes and homemade plum cakes.")).toEqual(["eggless brownies", "vegan cupcakes", "plum cakes"]);
    expect(extractProductTerms("Handmade silver earrings & beaded necklaces")).toEqual(["handmade silver earrings", "beaded necklaces"]);
    expect(extractProductTerms(undefined)).toEqual([]);
  });

  it("matches plural and synonym forms against Qloo tag names", () => {
    const s = stems(["eggless brownies", "pastries"]);
    expect(productMatches(s, ["Brownie", "Egg free", "Pastry", "Coffee"])).toEqual(["Brownie", "Egg free", "Pastry"]);
  });

  it("picks the selected idea the description is about", () => {
    const concepts = ["art-prints", "baked-goods"].map((id) => getConcept(id)!);
    expect(pickPartnerConcept(concepts, COLLAB_PROFILES, ["eggless brownies"])?.id).toBe("baked-goods");
    expect(pickPartnerConcept(concepts, COLLAB_PROFILES, [])?.id).toBe("art-prints");
  });

  it("every idea in the catalogue has a collaboration profile", () => {
    for (const c of CONCEPTS) expect(COLLAB_PROFILES[c.id], c.id).toBeDefined();
  });
});

describe("administrative areas in heatmap results", () => {
  it.each(["Bengaluru", "Bangalore North", "East Zone", "Bengaluru Urban", "Bangalore Metropolitan Region Development Authority", "Mahadevapura Zone"])("filters %s", (name) => {
    expect(isAdministrativeArea(name, "Bengaluru")).toBe(true);
  });
  it.each(["Hoysala Nagar", "Koramangala", "Hudi", "Shivaji Nagar", "White Field"])("keeps %s", (name) => {
    expect(isAdministrativeArea(name, "Bengaluru")).toBe(false);
  });
});

describe("partner scoring", () => {
  const lead = (over: Partial<PartnerLead>): PartnerLead => ({
    id: "p",
    name: "Test Venue",
    partnerType: "complementary",
    locality: "Testnagar",
    tags: [],
    viaAdmired: false,
    source: "live",
    ...over,
  });
  const cake = getConcept("baked-goods")!;
  const s = stems(["brownies"]);

  it("warns that similar businesses may see the user as a competitor", () => {
    const p = scorePartner(lead({ partnerType: "similar", genre: "Bakery", affinity: 0.97, tags: ["Brownie"] }), cake, bakery, s, "brownies");
    expect(p.risks.join(" ")).toMatch(/competitor/);
    expect(p.productMatches).toEqual(["Brownie"]);
    expect(p.suggestedModel).toBe("consignment");
  });

  it("labels hosts as potential high-visibility locations, never measured footfall", () => {
    const p = scorePartner(lead({ partnerType: "host", genre: "Food court", popularity: 0.9, tags: ["High pedestrian traffic"] }), cake, bakery, s, "brownies");
    expect(p.risks.join(" ")).toMatch(/not verified footfall/);
    expect(p.reasons.join(" ")).toMatch(/not a visitor count/);
    expect(p.suggestedModel).toBe("counter");
  });

  it("explains missing affinity instead of inventing one and never invents an address", () => {
    const p = scorePartner(lead({ genre: "Cafe" }), cake, bakery, s, "brownies");
    expect(p.audienceScore).toBe(50);
    expect(p.reasons.join(" ")).toMatch(/No affinity was measured/);
    expect(p.verifySteps.join(" ")).toMatch(/did not return an address/);
  });

  it("ranks higher audience affinity higher, other things equal", () => {
    const hi = scorePartner(lead({ genre: "Cafe", affinity: 0.97 }), cake, bakery, s, "brownies");
    const lo = scorePartner(lead({ genre: "Cafe", affinity: 0.85 }), cake, bakery, s, "brownies");
    expect(hi.fitScore).toBeGreaterThan(lo.fitScore);
  });
});

describe("collaboration cost model", () => {
  const base: CollabInputs = {
    model: "consignment",
    weekends: 2,
    budgetInr: 10_000,
    unitCostInr: 35,
    packagingPerUnitInr: 8,
    stockMultiplier: 1.2,
    counterSetupInr: 1000,
    shelfSetupInr: 400,
    logisticsPerTripInr: 300,
    licenceInr: 0,
    assumptions: { commissionPct: 25, wholesaleDiscountPct: 40, workshopVenueSharePct: 30, counterFeePerDayInr: 500, unitsPerDay: 10, wholesaleUnitsPerWeek: 40, unitPriceInr: 100, seatsPerSession: 8 },
  };

  it("consignment: the partner's commission comes out of revenue and cost lines add up", () => {
    const r = computeCollab(base);
    expect(r.units).toBe(40);
    expect(r.partnerShareInr).toBe(1000);
    expect(r.netRevenueInr).toBe(3000);
    expect(r.costs.reduce((s, c) => s + c.amountInr, 0)).toBe(r.upfrontInr);
    expect(r.breakevenUnits).toBe(Math.ceil((400 + 600) / (75 - 43)));
  });

  it("a higher commission raises the break-even point", () => {
    const cheap = computeCollab(base);
    const dear = computeCollab({ ...base, assumptions: { ...base.assumptions, commissionPct: 45 } });
    expect(dear.breakevenUnits!).toBeGreaterThan(cheap.breakevenUnits!);
  });

  it("reports no break-even when each sale loses money", () => {
    const r = computeCollab({ ...base, model: "wholesale", assumptions: { ...base.assumptions, wholesaleDiscountPct: 70 } });
    expect(r.breakevenUnits).toBeUndefined();
  });

  it("counter fees and a licence are counted as upfront costs", () => {
    const r = computeCollab({ ...base, model: "counter", licenceInr: 2000 });
    expect(r.costs.some((c) => /Counter fee/.test(c.item) && c.amountInr === 2000)).toBe(true);
    expect(r.costs.some((c) => /Licence/.test(c.item) && /does not cover you/.test(c.note ?? ""))).toBe(true);
  });

  it("workshop revenue is seats times ticket price, minus the venue share", () => {
    const r = computeCollab({ ...base, model: "workshop", workshop: { priceInr: 900, costPerSeatInr: 250 } });
    expect(r.units).toBe(16);
    expect(r.grossRevenueInr).toBe(14_400);
    expect(r.netRevenueInr).toBe(Math.round(16 * 900 * 0.7));
  });
});

describe("price positioning", () => {
  it("uses venue price levels only to pick a tier, and never prices below the cost floor", () => {
    const premium = pricePositioning({ unitCostInr: 35, packagingPerUnitInr: 8, referencePriceInr: 100, venuePriceLevels: [3, 4, 3] });
    const budget = pricePositioning({ unitCostInr: 35, packagingPerUnitInr: 8, referencePriceInr: 100, venuePriceLevels: [1, 1, 2] });
    expect(premium.tier).toBe("premium");
    expect(budget.tier).toBe("budget");
    expect(premium.suggestedInr).toBeGreaterThan(budget.suggestedInr);
    expect(budget.rangeInr[0]).toBeGreaterThanOrEqual(budget.floorInr);
    expect(premium.explanation.join(" ")).toMatch(/not the price of your product/);
  });

  it("falls back to costs alone when Qloo returned no price levels", () => {
    const p = pricePositioning({ unitCostInr: 60, packagingPerUnitInr: 10, referencePriceInr: 250, venuePriceLevels: [] });
    expect(p.tier).toBe("unknown");
    expect(p.venuesUsed).toBe(0);
    expect(p.explanation[0]).toMatch(/no price levels/);
  });

  it("rounds to the nearest ₹10 without floating-point errors (₹100 × 1.15 is ₹120, not ₹110)", () => {
    const p = pricePositioning({ unitCostInr: 35, packagingPerUnitInr: 8, referencePriceInr: 100, venuePriceLevels: [3, 3, 4] });
    expect(p.rangeInr).toEqual([120, 140]);
  });

  it("computes medians", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });
});

describe("outreach messages", () => {
  const msg = buildOutreach({
    partnerName: "C Cafe",
    partnerType: "complementary",
    product: "I make eggless brownies.",
    conceptLabel: "Home-baked goods stall",
    modelLabel: "Consignment shelf",
    whyForPartner: "your customers enjoy a sweet treat with coffee",
    pilotSummary: "2 weekends with 30 pieces",
    city: "Bengaluru",
  });

  it("has an email and a short version with the product, format and a low-risk pilot", () => {
    expect(msg.email.subject).toMatch(/consignment shelf trial at C Cafe/);
    expect(msg.email.body).toMatch(/making eggless brownies/);
    expect(msg.email.body).toMatch(/2 weekends with 30 pieces/);
    expect(msg.short.length).toBeLessThan(400);
  });

  it("never invents a contact person or claims prior interest", () => {
    expect(msg.email.body).toMatch(/^Hello C Cafe team,/);
    expect(msg.email.body).toContain("[Your name]");
    expect(msg.email.body).not.toMatch(/as discussed|you expressed|you mentioned/i);
  });
});

describe("solo vs partnership comparison", () => {
  const solo = {
    id: "s",
    conceptId: "art-prints",
    conceptLabel: "Art print pop-up",
    locality: "Koramangala",
    verdict: "accepted",
    scores: { culturalFit: 80, feasibility: 85, riskAdjustment: 75, weighted: 80, penaltyFactor: 1, final: 80 },
    totalCostInr: 12_000,
    runningCostInr: 10_000,
    budgetUsedPct: 80,
  } as unknown as ScoredOption;
  const partner = (score: number, upfrontInr: number) =>
    ({ id: "p:consignment", partnerId: "p", partnerName: "C Cafe", partnerType: "complementary", model: "consignment", label: "Consignment shelf", score, upfrontInr, units: 30, breakevenUnits: 20, partnerShareInr: 900, grossRevenueInr: 3600, netRevenueInr: 2700, budgetUsedPct: 30, verdict: "accepted", inputs: { licenceInr: 0 } }) as never;

  it("recommends going solo when it clearly scores higher", () => {
    const c = compareStrategies({ solo, soloConcept: getConcept("art-prints"), partner: partner(60, 3000), partnerCandidate: undefined, budgetInr: 15_000, risk: "low" });
    expect(c.recommended).toBe("solo");
    expect(c.reasons.join(" ")).toMatch(/keeps the full margin/);
  });

  it("recommends the partnership when it clearly scores higher", () => {
    const c = compareStrategies({ solo, soloConcept: getConcept("art-prints"), partner: partner(90, 3000), partnerCandidate: undefined, budgetInr: 15_000, risk: "low" });
    expect(c.recommended).toBe("partner");
  });

  it("breaks a near tie on the cheaper start", () => {
    const c = compareStrategies({ solo, soloConcept: getConcept("art-prints"), partner: partner(81, 3000), partnerCandidate: undefined, budgetInr: 15_000, risk: "low" });
    expect(c.recommended).toBe("partner");
    expect(c.reasons[0]).toMatch(/within 3 points/);
  });

  it("compares the same dimensions on both sides", () => {
    const c = compareStrategies({ solo, soloConcept: getConcept("art-prints"), partner: partner(70, 3000), partnerCandidate: undefined, budgetInr: 15_000, risk: "low" });
    expect(Object.keys(c.solo).sort()).toEqual(Object.keys(c.partner).sort());
    expect(c.partner.thirdPartyDependence).not.toBe("Low");
    expect(c.solo.thirdPartyDependence).toBe("Low");
  });
});
