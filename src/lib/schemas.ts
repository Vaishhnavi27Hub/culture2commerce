import { z } from "zod";

/**
 * Shared schemas and types for a run: the user's input, what each agent produces,
 * the events streamed to the UI and the final result. Used by server and browser.
 */

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

/** Where a value came from. Shown as a badge next to every piece of evidence. */
export const dataSourceSchema = z.enum(["live", "recorded", "sample", "estimate", "llm", "template", "user"]);
export type DataSource = z.infer<typeof dataSourceSchema>;

export const AGENT_NAMES = [
  "Local Researcher",
  "Cultural Opportunity Finder",
  "Feasibility Critic",
  "Pilot Planner",
] as const;
export const agentNameSchema = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof agentNameSchema>;

export const riskPreferenceSchema = z.enum(["low", "medium", "high"]);
export type RiskPreference = z.infer<typeof riskPreferenceSchema>;

export const confidenceLevelSchema = z.enum(["High", "Medium", "Low"]);

/** How the user wants to start: their own stall, with an existing business, or compare both. */
export const launchModeSchema = z.enum(["solo", "partner", "both"]);
export type LaunchMode = z.infer<typeof launchModeSchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const shortText = z.string().trim().min(1).max(60);

export const runInputSchema = z.object({
  city: shortText,
  /** Up to 3 localities to compare. Empty means "suggest for me". */
  localities: z.array(shortText).max(3).default([]),
  budgetInr: z.number().int().min(1_000).max(1_000_000),
  weekends: z.number().int().min(1).max(8),
  interests: z.array(shortText).max(8).default([]),
  conceptIds: z.array(z.string().min(1).max(40)).min(1).max(5),
  riskPreference: riskPreferenceSchema.default("low"),
  launchMode: launchModeSchema.default("solo"),
  /** The user's product in their own words, e.g. "eggless brownies and vegan cupcakes". */
  productDescription: z.string().trim().max(300).optional(),
  /** A business whose crowd and atmosphere the user likes, e.g. "Lamara Patisserie". */
  admiredBusiness: z.string().trim().max(80).optional(),
});
export type RunInput = z.infer<typeof runInputSchema>;

// ---------------------------------------------------------------------------
// Evidence and Qloo calls
// ---------------------------------------------------------------------------

export const evidenceKindSchema = z.enum([
  "anchor_venue",
  "vibe_tag",
  "concept_affinity",
  "locality_lift",
  "taste_tag",
  "brand",
  "demographic",
  "competitor",
  "cost",
  "venue",
  "permit",
]);

export const evidenceSchema = z.object({
  kind: evidenceKindSchema,
  label: z.string(),
  detail: z.string().optional(),
  /** Raw value as returned by the source (e.g. a 0..1 Qloo affinity), never rescaled. */
  value: z.number().optional(),
  source: dataSourceSchema,
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const qlooCallSchema = z.object({
  method: z.string(),
  endpoint: z.string(),
  params: z.record(z.string(), z.string()),
  source: z.enum(["live", "recorded", "sample"]),
  durationMs: z.number(),
  resultCount: z.number(),
  cached: z.boolean(),
  fallbackReason: z.string().optional(),
});
export type QlooCall = z.infer<typeof qlooCallSchema>;

// ---------------------------------------------------------------------------
// Agent 1: Local Researcher
// ---------------------------------------------------------------------------

export const venueSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  genre: z.string().optional(),
  rating: z.number().optional(),
  neighborhood: z.string().optional(),
  distanceM: z.number().optional(),
  /** Qloo venue price level, 1 (budget) to 4 (premium). */
  priceLevel: z.number().optional(),
  costDescription: z.string().optional(),
  tags: z.array(z.string()),
});
export type VenueSummary = z.infer<typeof venueSummarySchema>;

export const competitorSummarySchema = z.object({
  conceptId: z.string(),
  count: z.number(),
  /** True when the count hit the request limit, so the real number is at least this. */
  capped: z.boolean(),
  radiusM: z.number(),
  top: z.array(venueSummarySchema),
  source: dataSourceSchema,
});
export type CompetitorSummary = z.infer<typeof competitorSummarySchema>;

export const venueOptionSchema = z.object({
  type: z.string(),
  description: z.string(),
  feePerDayInr: z.number(),
  source: z.literal("estimate"),
});
export type VenueOption = z.infer<typeof venueOptionSchema>;

export const marketEstimateSchema = z.object({
  /** True when estimates were written for this locality; false when generic city defaults are used. */
  localitySpecific: z.boolean(),
  stallFeePerDayInr: z.number(),
  weekendFootfallPerDay: z.number(),
  venueOptions: z.array(venueOptionSchema),
  permitNotes: z.array(z.string()),
  source: z.literal("estimate"),
});
export type MarketEstimate = z.infer<typeof marketEstimateSchema>;

export const localityProfileSchema = z.object({
  name: z.string(),
  resolvedName: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  /** "locality" when Qloo resolved the neighbourhood; "city" when only city-level data was available. */
  level: z.enum(["locality", "city"]),
  qlooSource: z.enum(["live", "recorded", "sample"]),
  anchors: z.array(venueSummarySchema),
  placesSeen: z.number(),
  vibeTags: z.array(z.object({ name: z.string(), count: z.number() })),
  competitors: z.array(competitorSummarySchema),
  market: marketEstimateSchema,
});
export type LocalityProfile = z.infer<typeof localityProfileSchema>;

export const qlooSourceLabelSchema = z.enum(["live", "recorded", "sample"]);

/** A neighbourhood Qloo's heatmap associated with the idea's audience. */
export const neighbourhoodCandidateSchema = z.object({
  name: z.string(),
  rank: z.number(),
  /** Qloo heatmap affinity (0..1) for the idea's audience. Not a measure of demand or footfall. */
  affinity: z.number(),
  conceptLabels: z.array(z.string()),
  selected: z.boolean(),
  source: qlooSourceLabelSchema,
});
export type NeighbourhoodCandidate = z.infer<typeof neighbourhoodCandidateSchema>;

export const partnerTypeSchema = z.enum(["similar", "complementary", "host"]);
export type PartnerType = z.infer<typeof partnerTypeSchema>;

/** A business found by the Local Researcher, before scoring. Every field comes from Qloo. */
export const partnerLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  genre: z.string().optional(),
  partnerType: partnerTypeSchema,
  locality: z.string(),
  neighborhood: z.string().optional(),
  address: z.string().optional(),
  rating: z.number().optional(),
  priceLevel: z.number().optional(),
  costDescription: z.string().optional(),
  popularity: z.number().optional(),
  /** Qloo affinity to the audience used as the signal; absent when the search had no signal. */
  affinity: z.number().optional(),
  distanceM: z.number().optional(),
  tags: z.array(z.string()),
  /** What the affinity was measured against, in plain words. */
  signalNote: z.string().optional(),
  viaAdmired: z.boolean(),
  source: qlooSourceLabelSchema,
});
export type PartnerLead = z.infer<typeof partnerLeadSchema>;

export const admiredResolutionSchema = z.object({
  query: z.string(),
  status: z.enum(["matched", "ambiguous", "not_in_city", "not_found", "failed"]),
  match: z.object({ id: z.string(), name: z.string(), neighborhood: z.string().optional(), genre: z.string().optional() }).optional(),
  alternatives: z.array(z.string()),
  note: z.string(),
});
export type AdmiredResolution = z.infer<typeof admiredResolutionSchema>;

export const localResearchOutputSchema = z.object({
  localities: z.array(localityProfileSchema).min(1),
  suggestedByAgent: z.boolean(),
  /** How the localities were chosen when the user asked for suggestions. */
  localitySource: z.enum(["user", "qloo_heatmap", "curated_fallback", "city_only"]),
  neighbourhoods: z.array(neighbourhoodCandidateSchema),
  /** The idea used for partner discovery (null in solo mode). */
  partnerConceptId: z.string().optional(),
  partnerLeads: z.array(partnerLeadSchema),
  admired: admiredResolutionSchema.optional(),
  warnings: z.array(z.string()),
});
export type LocalResearchOutput = z.infer<typeof localResearchOutputSchema>;

// ---------------------------------------------------------------------------
// Agent 2: Cultural Opportunity Finder
// ---------------------------------------------------------------------------

export const culturalBreakdownSchema = z.object({
  /** Mean raw Qloo affinity (0..1) of concept-type places for this locality's audience. */
  meanAffinity: z.number().optional(),
  /** Mean affinity here minus the mean for the same concept in the other localities compared. */
  localityLift: z.number().optional(),
  affinityPlaces: z.number(),
  /** 0..1: how much the affinity signals count, given how many places support them. */
  evidenceWeight: z.number(),
  affinityScore: z.number(),
  liftScore: z.number(),
  resonanceScore: z.number(),
});
export type CulturalBreakdown = z.infer<typeof culturalBreakdownSchema>;

export const opportunitySchema = z.object({
  conceptId: z.string(),
  locality: z.string(),
  culturalFit: z.number().min(0).max(100),
  breakdown: culturalBreakdownSchema,
  targetAudience: z.string(),
  hypothesis: z.string(),
  evidence: z.array(evidenceSchema),
  qlooSources: z.array(z.enum(["live", "recorded", "sample"])),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

/** A scored potential partner. A recommendation to contact, never a confirmed willing partner. */
export const partnerCandidateSchema = partnerLeadSchema.extend({
  fitScore: z.number(),
  audienceScore: z.number(),
  /** Similar: how closely they resemble your product. Complementary: how well their category suits it. Host: visibility. */
  secondaryScore: z.number(),
  secondaryLabel: z.string(),
  reputationScore: z.number(),
  productMatches: z.array(z.string()),
  reasons: z.array(z.string()),
  risks: z.array(z.string()),
  suggestedModel: z.enum(["consignment", "counter", "workshop", "wholesale"]),
  verifySteps: z.array(z.string()),
});
export type PartnerCandidate = z.infer<typeof partnerCandidateSchema>;

export const productProfileSchema = z.object({
  description: z.string().optional(),
  terms: z.array(z.string()),
  /** Qloo tags matched to the product words. */
  tags: z.array(z.object({ name: z.string(), type: z.string() })),
  source: z.enum(["user", "default"]),
});
export type ProductProfile = z.infer<typeof productProfileSchema>;

export const culturalOutputSchema = z.object({
  opportunities: z.array(opportunitySchema).min(1),
  partners: z.array(partnerCandidateSchema).default([]),
  productProfile: productProfileSchema.optional(),
  /** True when Qloo affinities could not be computed and neutral scores were used. */
  degraded: z.boolean(),
  warnings: z.array(z.string()),
});
export type CulturalOutput = z.infer<typeof culturalOutputSchema>;

// ---------------------------------------------------------------------------
// Agent 3: Feasibility Critic
// ---------------------------------------------------------------------------

export const costLineSchema = z.object({
  item: z.string(),
  amountInr: z.number(),
  note: z.string().optional(),
  source: z.literal("estimate"),
});
export type CostLine = z.infer<typeof costLineSchema>;

export const weightsSchema = z.object({
  culturalFit: z.number(),
  feasibility: z.number(),
  riskAdjustment: z.number(),
});
export type Weights = z.infer<typeof weightsSchema>;

export const confidenceSchema = z.object({
  level: confidenceLevelSchema,
  points: z.number(),
  reasons: z.array(z.object({ text: z.string(), effect: z.enum(["up", "down", "cap"]) })),
});
export type Confidence = z.infer<typeof confidenceSchema>;

export const verdictSchema = z.enum(["accepted", "downgraded", "rejected"]);

export const scoredOptionSchema = z.object({
  id: z.string(),
  rank: z.number(),
  conceptId: z.string(),
  conceptLabel: z.string(),
  locality: z.string(),
  verdict: verdictSchema,
  verdictReasons: z.array(z.string()),
  scores: z.object({
    culturalFit: z.number(),
    feasibility: z.number(),
    riskAdjustment: z.number(),
    /** Weighted sum before any downgrade penalty. */
    weighted: z.number(),
    penaltyFactor: z.number(),
    final: z.number(),
  }),
  culturalBreakdown: culturalBreakdownSchema,
  feasibilityBreakdown: z.object({
    budgetScore: z.number(),
    competitionScore: z.number(),
    logisticsScore: z.number(),
    permitScore: z.number(),
  }),
  riskBreakdown: z.object({
    recoverabilityScore: z.number(),
    breakevenScore: z.number(),
    skillScore: z.number(),
  }),
  costs: z.array(costLineSchema),
  totalCostInr: z.number(),
  /** Total minus reusable equipment: what the pilot must earn back to pay for itself. */
  runningCostInr: z.number(),
  stockUnits: z.number(),
  budgetUsedPct: z.number(),
  plannedUnits: z.number(),
  unitPriceInr: z.number(),
  unitLabel: z.string(),
  projectedRevenueInr: z.number(),
  competitorCount: z.number(),
  targetAudience: z.string(),
  hypothesis: z.string(),
  evidence: z.array(evidenceSchema),
  confidence: confidenceSchema,
});
export type ScoredOption = z.infer<typeof scoredOptionSchema>;

export const collabCostLineSchema = z.object({ item: z.string(), amountInr: z.number(), note: z.string().optional() });

export const collabAssumptionsSchema = z.object({
  commissionPct: z.number(),
  wholesaleDiscountPct: z.number(),
  workshopVenueSharePct: z.number(),
  counterFeePerDayInr: z.number(),
  unitsPerDay: z.number(),
  wholesaleUnitsPerWeek: z.number(),
  unitPriceInr: z.number(),
  seatsPerSession: z.number(),
});

/** Everything needed to recompute a collaboration model in the browser with changed assumptions. */
export const collabInputsSchema = z.object({
  model: z.enum(["consignment", "counter", "workshop", "wholesale"]),
  weekends: z.number(),
  budgetInr: z.number(),
  unitCostInr: z.number(),
  packagingPerUnitInr: z.number(),
  stockMultiplier: z.number(),
  counterSetupInr: z.number(),
  shelfSetupInr: z.number(),
  logisticsPerTripInr: z.number(),
  licenceInr: z.number(),
  workshop: z.object({ priceInr: z.number(), costPerSeatInr: z.number() }).optional(),
  assumptions: collabAssumptionsSchema,
});

export const collabOptionSchema = z.object({
  id: z.string(),
  partnerId: z.string(),
  partnerName: z.string(),
  partnerType: partnerTypeSchema,
  model: z.enum(["consignment", "counter", "workshop", "wholesale"]),
  label: z.string(),
  inputs: collabInputsSchema,
  units: z.number(),
  costs: z.array(collabCostLineSchema),
  upfrontInr: z.number(),
  grossRevenueInr: z.number(),
  partnerShareInr: z.number(),
  netRevenueInr: z.number(),
  profitInr: z.number(),
  breakevenUnits: z.number().optional(),
  budgetUsedPct: z.number(),
  verdict: verdictSchema,
  reasons: z.array(z.string()),
  requirements: z.array(z.string()),
  risks: z.array(z.string()),
  score: z.number(),
});
export type CollabOption = z.infer<typeof collabOptionSchema>;

export const partnerStrategySchema = z.object({
  status: z.enum(["ready", "no_partners", "none_affordable"]),
  conceptId: z.string(),
  conceptLabel: z.string(),
  options: z.array(collabOptionSchema),
  bestOptionId: z.string().optional(),
  message: z.string(),
});
export type PartnerStrategy = z.infer<typeof partnerStrategySchema>;

export const pricingSchema = z.object({
  conceptId: z.string(),
  locality: z.string(),
  tier: z.enum(["budget", "mid", "premium", "unknown"]),
  medianLevel: z.number().optional(),
  venuesUsed: z.number(),
  floorInr: z.number(),
  rangeInr: z.tuple([z.number(), z.number()]),
  suggestedInr: z.number(),
  unitCostInr: z.number(),
  packagingPerUnitInr: z.number(),
  explanation: z.array(z.string()),
  source: z.enum(["live", "recorded", "sample", "estimate"]),
});
export type Pricing = z.infer<typeof pricingSchema>;

export const strategySideSchema = z.object({
  title: z.string(),
  available: z.boolean(),
  score: z.number(),
  upfrontInr: z.number(),
  operatingNote: z.string(),
  financialRisk: z.enum(["Low", "Medium", "High"]),
  setupComplexity: z.enum(["Low", "Medium", "High"]),
  permissions: z.array(z.string()),
  audienceRelevance: z.string(),
  thirdPartyDependence: z.enum(["Low", "Medium", "High"]),
  timeToLaunch: z.string(),
  advantages: z.array(z.string()),
  disadvantages: z.array(z.string()),
  budgetFit: z.string(),
});

export const strategyComparisonSchema = z.object({
  solo: strategySideSchema,
  partner: strategySideSchema,
  recommended: z.enum(["solo", "partner", "none"]),
  reasons: z.array(z.string()),
});
export type StrategyComparison = z.infer<typeof strategyComparisonSchema>;

export const feasibilityOutputSchema = z.object({
  weights: weightsSchema,
  options: z.array(scoredOptionSchema).min(1),
  winnerId: z.string().optional(),
  partnerStrategy: partnerStrategySchema.optional(),
  comparison: strategyComparisonSchema.optional(),
  pricing: pricingSchema.optional(),
  warnings: z.array(z.string()),
});
export type FeasibilityOutput = z.infer<typeof feasibilityOutputSchema>;

// ---------------------------------------------------------------------------
// Agent 4: Pilot Planner
// ---------------------------------------------------------------------------

export const pilotRuleSchema = z.object({
  continueIf: z.string(),
  pivotIf: z.string(),
  stopIf: z.string(),
  continueUnits: z.number(),
  continueRevenueInr: z.number(),
  pivotUnits: z.number(),
  pivotRevenueInr: z.number(),
});

export const pilotPlanSchema = z.object({
  optionId: z.string(),
  title: z.string(),
  conceptLabel: z.string(),
  locality: z.string(),
  city: z.string(),
  targetAudience: z.string(),
  days: z.number(),
  weekends: z.number(),
  unitLabel: z.string(),
  quantities: z.array(z.object({ item: z.string(), quantity: z.number(), note: z.string().optional() })),
  pricePoints: z.array(z.object({ item: z.string(), priceInr: z.number(), note: z.string().optional() })),
  schedule: z.array(z.object({ when: z.string(), tasks: z.array(z.string()) })),
  checklist: z.array(z.string()),
  budget: z.array(costLineSchema),
  totalCostInr: z.number(),
  budgetInr: z.number(),
  bufferInr: z.number(),
  venueSuggestion: venueOptionSchema.optional(),
  successMetrics: z.array(z.object({ metric: z.string(), target: z.string() })),
  rule: pilotRuleSchema,
  predicted: z.object({
    units: z.number(),
    revenueInr: z.number(),
    footfall: z.number(),
    source: z.literal("estimate"),
  }),
  permitNotes: z.array(z.string()),
});
export type PilotPlan = z.infer<typeof pilotPlanSchema>;

/** A pilot run through an existing business. */
export const partnerPlanSchema = z.object({
  title: z.string(),
  conceptLabel: z.string(),
  product: z.string(),
  model: z.enum(["consignment", "counter", "workshop", "wholesale"]),
  modelLabel: z.string(),
  shortlist: z.array(
    z.object({
      partnerId: z.string(),
      name: z.string(),
      partnerType: partnerTypeSchema,
      locality: z.string(),
      model: z.string(),
      why: z.string(),
      outreach: z.object({ email: z.object({ subject: z.string(), body: z.string() }), short: z.string() }),
    }),
  ),
  budget: z.array(collabCostLineSchema),
  upfrontInr: z.number(),
  budgetInr: z.number(),
  timeline: z.array(z.object({ when: z.string(), tasks: z.array(z.string()) })),
  successMetrics: z.array(z.object({ metric: z.string(), target: z.string() })),
  rule: z.object({ continueIf: z.string(), pivotIf: z.string(), stopIf: z.string() }),
  validationSteps: z.array(z.string()),
  compliance: z.array(z.string()),
});
export type PartnerPlan = z.infer<typeof partnerPlanSchema>;

// ---------------------------------------------------------------------------
// Pilot results (predicted vs actual)
// ---------------------------------------------------------------------------

export const pilotActualsSchema = z.object({
  unitsSold: z.number().int().min(0).max(1_000_000),
  revenueInr: z.number().min(0).max(100_000_000),
  footfall: z.number().int().min(0).max(10_000_000),
});
export type PilotActuals = z.infer<typeof pilotActualsSchema>;

export const pilotVerdictSchema = z.object({
  decision: z.enum(["continue", "pivot", "stop"]),
  reason: z.string(),
  comparison: z.array(
    z.object({ metric: z.string(), predicted: z.number(), actual: z.number(), pctOfPredicted: z.number() }),
  ),
});
export type PilotVerdict = z.infer<typeof pilotVerdictSchema>;

// ---------------------------------------------------------------------------
// Narrative, baseline, events and the run result
// ---------------------------------------------------------------------------

export const narrativeSchema = z.object({
  headline: z.string(),
  whyThis: z.string(),
  pilotPitch: z.string(),
  source: z.enum(["llm", "template"]),
  note: z.string().optional(),
});
export type Narrative = z.infer<typeof narrativeSchema>;

/** What a generic assistant could say with no cultural or local data: the "Without Qloo" side. */
/** The same scoring re-run with Qloo signals removed, to show whether Qloo changed the answer. */
export const counterfactualSchema = z.object({
  winnerId: z.string().optional(),
  winnerLabel: z.string().optional(),
  winnerScore: z.number().optional(),
  /** True when the recommendation differs from the one made with Qloo signals. */
  winnerChanged: z.boolean(),
  /** How many options sit at a different rank than they do with Qloo signals. */
  ranksChanged: z.number(),
  totalOptions: z.number(),
  top: z.array(z.object({ id: z.string(), label: z.string(), score: z.number() })),
});
export type Counterfactual = z.infer<typeof counterfactualSchema>;

export const baselineSchema = z.object({
  summary: z.string(),
  options: z.array(
    z.object({ conceptId: z.string(), conceptLabel: z.string(), pros: z.array(z.string()), cons: z.array(z.string()) }),
  ),
  source: z.literal("template"),
});
export type Baseline = z.infer<typeof baselineSchema>;

export const agentStatusSchema = z.enum(["queued", "running", "completed", "failed", "skipped"]);
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const agentEventSchema = z.object({
  runId: z.string(),
  seq: z.number(),
  timestamp: z.string(),
  agent: agentNameSchema,
  status: agentStatusSchema,
  /** Short progress line while running, e.g. "Found 15 places in Indiranagar". */
  note: z.string().optional(),
  inputSummary: z.string().optional(),
  outputSummary: z.string().optional(),
  qlooCalls: z.array(qlooCallSchema).default([]),
  dataSources: z.array(dataSourceSchema).default([]),
  durationMs: z.number().optional(),
  warnings: z.array(z.string()).default([]),
  error: z.string().optional(),
});
export type AgentEvent = z.infer<typeof agentEventSchema>;

export const agentTraceSchema = z.object({
  agent: agentNameSchema,
  status: agentStatusSchema,
  inputSummary: z.string().optional(),
  outputSummary: z.string().optional(),
  notes: z.array(z.string()),
  qlooCalls: z.array(qlooCallSchema),
  dataSources: z.array(dataSourceSchema),
  durationMs: z.number().optional(),
  warnings: z.array(z.string()),
  error: z.string().optional(),
});
export type AgentTrace = z.infer<typeof agentTraceSchema>;

export const runResultSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  status: z.enum(["completed", "partial", "failed"]),
  message: z.string().optional(),
  input: runInputSchema,
  agents: z.array(agentTraceSchema),
  localities: z.array(localityProfileSchema),
  localitySource: z.enum(["user", "qloo_heatmap", "curated_fallback", "city_only"]).optional(),
  neighbourhoods: z.array(neighbourhoodCandidateSchema).default([]),
  partners: z.array(partnerCandidateSchema).default([]),
  admired: admiredResolutionSchema.optional(),
  productProfile: productProfileSchema.optional(),
  partnerStrategy: partnerStrategySchema.optional(),
  comparison: strategyComparisonSchema.optional(),
  pricing: pricingSchema.optional(),
  partnerPlan: partnerPlanSchema.optional(),
  options: z.array(scoredOptionSchema),
  weights: weightsSchema.optional(),
  winnerId: z.string().optional(),
  pilotPlan: pilotPlanSchema.optional(),
  baseline: baselineSchema.optional(),
  counterfactual: counterfactualSchema.optional(),
  narrative: narrativeSchema.optional(),
  qlooCallCounts: z.object({ live: z.number(), recorded: z.number(), sample: z.number() }),
  /** The overall Qloo data label for the run: the least trustworthy source that was used. */
  qlooSource: z.enum(["live", "recorded", "sample"]),
  disclaimer: z.string(),
  pilotResults: z.object({ actuals: pilotActualsSchema, verdict: pilotVerdictSchema, reportedAt: z.string() }).optional(),
});
export type RunResult = z.infer<typeof runResultSchema>;

/** Messages on the streaming run endpoint. */
export const streamMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), event: agentEventSchema }),
  z.object({ type: z.literal("result"), result: runResultSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type StreamMessage = z.infer<typeof streamMessageSchema>;
