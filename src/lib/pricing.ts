/**
 * Price positioning. Combines Qloo's venue price levels (typical spend at nearby venues) with
 * explicit cost assumptions. A venue's price level is NOT a product price: it only tells us
 * whether the local crowd tends to spend at budget, mid-range or premium places.
 */

export type PriceTier = "budget" | "mid" | "premium" | "unknown";

export interface PricingInputs {
  unitCostInr: number;
  packagingPerUnitInr: number;
  /** The idea's default retail price (illustrative estimate). */
  referencePriceInr: number;
  /** Qloo price levels (1 to 4) of relevant nearby venues; empty if none were returned. */
  venuePriceLevels: number[];
  /** Target gross margin for the floor price, 0..1. */
  targetMargin?: number;
}

export interface PricingResult {
  tier: PriceTier;
  medianLevel?: number;
  venuesUsed: number;
  /** Lowest price that still earns the target margin on materials and packaging. */
  floorInr: number;
  rangeInr: [number, number];
  suggestedInr: number;
  explanation: string[];
}

const TIER_MULTIPLIERS: Record<PriceTier, [number, number]> = {
  budget: [0.8, 1.0],
  mid: [0.95, 1.15],
  premium: [1.15, 1.4],
  unknown: [0.9, 1.1],
};

const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function pricePositioning(i: PricingInputs): PricingResult {
  const margin = i.targetMargin ?? 0.5;
  const unitCost = i.unitCostInr + i.packagingPerUnitInr;
  const floorInr = round10(unitCost / (1 - margin));
  const levels = i.venuePriceLevels.filter((l) => l >= 1 && l <= 4);
  const med = median(levels);
  const tier: PriceTier = med === undefined ? "unknown" : med <= 1.5 ? "budget" : med <= 2.5 ? "mid" : "premium";
  const [lo, hi] = TIER_MULTIPLIERS[tier];
  const rangeInr: [number, number] = [Math.max(floorInr, round10(i.referencePriceInr * lo)), Math.max(floorInr, round10(i.referencePriceInr * hi))];
  const suggestedInr = round10((rangeInr[0] + rangeInr[1]) / 2);

  const tierWords: Record<PriceTier, string> = {
    budget: "mostly budget places",
    mid: "mostly mid-range places",
    premium: "mostly premium places",
    unknown: "places without price information",
  };
  const explanation = [
    med === undefined
      ? "Qloo returned no price levels for nearby venues, so the range is based on costs and the idea's typical price only."
      : `Nearby venues the local crowd likes are ${tierWords[tier]} (median Qloo price level ${med} of 4, from ${levels.length} venues). This describes typical spend at those venues, not the price of your product.`,
    `Floor price ₹${floorInr}: materials and packaging cost about ₹${Math.round(unitCost)} per unit, and the floor keeps a ${Math.round(margin * 100)}% margin.`,
    `Suggested test range ₹${rangeInr[0]} to ₹${rangeInr[1]}, around a typical price of ₹${i.referencePriceInr} for this kind of product. Treat it as a starting point to test, not a verified price.`,
  ];
  return { tier, ...(med !== undefined ? { medianLevel: med } : {}), venuesUsed: levels.length, floorInr, rangeInr, suggestedInr, explanation };
}
