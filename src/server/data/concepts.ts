/**
 * Concept catalogue: the micro-business formats the agent can evaluate.
 *
 * Qloo tag IDs were verified against the live /v2/tags endpoint on 13 Oct 2026.
 * Every rupee figure is an ILLUSTRATIVE ESTIMATE for planning (source: "estimate"),
 * not a quote. Users are told to verify costs locally.
 */

import type { ConceptCategory } from "@/lib/categories";

export interface ConceptCostItem {
  item: string;
  amountInr: number;
  /** Reusable items keep their value after the pilot, so they are not counted as money at risk. */
  reusable: boolean;
}

export interface Concept {
  id: string;
  label: string;
  tagline: string;
  format: "stall" | "workshop" | "event";
  /** Browsing category in the input form. */
  category: ConceptCategory;
  /** Qloo place tags that describe existing businesses of this type. */
  qlooTagIds: string[];
  /** Lower-case fragments matched against Qloo tag, genre and brand-tag names. */
  keywords: string[];
  /** Fragments that cancel a keyword match (for example "martial" for "art"). */
  excludeKeywords?: string[];
  /** Lower-case fragments matched against the user's skills and interests. */
  skillKeywords: string[];
  unitLabel: string;
  unitLabelPlural: string;
  unitCostInr: number;
  unitPriceInr: number;
  /** Expected sales per day at a venue with average weekend footfall, before cultural-fit scaling. */
  baseUnitsPerDay: number;
  /** Stock to carry relative to expected sales (variety and buffer). */
  stockMultiplier: number;
  setupItems: ConceptCostItem[];
  perDayItems: { item: string; amountInr: number }[];
  licenceInr: number;
  licenceNote?: string;
  /** Venue fee relative to a basic stall (workshops and events need a room). */
  venueFeeMultiplier: number;
  /** Share of unsold stock value that is lost (1 = fully perishable). */
  perishableShare: number;
  /** 0 = trivial to run alone, 1 = needs equipment, helpers and practice. */
  complexity: number;
  /** 0 = organiser permission only, 1 = several licences. */
  permitComplexity: number;
  products: { item: string; share: number; priceInr: number; note?: string }[];
  checklist: string[];
  genericPros: string[];
  genericCons: string[];
}

const tag = (s: string) => `urn:tag:genre:place:${s}`;

export const CONCEPTS: Concept[] = [
  {
    id: "art-prints",
    category: "art",
    label: "Art print pop-up",
    tagline: "Sell original illustrations as affordable prints and postcards.",
    format: "stall",
    qlooTagIds: [tag("art_gallery"), tag("art_studio"), tag("craft_store")],
    keywords: ["art", "gallery", "illustrat", "craft", "creative", "handcraft", "handmade", "print", "stationery", "gift", "museum", "book", "decor", "playful graphics"],
    excludeKeywords: ["martial", "clothing", "tattoo"],
    skillKeywords: ["art", "illustrat", "design", "draw", "paint", "creative", "print", "photo"],
    unitLabel: "print",
    unitLabelPlural: "prints",
    unitCostInr: 60,
    unitPriceInr: 250,
    baseUnitsPerDay: 12,
    stockMultiplier: 1.3,
    setupItems: [
      { item: "Display grid and table stand", amountInr: 1200, reusable: true },
      { item: "Tablecloth, signage and price cards", amountInr: 800, reusable: true },
      { item: "Sleeves and paper bags", amountInr: 500, reusable: false },
    ],
    perDayItems: [{ item: "Transport and snacks", amountInr: 300 }],
    licenceInr: 0,
    venueFeeMultiplier: 1,
    perishableShare: 0.05,
    complexity: 0.2,
    permitComplexity: 0.1,
    products: [
      { item: "A4 art print", share: 0.6, priceInr: 250 },
      { item: "A5 mini print", share: 0.25, priceInr: 150 },
      { item: "Postcard set of 4", share: 0.15, priceInr: 120, note: "Low-price entry item" },
    ],
    checklist: [
      "Pick 6 to 8 designs; print a small first batch",
      "Sleeve every print and add a small signature card",
      "Set up a UPI QR code and keep change for cash",
      "Prepare a one-line story for each design",
      "Bring clips, tape and a weight for windy spots",
    ],
    genericPros: ["Low stock cost", "Easy to carry and set up", "Unsold stock keeps its value"],
    genericCons: ["Sales depend on taste and footfall", "Needs original artwork", "Low price per item"],
  },
  {
    id: "thrift-stall",
    category: "fashion",
    label: "Thrift clothing stall",
    tagline: "Curated second-hand and vintage clothing at student-friendly prices.",
    format: "stall",
    qlooTagIds: [tag("thrift_store"), tag("vintage_clothing_store"), tag("used_clothing_store")],
    keywords: ["thrift", "vintage", "fashion", "streetwear", "clothing", "apparel", "sustainab", "retro", "boutique", "footwear", "jeans", "casual"],
    skillKeywords: ["fashion", "thrift", "styling", "cloth", "vintage", "sustainab"],
    unitLabel: "piece",
    unitLabelPlural: "pieces",
    unitCostInr: 90,
    unitPriceInr: 350,
    baseUnitsPerDay: 10,
    stockMultiplier: 1.4,
    setupItems: [
      { item: "Clothes rack and hangers", amountInr: 1200, reusable: true },
      { item: "Mirror, signage and tags", amountInr: 700, reusable: true },
      { item: "Bags and cleaning supplies", amountInr: 500, reusable: false },
    ],
    perDayItems: [{ item: "Transport for stock", amountInr: 300 }],
    licenceInr: 0,
    venueFeeMultiplier: 1,
    perishableShare: 0.1,
    complexity: 0.45,
    permitComplexity: 0.1,
    products: [
      { item: "Tops and shirts", share: 0.5, priceInr: 300 },
      { item: "Jackets and denim", share: 0.3, priceInr: 500 },
      { item: "Accessories", share: 0.2, priceInr: 150 },
    ],
    checklist: [
      "Source, wash and steam every piece",
      "Tag each piece with size and price",
      "Arrange the rack by colour or style",
      "Set up a UPI QR code and keep change for cash",
      "Bring a mirror and a simple try-on corner if allowed",
    ],
    genericPros: ["Sustainable and on trend", "Good margin per piece", "Unsold stock can be resold later"],
    genericCons: ["Sourcing good stock takes time", "Needs many sizes and styles", "Bulky to transport"],
  },
  {
    id: "coffee-popup",
    category: "food",
    label: "Coffee pop-up",
    tagline: "Specialty coffee served from a small counter.",
    format: "stall",
    qlooTagIds: [tag("restaurant:coffee_shop"), tag("restaurant:cafe")],
    keywords: ["coffee", "cafe", "café", "espresso", "brew", "roast", "bakery", "brunch", "tea"],
    skillKeywords: ["coffee", "barista", "brew", "cafe", "cook", "bak", "food"],
    unitLabel: "cup",
    unitLabelPlural: "cups",
    unitCostInr: 45,
    unitPriceInr: 150,
    baseUnitsPerDay: 40,
    stockMultiplier: 1.2,
    setupItems: [
      { item: "Counter, cups, lids and signage", amountInr: 2500, reusable: false },
    ],
    perDayItems: [
      { item: "Espresso machine and grinder rental", amountInr: 2500 },
      { item: "Milk, ice, water and power", amountInr: 600 },
    ],
    licenceInr: 2000,
    licenceNote: "Food and drink sales typically need an FSSAI basic registration.",
    venueFeeMultiplier: 1,
    perishableShare: 0.8,
    complexity: 0.8,
    permitComplexity: 0.6,
    products: [
      { item: "Hot coffee", share: 0.5, priceInr: 140 },
      { item: "Iced coffee", share: 0.4, priceInr: 170 },
      { item: "Add-on cookie", share: 0.1, priceInr: 60 },
    ],
    checklist: [
      "Confirm power supply and water access with the venue",
      "Complete food-safety registration before the first day",
      "Practise the full menu at speed",
      "Plan milk and ice storage for the whole day",
      "Set up a UPI QR code and keep change for cash",
    ],
    genericPros: ["High demand everywhere", "Repeat customers", "Good margin per cup"],
    genericCons: ["Equipment is expensive", "Needs food-safety registration", "Many established competitors"],
  },
  {
    id: "board-game-evening",
    category: "experiences",
    label: "Board-game evening",
    tagline: "A ticketed evening of hosted board games with snacks.",
    format: "event",
    qlooTagIds: [tag("board_game_club"), tag("restaurant:board_game_club")],
    keywords: ["board game", "game", "playful", "social", "group", "trivia", "arcade", "community", "nerd", "geek"],
    excludeKeywords: ["playful graphics"],
    skillKeywords: ["game", "host", "event", "community", "teach"],
    unitLabel: "ticket",
    unitLabelPlural: "tickets",
    unitCostInr: 60,
    unitPriceInr: 250,
    baseUnitsPerDay: 14,
    stockMultiplier: 1,
    setupItems: [
      { item: "Starter library of 8 games", amountInr: 3500, reusable: true },
      { item: "Signage and score sheets", amountInr: 400, reusable: false },
    ],
    perDayItems: [{ item: "Transport and helper", amountInr: 300 }],
    licenceInr: 0,
    venueFeeMultiplier: 1.5,
    perishableShare: 1,
    complexity: 0.5,
    permitComplexity: 0.15,
    products: [
      { item: "Entry ticket with one drink", share: 0.8, priceInr: 250 },
      { item: "Group of 4 ticket", share: 0.2, priceInr: 900, note: "Per group" },
    ],
    checklist: [
      "Book a cafe corner or community room with tables",
      "Pick games for 2, 4 and 6 players; learn to teach each in 3 minutes",
      "Open a simple sign-up form and cap the seats",
      "Arrange snacks and drinks with the venue",
      "Plan an icebreaker game for people who come alone",
    ],
    genericPros: ["Low stock cost", "Builds a community", "Works well with a partner venue"],
    genericCons: ["Needs a room, not just a stall", "Depends on advance sign-ups", "Hosting takes energy"],
  },
  {
    id: "art-workshop",
    category: "experiences",
    label: "Art-print workshop",
    tagline: "A paid, hands-on session where people make their own print.",
    format: "workshop",
    qlooTagIds: [tag("art_studio"), tag("art_supply_store"), tag("art_gallery")],
    keywords: ["art", "studio", "workshop", "class", "craft", "creative", "paint", "pottery", "handcraft", "handmade", "hobby"],
    excludeKeywords: ["martial", "clothing", "tattoo", "fitness", "yoga", "dance"],
    skillKeywords: ["art", "teach", "illustrat", "design", "paint", "print", "craft", "workshop"],
    unitLabel: "seat",
    unitLabelPlural: "seats",
    unitCostInr: 180,
    unitPriceInr: 600,
    baseUnitsPerDay: 8,
    stockMultiplier: 1.1,
    setupItems: [
      { item: "Rollers, carving tools and boards", amountInr: 2000, reusable: true },
      { item: "Aprons, signage and sample pieces", amountInr: 700, reusable: true },
    ],
    perDayItems: [{ item: "Transport and refreshments", amountInr: 350 }],
    licenceInr: 0,
    venueFeeMultiplier: 1.5,
    perishableShare: 0.3,
    complexity: 0.5,
    permitComplexity: 0.1,
    products: [
      { item: "Workshop seat (2 hours, materials included)", share: 0.85, priceInr: 600 },
      { item: "Take-home print kit", share: 0.15, priceInr: 350 },
    ],
    checklist: [
      "Book a room or cafe corner with tables and washing access",
      "Run the session once with friends and time each step",
      "Prepare one finished sample per design",
      "Open a simple sign-up form and take advance payment",
      "Pack one material kit per seat plus two spares",
    ],
    genericPros: ["Higher price per customer", "Advance bookings reduce risk", "Little leftover stock"],
    genericCons: ["Needs teaching confidence", "Fewer customers per day", "Needs a room with tables"],
  },
  {
    id: "baked-goods",
    category: "food",
    label: "Home-baked goods stall",
    tagline: "Small-batch cookies, brownies and loaf cakes.",
    format: "stall",
    qlooTagIds: [tag("restaurant:bakery")],
    keywords: ["bak", "dessert", "cake", "pastry", "sweet", "cookie", "patisserie", "chocolate", "ice cream"],
    skillKeywords: ["bak", "cook", "dessert", "pastry", "food"],
    unitLabel: "item",
    unitLabelPlural: "items",
    unitCostInr: 35,
    unitPriceInr: 100,
    baseUnitsPerDay: 35,
    stockMultiplier: 1.15,
    setupItems: [
      { item: "Display boxes, tongs and signage", amountInr: 1500, reusable: true },
      { item: "Packaging and labels", amountInr: 700, reusable: false },
    ],
    perDayItems: [{ item: "Transport and cold storage", amountInr: 400 }],
    licenceInr: 2000,
    licenceNote: "Food sales typically need an FSSAI basic registration.",
    venueFeeMultiplier: 1,
    perishableShare: 0.9,
    complexity: 0.55,
    permitComplexity: 0.6,
    products: [
      { item: "Cookie or brownie", share: 0.7, priceInr: 90 },
      { item: "Loaf slice", share: 0.2, priceInr: 120 },
      { item: "Box of 6", share: 0.1, priceInr: 480, note: "Per box" },
    ],
    checklist: [
      "Complete food-safety registration before the first day",
      "Label every item with ingredients and allergens",
      "Bake the night before and plan storage",
      "Offer two tasting samples per hour",
      "Set up a UPI QR code and keep change for cash",
    ],
    genericPros: ["Popular impulse buy", "Low price point", "Skills many people already have"],
    genericCons: ["Unsold stock is wasted", "Needs food-safety registration", "Baking takes the whole evening before"],
  },
  {
    id: "plant-stall",
    category: "home",
    label: "Indoor plant stall",
    tagline: "Small potted plants and propagation jars for desks and balconies.",
    format: "stall",
    qlooTagIds: [tag("plant_nursery")],
    keywords: ["plant", "garden", "florist", "nursery", "botanic", "green", "organic", "nature", "sustainab"],
    skillKeywords: ["plant", "garden", "botan", "nature"],
    unitLabel: "plant",
    unitLabelPlural: "plants",
    unitCostInr: 70,
    unitPriceInr: 200,
    baseUnitsPerDay: 12,
    stockMultiplier: 1.4,
    setupItems: [
      { item: "Tiered display stand", amountInr: 1000, reusable: true },
      { item: "Care cards, signage and bags", amountInr: 600, reusable: false },
    ],
    perDayItems: [{ item: "Transport for plants", amountInr: 500 }],
    licenceInr: 0,
    venueFeeMultiplier: 1,
    perishableShare: 0.3,
    complexity: 0.4,
    permitComplexity: 0.1,
    products: [
      { item: "Small potted plant", share: 0.7, priceInr: 200 },
      { item: "Propagation jar", share: 0.3, priceInr: 150 },
    ],
    checklist: [
      "Buy from a wholesale nursery two days before",
      "Add a care card to every plant",
      "Plan shade and water for the stall",
      "Bring trays for safe transport",
      "Set up a UPI QR code and keep change for cash",
    ],
    genericPros: ["Appeals to many age groups", "Simple to explain", "Decent margin"],
    genericCons: ["Heavy and fragile to transport", "Plants need care between weekends", "Weather dependent"],
  },
  {
    id: "handmade-jewellery",
    category: "art",
    label: "Handmade jewellery stall",
    tagline: "Small-batch earrings, necklaces and bracelets.",
    format: "stall",
    qlooTagIds: [tag("jewelry_store"), tag("jewelry_designer")],
    keywords: ["jewel", "accessor", "fashion", "boutique", "handmade", "handcraft", "earring", "silver", "minimalist", "gift"],
    skillKeywords: ["jewel", "bead", "craft", "handmade", "fashion", "design"],
    unitLabel: "piece",
    unitLabelPlural: "pieces",
    unitCostInr: 120,
    unitPriceInr: 450,
    baseUnitsPerDay: 7,
    stockMultiplier: 2,
    setupItems: [
      { item: "Jewellery display stands and tray", amountInr: 1200, reusable: true },
      { item: "Mirror, signage and price tags", amountInr: 600, reusable: true },
      { item: "Pouches and gift boxes", amountInr: 600, reusable: false },
    ],
    perDayItems: [{ item: "Transport and snacks", amountInr: 300 }],
    licenceInr: 0,
    venueFeeMultiplier: 1,
    perishableShare: 0.05,
    complexity: 0.3,
    permitComplexity: 0.1,
    products: [
      { item: "Earrings", share: 0.55, priceInr: 400 },
      { item: "Necklace or pendant", share: 0.3, priceInr: 600 },
      { item: "Bracelet", share: 0.15, priceInr: 350 },
    ],
    checklist: [
      "Make 25 to 40 pieces across 3 styles",
      "Photograph every piece for social media",
      "Set up a UPI QR code and keep change for cash",
      "Bring a small mirror for customers",
      "Keep a written stock list with prices",
    ],
    genericPros: ["High margin per piece", "Light and easy to carry", "Unsold stock keeps its value"],
    genericCons: ["Many sellers already compete", "Taste is personal and varies a lot", "Takes time to make each piece"],
  },
];

const byId = new Map(CONCEPTS.map((c) => [c.id, c]));

/** Prefix for an idea the user typed themselves, e.g. "custom:Handmade candles". */
export const CUSTOM_PREFIX = "custom:";

/** Words that point a custom idea at the most similar catalogue concept (used for cost estimates). */
const TEMPLATE_HINTS: [RegExp, string][] = [
  [/coffee|tea|chai|juice|drink|smoothie|lemonade/i, "coffee-popup"],
  [/cake|bak|brownie|cookie|dessert|sweet|bread|food|snack|chocolate|pastr|momo|biryani|kitchen/i, "baked-goods"],
  [/cloth|thrift|fashion|tee|t-shirt|apparel|wear|vintage|sneaker|shoe|bag/i, "thrift-stall"],
  [/jewel|earring|necklace|bracelet|bead|accessor|resin/i, "handmade-jewellery"],
  [/plant|garden|succulent|flower|candle|decor|home|pottery|ceramic|soap/i, "plant-stall"],
  [/workshop|class|lesson|course|session|painting|craft/i, "art-workshop"],
  [/game|quiz|event|music|comedy|karaoke|puzzle/i, "board-game-evening"],
];

function customConcept(id: string): Concept | undefined {
  const label = id.slice(CUSTOM_PREFIX.length).replace(/[^\p{L}\p{N} &'\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 32);
  if (label.length < 2) return undefined;
  const templateId = TEMPLATE_HINTS.find(([re]) => re.test(label))?.[1] ?? "art-prints";
  const template = byId.get(templateId)!;
  const words = label.toLowerCase().split(" ").filter((w) => w.length >= 3);
  return {
    ...template,
    id,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    tagline: `Your own idea. Costs are modelled on a similar ${template.label.toLowerCase()}.`,
    // Match Qloo tags on the user's own words first, then on the similar concept's words.
    keywords: [...new Set([...words, ...template.keywords])],
    skillKeywords: [...new Set([...words, ...template.skillKeywords])],
  };
}

export function getConcept(id: string): Concept | undefined {
  return byId.get(id) ?? (id.startsWith(CUSTOM_PREFIX) ? customConcept(id) : undefined);
}

/** Small public view of the catalogue for the input form. */
export function listConceptOptions(): { id: string; label: string; tagline: string; category: ConceptCategory }[] {
  return CONCEPTS.map(({ id, label, tagline, category }) => ({ id, label, tagline, category }));
}
