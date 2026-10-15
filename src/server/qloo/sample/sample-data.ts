/**
 * ILLUSTRATIVE SAMPLE DATA. NOT QLOO DATA.
 *
 * Hand-written by Team VKY so the app can run with no API key. Venue names are invented
 * and marked "(sample)". Numbers are plausible placeholders shaped like the real API's
 * output; they are not measurements. Real Qloo responses are never committed to this
 * repository (Qloo's hackathon terms forbid publishing them).
 */

export type SampleConceptKey = "art" | "thrift" | "coffee" | "boardgames" | "books" | "bakery" | "plants" | "other";

export interface SampleVenue {
  name: string;
  genre: string;
  rating: number;
  tags: string[];
}

export interface SampleLocality {
  name: string;
  lat: number;
  lon: number;
  venues: SampleVenue[];
  /** 0..1 affinity of each concept type to this locality's audience. */
  conceptAffinity: Record<SampleConceptKey, number>;
  /** Number of existing places of each concept type within about 2 km. */
  competitors: Record<SampleConceptKey, number>;
  tasteTags: { name: string; type: string; affinity: number }[];
  brands: { name: string; affinity: number; tags: string[] }[];
  age: Record<string, number>;
  gender: Record<string, number>;
}

const AMB = "urn:tag:ambience:qloo";
const AUD = "urn:tag:audience:qloo";
const MUSIC = "urn:tag:genre:music";
const BRAND = "urn:tag:genre:brand";
const GENRE = "urn:tag:genre:place";

export const SAMPLE_LOCALITIES: Record<string, SampleLocality> = {
  indiranagar: {
    name: "Indiranagar",
    lat: 12.9771,
    lon: 77.6387,
    venues: [
      { name: "Hundred Feet Taproom (sample)", genre: "Brewpub", rating: 4.4, tags: ["Trendy", "Social", "Nightlife", "Lively"] },
      { name: "Paper Lantern Cocktails (sample)", genre: "Cocktail bar", rating: 4.2, tags: ["Trendy", "Date night", "Stylish"] },
      { name: "Twelfth Main Roasters (sample)", genre: "Coffee shop", rating: 4.5, tags: ["Creative", "Laptop friendly", "Cozy"] },
      { name: "Studio Loom Concept Store (sample)", genre: "Boutique", rating: 4.6, tags: ["Design lovers", "Artsy", "Curated"] },
      { name: "Blue Door Gallery Cafe (sample)", genre: "Art cafe", rating: 4.3, tags: ["Artsy", "Creative", "Relaxed"] },
      { name: "Defence Colony Bistro (sample)", genre: "European restaurant", rating: 4.1, tags: ["Upscale", "Brunch", "Stylish"] },
    ],
    conceptAffinity: { art: 0.93, thrift: 0.9, coffee: 0.95, boardgames: 0.88, books: 0.87, bakery: 0.92, plants: 0.89, other: 0.85 },
    competitors: { art: 3, thrift: 1, coffee: 18, boardgames: 2, books: 2, bakery: 9, plants: 2, other: 4 },
    tasteTags: [
      { name: "Trendy", type: AMB, affinity: 0.98 },
      { name: "Design lovers", type: AUD, affinity: 0.96 },
      { name: "Indie", type: MUSIC, affinity: 0.95 },
      { name: "Fashion", type: BRAND, affinity: 0.95 },
      { name: "Creative", type: AUD, affinity: 0.94 },
      { name: "Art gallery", type: GENRE, affinity: 0.91 },
    ],
    brands: [
      { name: "Indie Design Label (sample)", affinity: 0.98, tags: ["Fashion", "Minimalist", "Handcrafted"] },
      { name: "Quirky Gifts Co (sample)", affinity: 0.97, tags: ["Playful Graphics", "Stationery", "Gifts"] },
      { name: "Slow Fashion Studio (sample)", affinity: 0.96, tags: ["Sustainable", "Earthy Tones", "Fashion"] },
    ],
    age: { "24_and_younger": 0.05, "25_to_29": 0.12, "30_to_34": 0.2, "35_to_44": 0.03, "45_to_54": -0.3, "55_and_older": -0.1 },
    gender: { male: 0.1, female: -0.1 },
  },
  koramangala: {
    name: "Koramangala",
    lat: 12.9337,
    lon: 77.6284,
    venues: [
      { name: "Fifth Block Brew Library (sample)", genre: "Brewpub", rating: 4.3, tags: ["Social", "Lively", "Young professionals"] },
      { name: "Wall Nook Cafe (sample)", genre: "Cafe", rating: 4.3, tags: ["Casual", "Students", "Breakfast"] },
      { name: "Startup Canteen (sample)", genre: "Restaurant", rating: 4.0, tags: ["Quick bite", "Young professionals"] },
      { name: "Dice and Dosa Board Game Cafe (sample)", genre: "Board game cafe", rating: 4.5, tags: ["Playful", "Groups", "Social"] },
      { name: "Second Story Thrift (sample)", genre: "Thrift store", rating: 4.4, tags: ["Vintage", "Students", "Budget"] },
      { name: "Forum Lane Food Court (sample)", genre: "Food court", rating: 4.0, tags: ["Busy", "Casual"] },
    ],
    conceptAffinity: { art: 0.9, thrift: 0.92, coffee: 0.94, boardgames: 0.91, books: 0.86, bakery: 0.91, plants: 0.86, other: 0.85 },
    competitors: { art: 2, thrift: 3, coffee: 16, boardgames: 3, books: 2, bakery: 8, plants: 1, other: 4 },
    tasteTags: [
      { name: "Young professionals", type: AUD, affinity: 0.98 },
      { name: "Social", type: AMB, affinity: 0.97 },
      { name: "Students", type: AUD, affinity: 0.95 },
      { name: "Streetwear", type: BRAND, affinity: 0.93 },
      { name: "Electronic", type: MUSIC, affinity: 0.92 },
      { name: "Board game cafe", type: GENRE, affinity: 0.9 },
    ],
    brands: [
      { name: "Campus Streetwear (sample)", affinity: 0.97, tags: ["Streetwear", "Casual", "Youth"] },
      { name: "Thrift Collective (sample)", affinity: 0.95, tags: ["Vintage", "Sustainable", "Fashion"] },
      { name: "Desk Setup Co (sample)", affinity: 0.94, tags: ["Tech", "Minimalist"] },
    ],
    age: { "24_and_younger": 0.18, "25_to_29": 0.2, "30_to_34": 0.08, "35_to_44": -0.05, "45_to_54": -0.3, "55_and_older": -0.15 },
    gender: { male: 0.14, female: -0.14 },
  },
  jayanagar: {
    name: "Jayanagar",
    lat: 12.9264,
    lon: 77.5834,
    venues: [
      { name: "Fourth Block Tiffin Room (sample)", genre: "South Indian restaurant", rating: 4.4, tags: ["Traditional", "Families", "Breakfast"] },
      { name: "Complex Corner Book House (sample)", genre: "Book store", rating: 4.5, tags: ["Readers", "Families", "Quiet"] },
      { name: "Shopping Complex Arcade (sample)", genre: "Shopping mall", rating: 4.1, tags: ["Busy", "Value", "Families"] },
      { name: "Cool Corner Ice Creams (sample)", genre: "Ice cream shop", rating: 4.2, tags: ["Nostalgic", "Casual", "Families"] },
      { name: "Ninth Block Filter Coffee (sample)", genre: "Coffee shop", rating: 4.4, tags: ["Traditional", "Routine visit"] },
      { name: "Ranga Kala Art Rooms (sample)", genre: "Art gallery", rating: 4.6, tags: ["Culture arts", "Quiet", "Traditional"] },
    ],
    conceptAffinity: { art: 0.89, thrift: 0.84, coffee: 0.9, boardgames: 0.83, books: 0.93, bakery: 0.92, plants: 0.9, other: 0.84 },
    competitors: { art: 3, thrift: 0, coffee: 10, boardgames: 1, books: 5, bakery: 11, plants: 4, other: 3 },
    tasteTags: [
      { name: "Families", type: AUD, affinity: 0.98 },
      { name: "Traditional", type: AMB, affinity: 0.97 },
      { name: "Readers", type: AUD, affinity: 0.93 },
      { name: "Carnatic", type: MUSIC, affinity: 0.92 },
      { name: "Book store", type: GENRE, affinity: 0.92 },
      { name: "Value", type: AUD, affinity: 0.9 },
    ],
    brands: [
      { name: "Heritage Silk House (sample)", affinity: 0.97, tags: ["Traditional", "Sarees", "Family"] },
      { name: "Kannada Book Club (sample)", affinity: 0.95, tags: ["Books", "Regional", "Culture"] },
      { name: "Home Kitchen Goods (sample)", affinity: 0.93, tags: ["Home", "Value"] },
    ],
    age: { "24_and_younger": -0.08, "25_to_29": -0.02, "30_to_34": 0.04, "35_to_44": 0.14, "45_to_54": 0.1, "55_and_older": 0.12 },
    gender: { male: -0.06, female: 0.06 },
  },
  "hsr layout": {
    name: "HSR Layout",
    lat: 12.9141,
    lon: 77.6436,
    venues: [
      { name: "Sector Seven Commons (sample)", genre: "Bar & grill", rating: 4.2, tags: ["Casual", "Young professionals", "Urban"] },
      { name: "27th Main Brew Bar (sample)", genre: "Coffee shop", rating: 4.4, tags: ["Laptop friendly", "Startups", "Modern"] },
      { name: "Agara Lake Health Kitchen (sample)", genre: "Health food restaurant", rating: 4.3, tags: ["Fitness", "Clean eating"] },
      { name: "Sector Two Tiffins (sample)", genre: "Indian restaurant", rating: 4.5, tags: ["Quick bite", "Routine visit"] },
      { name: "Parkside Play Cafe (sample)", genre: "Board game cafe", rating: 4.3, tags: ["Groups", "Playful"] },
      { name: "Layout Cinema (sample)", genre: "Movie theater", rating: 3.9, tags: ["Residential", "Evening"] },
    ],
    conceptAffinity: { art: 0.86, thrift: 0.88, coffee: 0.92, boardgames: 0.89, books: 0.85, bakery: 0.9, plants: 0.88, other: 0.84 },
    competitors: { art: 1, thrift: 1, coffee: 13, boardgames: 2, books: 1, bakery: 7, plants: 2, other: 3 },
    tasteTags: [
      { name: "Startups", type: AUD, affinity: 0.97 },
      { name: "Young professionals", type: AUD, affinity: 0.96 },
      { name: "Modern", type: AMB, affinity: 0.94 },
      { name: "Fitness", type: AUD, affinity: 0.92 },
      { name: "Pop", type: MUSIC, affinity: 0.9 },
      { name: "Coffee shop", type: GENRE, affinity: 0.92 },
    ],
    brands: [
      { name: "Run Club Gear (sample)", affinity: 0.96, tags: ["Fitness", "Athleisure"] },
      { name: "Desk Setup Co (sample)", affinity: 0.95, tags: ["Tech", "Minimalist"] },
      { name: "Clean Label Snacks (sample)", affinity: 0.93, tags: ["Health", "Food"] },
    ],
    age: { "24_and_younger": 0.06, "25_to_29": 0.22, "30_to_34": 0.16, "35_to_44": 0.0, "45_to_54": -0.25, "55_and_older": -0.18 },
    gender: { male: 0.12, female: -0.12 },
  },
  malleshwaram: {
    name: "Malleshwaram",
    lat: 13.0027,
    lon: 77.5703,
    venues: [
      { name: "Eighth Cross Flower Market (sample)", genre: "Market", rating: 4.4, tags: ["Traditional", "Busy", "Heritage"] },
      { name: "Sampige Road Dosa Hall (sample)", genre: "South Indian restaurant", rating: 4.5, tags: ["Heritage", "Families", "Breakfast"] },
      { name: "Temple Street Sweets (sample)", genre: "Indian sweets shop", rating: 4.4, tags: ["Traditional", "Festive"] },
      { name: "Margosa Arts Sabha (sample)", genre: "Performing arts venue", rating: 4.6, tags: ["Culture arts", "Classical", "Heritage"] },
      { name: "Fifteenth Cross Handlooms (sample)", genre: "Clothing store", rating: 4.3, tags: ["Handloom", "Traditional"] },
      { name: "North Gate Mall (sample)", genre: "Shopping mall", rating: 4.3, tags: ["Families", "Busy"] },
    ],
    conceptAffinity: { art: 0.91, thrift: 0.82, coffee: 0.89, boardgames: 0.8, books: 0.9, bakery: 0.91, plants: 0.91, other: 0.83 },
    competitors: { art: 2, thrift: 0, coffee: 8, boardgames: 0, books: 3, bakery: 9, plants: 5, other: 3 },
    tasteTags: [
      { name: "Heritage", type: AMB, affinity: 0.98 },
      { name: "Culture arts", type: AUD, affinity: 0.96 },
      { name: "Classical", type: MUSIC, affinity: 0.95 },
      { name: "Families", type: AUD, affinity: 0.94 },
      { name: "Handloom", type: BRAND, affinity: 0.92 },
      { name: "Art gallery", type: GENRE, affinity: 0.9 },
    ],
    brands: [
      { name: "Handloom Weavers Co-op (sample)", affinity: 0.97, tags: ["Handloom", "Traditional", "Craft"] },
      { name: "Classical Arts Trust (sample)", affinity: 0.95, tags: ["Music", "Culture"] },
      { name: "Brass and Bronze Crafts (sample)", affinity: 0.93, tags: ["Craft", "Home"] },
    ],
    age: { "24_and_younger": -0.12, "25_to_29": -0.06, "30_to_34": 0.0, "35_to_44": 0.12, "45_to_54": 0.14, "55_and_older": 0.2 },
    gender: { male: -0.04, female: 0.04 },
  },
};

/** Used for any locality or city that has no hand-written sample. */
export const GENERIC_SAMPLE_LOCALITY: SampleLocality = {
  name: "Sample locality",
  lat: 12.9716,
  lon: 77.5946,
  venues: [
    { name: "High Street Cafe (sample)", genre: "Cafe", rating: 4.2, tags: ["Casual", "Social"] },
    { name: "Market Road Eatery (sample)", genre: "Restaurant", rating: 4.1, tags: ["Families", "Busy"] },
    { name: "Corner Book Nook (sample)", genre: "Book store", rating: 4.3, tags: ["Quiet", "Readers"] },
    { name: "Weekend Makers Market (sample)", genre: "Market", rating: 4.4, tags: ["Creative", "Local"] },
    { name: "Neighbourhood Brew Bar (sample)", genre: "Coffee shop", rating: 4.2, tags: ["Cozy", "Students"] },
    { name: "City Arcade (sample)", genre: "Shopping mall", rating: 4.0, tags: ["Busy", "Value"] },
  ],
  conceptAffinity: { art: 0.87, thrift: 0.86, coffee: 0.9, boardgames: 0.85, books: 0.87, bakery: 0.89, plants: 0.86, other: 0.84 },
  competitors: { art: 2, thrift: 1, coffee: 10, boardgames: 1, books: 2, bakery: 7, plants: 2, other: 3 },
  tasteTags: [
    { name: "Casual", type: AMB, affinity: 0.95 },
    { name: "Families", type: AUD, affinity: 0.93 },
    { name: "Students", type: AUD, affinity: 0.92 },
    { name: "Pop", type: MUSIC, affinity: 0.9 },
    { name: "Cafe", type: GENRE, affinity: 0.9 },
  ],
  brands: [
    { name: "Everyday Fashion (sample)", affinity: 0.94, tags: ["Fashion", "Casual"] },
    { name: "Local Makers Collective (sample)", affinity: 0.92, tags: ["Craft", "Local"] },
  ],
  age: { "24_and_younger": 0.04, "25_to_29": 0.06, "30_to_34": 0.05, "35_to_44": 0.0, "45_to_54": -0.08, "55_and_older": -0.06 },
  gender: { male: 0.02, female: -0.02 },
};

/** Maps a Qloo tag id to a sample concept bucket by keyword. */
export function sampleConceptKey(tagIds: string[]): SampleConceptKey {
  const text = tagIds.join(" ").toLowerCase();
  if (/board_game|game/.test(text)) return "boardgames";
  if (/thrift|vintage|used_clothing|second_hand|clothing/.test(text)) return "thrift";
  if (/art|gallery|craft|print|pottery|paint/.test(text)) return "art";
  if (/coffee|cafe|tea/.test(text)) return "coffee";
  if (/book/.test(text)) return "books";
  if (/bak|dessert|cake|sweet/.test(text)) return "bakery";
  if (/plant|garden|florist|nursery/.test(text)) return "plants";
  return "other";
}

export const SAMPLE_CONCEPT_LABEL: Record<SampleConceptKey, string> = {
  art: "Art studio",
  thrift: "Thrift store",
  coffee: "Coffee shop",
  boardgames: "Board game cafe",
  books: "Book store",
  bakery: "Bakery",
  plants: "Plant nursery",
  other: "Shop",
};

// ---------------------------------------------------------------------------
// Partner-discovery sample data (also invented, also marked "(sample)")
// ---------------------------------------------------------------------------

export interface SamplePartner {
  name: string;
  genre: string;
  rating: number;
  priceLevel: number;
  costDescription: string;
  tags: string[];
}

/** Places near each sample locality that a partner search can return. Includes one irrelevant venue on purpose. */
const partnerSet = (area: string, priceLevel: number): SamplePartner[] => [
  { name: `${area} Brew Corner (sample)`, genre: "Cafe", rating: 4.4, priceLevel, costDescription: "₹200 to ₹600", tags: ["Cozy", "Young professionals", "Coffee"] },
  { name: `${area} Juice Junction (sample)`, genre: "Juice shop", rating: 4.2, priceLevel: Math.max(1, priceLevel - 1), costDescription: "₹100 to ₹300", tags: ["Takeaway", "Students"] },
  { name: `${area} Book Nook (sample)`, genre: "Book store", rating: 4.5, priceLevel, costDescription: "₹200 to ₹800", tags: ["Quiet", "Readers"] },
  { name: `${area} Cowork Hub (sample)`, genre: "Coworking space", rating: 4.3, priceLevel, costDescription: "₹300 to ₹900", tags: ["Young professionals", "Startups"] },
  { name: `${area} Food Court (sample)`, genre: "Food court", rating: 4.0, priceLevel: Math.max(1, priceLevel - 1), costDescription: "₹150 to ₹400", tags: ["Busy", "High pedestrian traffic"] },
  { name: `${area} Central Mall (sample)`, genre: "Shopping mall", rating: 4.2, priceLevel, costDescription: "₹300 to ₹1500", tags: ["Families", "Busy"] },
  { name: `${area} Style Boutique (sample)`, genre: "Boutique", rating: 4.6, priceLevel: Math.min(4, priceLevel + 1), costDescription: "₹800 to ₹3000", tags: ["Trendy", "Design lovers"] },
  { name: `${area} Fit Studio (sample)`, genre: "Gym", rating: 4.3, priceLevel, costDescription: "₹500 to ₹1500", tags: ["Fitness", "Morning"] },
  { name: `${area} Community Hall (sample)`, genre: "Community center", rating: 4.1, priceLevel: 1, costDescription: "₹0 to ₹200", tags: ["Families", "Events"] },
  { name: `${area} Meat Mart (sample)`, genre: "Butcher shop", rating: 4.4, priceLevel: 2, costDescription: "₹200 to ₹800", tags: ["Routine visit"] },
];

export const SAMPLE_PARTNERS: Record<string, SamplePartner[]> = {
  indiranagar: partnerSet("Indiranagar", 3),
  koramangala: partnerSet("Koramangala", 2),
  jayanagar: partnerSet("Jayanagar", 2),
  "hsr layout": partnerSet("HSR", 2),
  malleshwaram: partnerSet("Malleshwaram", 2),
};
export const GENERIC_SAMPLE_PARTNERS = partnerSet("Local", 2);

/** Typical venue price level of each sample locality (1 to 4). */
export const SAMPLE_PRICE_LEVEL: Record<string, number> = {
  indiranagar: 3,
  koramangala: 2,
  jayanagar: 2,
  "hsr layout": 2,
  malleshwaram: 2,
};

/** Product tags attached to sample competitors, so product matching has something to match. */
export const SAMPLE_PRODUCT_TAGS: Record<SampleConceptKey, string[]> = {
  art: ["Art prints", "Posters", "Handmade"],
  thrift: ["Vintage", "Second hand", "Denim"],
  coffee: ["Coffee", "Cold brew", "Espresso"],
  boardgames: ["Board games", "Snacks"],
  books: ["Books", "Stationery"],
  bakery: ["Brownie", "Cakes", "Egg free", "Cookies"],
  plants: ["Plants", "Succulents"],
  other: [],
};

/** Neighbourhood heatmap rows for the sample city, including administrative areas a real response also contains. */
export const SAMPLE_ADMIN_AREAS = ["Bengaluru", "East Zone", "Bengaluru Urban"];
