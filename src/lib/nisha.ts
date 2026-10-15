import type { RunInput } from "./schemas";

/**
 * The built-in demo scenario: Nisha, a student in Bengaluru with ₹15,000 and two
 * weekends, choosing between a thrift stall, art prints and a coffee pop-up.
 * She prefers something creative and low-risk.
 */
export const NISHA_EXAMPLE: RunInput = {
  city: "Bengaluru",
  localities: ["Indiranagar", "Koramangala", "Jayanagar"],
  budgetInr: 15_000,
  weekends: 2,
  interests: ["illustration", "creative", "design"],
  conceptIds: ["thrift-stall", "art-prints", "coffee-popup"],
  riskPreference: "low",
  launchMode: "solo",
};

/** The partnership demo: homemade brownies with no stall budget, compared with going solo. */
export const BROWNIE_EXAMPLE: RunInput = {
  city: "Bengaluru",
  localities: [],
  budgetInr: 10_000,
  weekends: 2,
  interests: ["baking"],
  conceptIds: ["baked-goods"],
  riskPreference: "low",
  launchMode: "both",
  productDescription: "I make eggless brownies, vegan cupcakes and homemade plum cakes.",
  admiredBusiness: "Lamara Patisserie",
};
