import { describe, expect, it } from "vitest";
import {
  affinityToScore,
  budgetScore,
  competitionScore,
  computeConfidence,
  culturalFit,
  feasibility,
  finalScore,
  riskAdjustment,
  weightsFor,
  type ConfidenceInputs,
} from "@/server/scoring";

describe("weights", () => {
  it.each(["low", "medium", "high"] as const)("sum to 1 for %s risk", (risk) => {
    const w = weightsFor(risk);
    expect(w.culturalFit + w.feasibility + w.riskAdjustment).toBeCloseTo(1, 10);
  });

  it("a cautious user weights risk more than a bold one", () => {
    expect(weightsFor("low").riskAdjustment).toBeGreaterThan(weightsFor("high").riskAdjustment);
    expect(weightsFor("high").culturalFit).toBeGreaterThan(weightsFor("low").culturalFit);
  });
});

describe("cultural fit", () => {
  it("rescales raw affinity linearly and clamps to 0..100", () => {
    expect(affinityToScore(0.7)).toBe(0);
    expect(affinityToScore(0.98)).toBe(100);
    expect(affinityToScore(0.84)).toBe(50);
    expect(affinityToScore(0.2)).toBe(0);
    expect(affinityToScore(1)).toBe(100);
  });

  const base = { meanAffinity: 0.9, affinityPlaces: 8, localityLift: 0, resonanceMatches: 0 };

  it("rises with affinity, with locality lift and with supporting signals", () => {
    const fit = culturalFit(base).culturalFit;
    expect(culturalFit({ ...base, meanAffinity: 0.95 }).culturalFit).toBeGreaterThan(fit);
    expect(culturalFit({ ...base, localityLift: 0.02 }).culturalFit).toBeGreaterThan(fit);
    expect(culturalFit({ ...base, localityLift: -0.02 }).culturalFit).toBeLessThan(fit);
    expect(culturalFit({ ...base, resonanceMatches: 3 }).culturalFit).toBeGreaterThan(fit);
  });

  it("maps locality lift to 0..100 around a neutral 50", () => {
    expect(culturalFit({ ...base, localityLift: 0 }).liftScore).toBe(50);
    expect(culturalFit({ ...base, localityLift: 0.04 }).liftScore).toBe(100);
    expect(culturalFit({ ...base, localityLift: 0.2 }).liftScore).toBe(100);
    expect(culturalFit({ ...base, localityLift: -0.04 }).liftScore).toBe(0);
    expect(culturalFit({ ...base, localityLift: undefined }).liftScore).toBe(50);
  });

  it("pulls affinity signals towards neutral when few places support them", () => {
    const strong = culturalFit({ ...base, meanAffinity: 0.98, localityLift: 0.04, affinityPlaces: 5 });
    const thin = culturalFit({ ...base, meanAffinity: 0.98, localityLift: 0.04, affinityPlaces: 1 });
    expect(strong.affinityScore).toBe(100);
    expect(thin.affinityScore).toBe(60);
    expect(thin.liftScore).toBe(60);
    expect(thin.evidenceWeight).toBe(0.2);
    expect(thin.culturalFit).toBeLessThan(strong.culturalFit);
  });

  it("uses neutral scores when Qloo returned nothing", () => {
    const none = culturalFit({ meanAffinity: undefined, affinityPlaces: 0, localityLift: undefined, resonanceMatches: 0 });
    expect(none.affinityScore).toBe(50);
    expect(none.liftScore).toBe(50);
  });
});

describe("feasibility", () => {
  it("budget score has the documented breakpoints and never increases with cost", () => {
    expect(budgetScore(0.5)).toBe(100);
    expect(budgetScore(0.85)).toBe(100);
    expect(budgetScore(1)).toBe(60);
    expect(budgetScore(1.3)).toBe(0);
    expect(budgetScore(2)).toBe(0);
    const scores = [0.3, 0.6, 0.8, 1, 1.1, 1.25, 1.5].map(budgetScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("treats a few competitors as better than none or many", () => {
    expect(competitionScore(2)).toBeGreaterThan(competitionScore(0));
    expect(competitionScore(2)).toBeGreaterThan(competitionScore(20));
    expect(competitionScore(0)).toBeGreaterThan(competitionScore(20));
  });

  it("combines sub-scores with fixed weights", () => {
    const f = feasibility({ costToBudgetRatio: 0.5, competitorCount: 2, complexity: 0, permitComplexity: 0 });
    expect(f.feasibility).toBe(100);
  });
});

describe("risk adjustment and final score", () => {
  it("is safer when spend is recoverable, break-even is easy and skills match", () => {
    const safe = riskAdjustment({ unrecoverableShare: 0.3, breakevenShare: 0.6, skillMatch: 1 });
    const risky = riskAdjustment({ unrecoverableShare: 0.9, breakevenShare: 1.5, skillMatch: 0 });
    expect(safe.riskAdjustment).toBeGreaterThan(risky.riskAdjustment);
    expect(risky.breakevenScore).toBe(0);
  });

  it("final is the weighted sum, reduced for downgraded and rejected options", () => {
    const scores = { culturalFit: 80, feasibility: 60, riskAdjustment: 40 };
    const w = weightsFor("medium");
    const accepted = finalScore(scores, w, "accepted");
    expect(accepted.weighted).toBeCloseTo(0.45 * 80 + 0.35 * 60 + 0.2 * 40, 1);
    expect(accepted.final).toBe(accepted.weighted);
    expect(finalScore(scores, w, "downgraded").final).toBeLessThan(accepted.final);
    expect(finalScore(scores, w, "rejected").final).toBeLessThan(finalScore(scores, w, "downgraded").final);
  });
});

describe("confidence", () => {
  const best: ConfidenceInputs = {
    qlooSources: ["live", "live"],
    culturalDegraded: false,
    localityLevel: "locality",
    affinityPlaces: 8,
    hasTasteOrBrandMatch: true,
    competitorDataFound: true,
    marginToNext: 6,
    marketLocalitySpecific: true,
  };

  it("is High only with live, locality-level, well-supported data", () => {
    expect(computeConfidence(best).level).toBe("High");
  });

  it("is never High when recorded data was used", () => {
    expect(computeConfidence({ ...best, qlooSources: ["live", "recorded"] }).level).not.toBe("High");
  });

  it("is always Low when sample data was used, whatever else is true", () => {
    const c = computeConfidence({ ...best, qlooSources: ["live", "sample"] });
    expect(c.level).toBe("Low");
    expect(c.reasons.some((r) => r.effect === "cap")).toBe(true);
  });

  it("is Low when cultural scoring was degraded to neutral values", () => {
    expect(computeConfidence({ ...best, culturalDegraded: true }).level).toBe("Low");
  });

  it("drops with city-level data and thin evidence, and always explains itself", () => {
    const c = computeConfidence({
      ...best,
      localityLevel: "city",
      affinityPlaces: 1,
      hasTasteOrBrandMatch: false,
      competitorDataFound: false,
      marginToNext: 0.5,
      marketLocalitySpecific: false,
    });
    expect(c.level).toBe("Low");
    expect(c.reasons.length).toBeGreaterThanOrEqual(6);
    expect(c.reasons.some((r) => /estimates/.test(r.text))).toBe(true);
  });
});
