import { describe, expect, it } from "vitest";
import { evaluatePilot } from "@/lib/pilot";

const plan = {
  unitLabel: "print",
  predicted: { units: 50, revenueInr: 12_500, footfall: 3000, source: "estimate" as const },
  rule: { continueIf: "", pivotIf: "", stopIf: "", continueUnits: 36, continueRevenueInr: 9000, pivotUnits: 18, pivotRevenueInr: 4500 },
};

describe("evaluatePilot", () => {
  it("says continue when the unit target is met", () => {
    expect(evaluatePilot(plan, { unitsSold: 40, revenueInr: 8000, footfall: 2500 }).decision).toBe("continue");
  });

  it("says continue when only the revenue target is met", () => {
    expect(evaluatePilot(plan, { unitsSold: 30, revenueInr: 9500, footfall: 2500 }).decision).toBe("continue");
  });

  it("says pivot between the thresholds and explains low footfall", () => {
    const v = evaluatePilot(plan, { unitsSold: 20, revenueInr: 5000, footfall: 1000 });
    expect(v.decision).toBe("pivot");
    expect(v.reason).toMatch(/busier spot/);
  });

  it("says pivot and points at conversion when people came but did not buy", () => {
    const v = evaluatePilot(plan, { unitsSold: 20, revenueInr: 5000, footfall: 3200 });
    expect(v.decision).toBe("pivot");
    expect(v.reason).toMatch(/product mix or price/);
  });

  it("says stop below the pivot threshold", () => {
    expect(evaluatePilot(plan, { unitsSold: 5, revenueInr: 1200, footfall: 900 }).decision).toBe("stop");
  });

  it("reports predicted vs actual for units, revenue and footfall", () => {
    const v = evaluatePilot(plan, { unitsSold: 25, revenueInr: 6250, footfall: 1500 });
    expect(v.comparison).toHaveLength(3);
    expect(v.comparison.map((c) => c.pctOfPredicted)).toEqual([50, 50, 50]);
  });
});
