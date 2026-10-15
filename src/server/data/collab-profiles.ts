import type { CollabModelId } from "@/lib/collab";

/**
 * How each business idea can work with existing businesses.
 *
 * Venue-type lists decide whether a place Qloo returns is a similar business, a complementary
 * one or a potential host. All quantities are ILLUSTRATIVE planning assumptions (source:
 * "estimate"), not partner terms; the user can change them in the app.
 */
export interface CollabProfile {
  /** Venue types that sell the same or very similar things (possible competitors). */
  similarGenres: RegExp;
  /** Venue types whose customers may want this product but which do not usually sell it. */
  complementaryGenres: RegExp;
  /** Why a complementary venue fits, in plain words. */
  complementaryWhy: string;
  /** Collaboration formats that make sense for this idea, best first. */
  models: CollabModelId[];
  /** Expected sales per day on a partner's shelf (consignment), before any adjustment. */
  consignmentUnitsPerDay: number;
  /** A realistic first wholesale order per week. */
  wholesaleUnitsPerWeek: number;
  /** Packaging and labels per unit. */
  packagingPerUnitInr: number;
  /** Ticket price and material cost per seat if the idea can be run as a co-hosted workshop. */
  workshop?: { priceInr: number; costPerSeatInr: number; seatsPerSession: number };
  /** Plain-language product terms used when the user does not describe their product. */
  defaultProductTerms: string[];
  /** Extra checks for this kind of product before approaching a partner. */
  extraChecks: string[];
}

/** Venue types that can host a counter or event and bring passing visitors. Checked for every idea. */
export const HOST_GENRES = /food court|shopping mall|\bmall\b|cowork|co-work|community|event venue|banquet|convention|exhibition|flea market|\bmarket\b|business park|tech park/i;

/** Venue types that are never suggested as partners for a consumer micro-business. */
export const EXCLUDED_GENRES =
  /butcher|meat|fish market|pharmacy|chemist|hospital|clinic|dentist|doctor|bank|atm|petrol|fuel|gas station|car |auto|tyre|repair|garage|hotel|hostel|lodg|resort|school|temple|church|mosque|gurudwara|police|government|lawyer|insurance|real estate|liquor|wine shop|cemetery|funeral|parking|transit|station|airport|hardware|plumb|electrical/i;

/** Qloo tag IDs for potential host venues (verified with /v2/tags on 15 Oct 2026). */
export const HOST_TAG_IDS = [
  "urn:tag:genre:place:shopping_mall",
  "urn:tag:genre:place:restaurant:food_court",
  "urn:tag:genre:place:coworking_space",
  "urn:tag:genre:place:community_center",
];

const FOOD_CHECKS = [
  "Food sold to the public typically needs your own FSSAI registration; a partner's licence does not automatically cover your products.",
  "Agree how products are stored at the partner (temperature, shelf life) and who removes unsold stock.",
  "Label every item with ingredients, allergens, date made and best-before date.",
];

export const COLLAB_PROFILES: Record<string, CollabProfile> = {
  "baked-goods": {
    similarGenres: /bakery|dessert|patisserie|pastry|cake|sweet|confection|donut|cookie/i,
    complementaryGenres: /cafe|café|coffee|tea|juice|smoothie|book|salad|sandwich|deli|health food|organic|gift|florist|boutique|cowork/i,
    complementaryWhy: "its customers buy food or treats on the spot but it does not bake its own desserts",
    models: ["consignment", "wholesale", "counter", "workshop"],
    consignmentUnitsPerDay: 8,
    wholesaleUnitsPerWeek: 40,
    packagingPerUnitInr: 8,
    workshop: { priceInr: 900, costPerSeatInr: 250, seatsPerSession: 8 },
    defaultProductTerms: ["brownie", "cake", "cookie", "dessert"],
    extraChecks: FOOD_CHECKS,
  },
  "art-prints": {
    similarGenres: /art gallery|art studio|gallery|poster|frame|framing|craft store|craft/i,
    complementaryGenres: /cafe|café|coffee|tea|book|stationery|gift|concept store|boutique|home goods|decor|brewpub|bistro|cowork/i,
    complementaryWhy: "its customers like design-led things and often buy small gifts, but it does not sell original art",
    models: ["consignment", "counter", "workshop", "wholesale"],
    consignmentUnitsPerDay: 3,
    wholesaleUnitsPerWeek: 20,
    packagingPerUnitInr: 10,
    workshop: { priceInr: 700, costPerSeatInr: 180, seatsPerSession: 10 },
    defaultProductTerms: ["art print", "poster", "postcard", "illustration"],
    extraChecks: ["Agree in writing who is responsible if prints are damaged or lost while displayed."],
  },
  "thrift-stall": {
    similarGenres: /thrift|vintage|second hand|used clothing|consignment shop/i,
    complementaryGenres: /cafe|café|coffee|record|book|concept store|lifestyle|salon|barber|sneaker|streetwear|college|cowork/i,
    complementaryWhy: "it attracts a young, style-conscious crowd but does not sell clothing",
    models: ["counter", "consignment"],
    consignmentUnitsPerDay: 2,
    wholesaleUnitsPerWeek: 0,
    packagingPerUnitInr: 6,
    defaultProductTerms: ["thrift", "vintage clothing", "second hand fashion"],
    extraChecks: ["Ask where people can try clothes on, or offer an exchange window instead."],
  },
  "coffee-popup": {
    similarGenres: /cafe|café|coffee|tea house|espresso/i,
    complementaryGenres: /book|cowork|bakery|boutique|concept store|gym|yoga|bike|record/i,
    complementaryWhy: "its customers would welcome a coffee but it does not serve its own",
    models: ["counter"],
    consignmentUnitsPerDay: 0,
    wholesaleUnitsPerWeek: 0,
    packagingPerUnitInr: 12,
    defaultProductTerms: ["coffee", "cold brew", "espresso"],
    extraChecks: FOOD_CHECKS,
  },
  "board-game-evening": {
    similarGenres: /board game|game cafe|gaming/i,
    complementaryGenres: /cafe|café|coffee|brewpub|pub|bistro|restaurant|tea|cowork|community/i,
    complementaryWhy: "it has tables and a sociable crowd on quieter evenings",
    models: ["workshop", "counter"],
    consignmentUnitsPerDay: 0,
    wholesaleUnitsPerWeek: 0,
    packagingPerUnitInr: 0,
    workshop: { priceInr: 300, costPerSeatInr: 60, seatsPerSession: 16 },
    defaultProductTerms: ["board games", "game night"],
    extraChecks: ["Agree food and drink arrangements with the venue in advance."],
  },
  "art-workshop": {
    similarGenres: /art studio|craft|art gallery|pottery|art school/i,
    complementaryGenres: /cafe|café|coffee|book|stationery|cowork|community|brewpub|concept store/i,
    complementaryWhy: "it has tables and a creative crowd who would pay for an evening activity",
    models: ["workshop"],
    consignmentUnitsPerDay: 0,
    wholesaleUnitsPerWeek: 0,
    packagingPerUnitInr: 0,
    workshop: { priceInr: 700, costPerSeatInr: 180, seatsPerSession: 10 },
    defaultProductTerms: ["art workshop", "printmaking"],
    extraChecks: ["Check there is washing access and that the venue is fine with paint or ink."],
  },
  "plant-stall": {
    similarGenres: /nursery|florist|garden|plant/i,
    complementaryGenres: /cafe|café|coffee|home goods|decor|book|organic|concept store|cowork/i,
    complementaryWhy: "its customers care about their homes and desks but it does not sell plants",
    models: ["consignment", "counter", "workshop"],
    consignmentUnitsPerDay: 2,
    wholesaleUnitsPerWeek: 15,
    packagingPerUnitInr: 10,
    workshop: { priceInr: 600, costPerSeatInr: 200, seatsPerSession: 10 },
    defaultProductTerms: ["indoor plants", "succulents"],
    extraChecks: ["Agree who waters the plants while they are on display."],
  },
  "handmade-jewellery": {
    similarGenres: /jewel|accessor|silver|bead/i,
    complementaryGenres: /boutique|clothing|apparel|fashion|salon|beauty|spa|nail|concept store|gift|cafe|café/i,
    complementaryWhy: "its customers shop for style and gifts but it does not make jewellery",
    models: ["consignment", "counter", "workshop"],
    consignmentUnitsPerDay: 2,
    wholesaleUnitsPerWeek: 10,
    packagingPerUnitInr: 15,
    workshop: { priceInr: 800, costPerSeatInr: 250, seatsPerSession: 8 },
    defaultProductTerms: ["handmade jewellery", "earrings", "necklace"],
    extraChecks: ["Keep a signed list of the pieces you leave with the partner, with prices."],
  },
};

export function getCollabProfile(conceptId: string): CollabProfile | undefined {
  return COLLAB_PROFILES[conceptId];
}
