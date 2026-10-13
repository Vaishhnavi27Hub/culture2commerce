import type { Confidence, ConfidenceLevel, RiskPreference, Weights } from "@/lib/schemas";

/**
 * Deterministic scoring. No LLM and no randomness: the same inputs always give the
 * same scores. Every formula here is shown to the user in the "How this was scored" panel.
 *
 *   final = w1·cultural_fit + w2·feasibility + w3·risk_adjustment      (each 0..100)
 */

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

/** A cautious user weights risk more; a bold user weights cultural fit more. */
export function weightsFor(risk: RiskPreference): Weights {
  if (risk === "low") return { culturalFit: 0.4, feasibility: 0.35, riskAdjustment: 0.25 };
  if (risk === "high") return { culturalFit: 0.55, feasibility: 0.3, riskAdjustment: 0.15 };
  return { culturalFit: 0.45, feasibility: 0.35, riskAdjustment: 0.2 };
}

// ---------------------------------------------------------------------------
// Cultural fit
// ---------------------------------------------------------------------------

/** Qloo affinities for relevant places cluster between about 0.70 and 0.98. */
export const AFFINITY_FLOOR = 0.7;
export const AFFINITY_CEIL = 0.98;

/** Linear rescale of a raw 0..1 Qloo affinity to 0..100. The raw value is always shown too. */
export function affinityToScore(affinity: number): number {
  return round1(clamp(((affinity - AFFINITY_FLOOR) / (AFFINITY_CEIL - AFFINITY_FLOOR)) * 100));
}

export const NEUTRAL_SCORE = 50;
/** A lift of this much raw affinity over the other localities scores 100; the same deficit scores 0. */
export const LIFT_FULL_SCALE = 0.04;
/** Affinity signals count fully once this many comparable places support them. */
export const FULL_EVIDENCE_PLACES = 5;
export const RESONANCE_FULL_MATCHES = 4;

export interface CulturalInputs {
  /** Mean raw affinity of concept-type places for the locality's audience; undefined if no data. */
  meanAffinity: number | undefined;
  /** How many comparable places that mean is based on. */
  affinityPlaces: number;
  /** Mean affinity here minus the mean in the other localities compared; undefined if none. */
  localityLift: number | undefined;
  /** How many taste-tag, brand, vibe and venue signals match the concept's keywords. */
  resonanceMatches: number;
}

/**
 * cultural_fit = 0.45·affinity + 0.35·locality lift + 0.20·resonance
 *
 * Both affinity terms are pulled towards neutral (50) when few places support them, so one
 * lucky match cannot dominate: score = 50 + (raw − 50) × min(1, places / 5).
 */
export function culturalFit(inputs: CulturalInputs) {
  const evidenceWeight = Math.min(1, inputs.affinityPlaces / FULL_EVIDENCE_PLACES);
  const shrink = (raw: number) => round1(NEUTRAL_SCORE + (raw - NEUTRAL_SCORE) * evidenceWeight);
  const affinityScore = inputs.meanAffinity === undefined ? NEUTRAL_SCORE : shrink(affinityToScore(inputs.meanAffinity));
  const liftScore =
    inputs.localityLift === undefined ? NEUTRAL_SCORE : shrink(clamp(50 + (inputs.localityLift / LIFT_FULL_SCALE) * 50));
  const resonanceScore = round1(clamp((inputs.resonanceMatches / RESONANCE_FULL_MATCHES) * 100));
  return {
    evidenceWeight: round1(evidenceWeight * 100) / 100,
    affinityScore,
    liftScore,
    resonanceScore,
    culturalFit: round1(0.45 * affinityScore + 0.35 * liftScore + 0.2 * resonanceScore),
  };
}

// ---------------------------------------------------------------------------
// Feasibility
// ---------------------------------------------------------------------------

export const DOWNGRADE_RATIO = 1.0;
export const REJECT_RATIO = 1.25;
export const DOWNGRADE_PENALTY = 0.85;
export const REJECT_PENALTY = 0.5;

/**
 * 100 while the plan leaves at least a 15% buffer, 60 at exactly the budget, 0 at 130% or more.
 * Spending less than 85% earns nothing extra: a cheaper plan is not a better plan, and this
 * keeps small differences between cost estimates from deciding the ranking.
 */
export function budgetScore(costToBudgetRatio: number): number {
  if (costToBudgetRatio <= 0.85) return 100;
  if (costToBudgetRatio <= 1) return round1(100 - ((costToBudgetRatio - 0.85) / 0.15) * 40);
  return round1(clamp(60 - ((costToBudgetRatio - 1) / 0.3) * 60));
}

/**
 * A few similar places nearby signal proven demand with room to stand out; many signal a
 * crowded market; none is ambiguous (open gap or no demand), so it scores in the middle.
 */
export function competitionScore(count: number): number {
  if (count === 0) return 70;
  if (count <= 3) return 100;
  if (count <= 8) return 75;
  if (count <= 15) return 50;
  return 30;
}

export interface FeasibilityInputs {
  costToBudgetRatio: number;
  competitorCount: number;
  complexity: number;
  permitComplexity: number;
}

export function feasibility(inputs: FeasibilityInputs) {
  const b = budgetScore(inputs.costToBudgetRatio);
  const c = competitionScore(inputs.competitorCount);
  const l = round1(clamp((1 - inputs.complexity) * 100));
  const p = round1(clamp((1 - inputs.permitComplexity) * 100));
  return {
    budgetScore: b,
    competitionScore: c,
    logisticsScore: l,
    permitScore: p,
    feasibility: round1(0.5 * b + 0.2 * c + 0.15 * l + 0.15 * p),
  };
}

// ---------------------------------------------------------------------------
// Risk adjustment (higher = safer)
// ---------------------------------------------------------------------------

export interface RiskInputs {
  /** Share of total spend that cannot be recovered if nothing sells (0..1). */
  unrecoverableShare: number;
  /** Running costs divided by projected revenue. Below 1 means the pilot should pay for itself. */
  breakevenShare: number;
  /** 0, 0.5 or 1: how well the user's skills match the concept. */
  skillMatch: number;
}

export function riskAdjustment(inputs: RiskInputs) {
  const recoverabilityScore = round1(clamp((1 - inputs.unrecoverableShare) * 100));
  // 100 when running costs are 60% of projected revenue or less, 0 at 140% or more.
  const breakevenScore = round1(clamp(((1.4 - inputs.breakevenShare) / 0.8) * 100));
  const skillScore = round1(clamp(40 + inputs.skillMatch * 60));
  return {
    recoverabilityScore,
    breakevenScore,
    skillScore,
    riskAdjustment: round1(0.4 * recoverabilityScore + 0.4 * breakevenScore + 0.2 * skillScore),
  };
}

// ---------------------------------------------------------------------------
// Final score
// ---------------------------------------------------------------------------

export function finalScore(
  scores: { culturalFit: number; feasibility: number; riskAdjustment: number },
  weights: Weights,
  verdict: "accepted" | "downgraded" | "rejected",
) {
  const weighted = round1(
    weights.culturalFit * scores.culturalFit +
      weights.feasibility * scores.feasibility +
      weights.riskAdjustment * scores.riskAdjustment,
  );
  const penaltyFactor = verdict === "rejected" ? REJECT_PENALTY : verdict === "downgraded" ? DOWNGRADE_PENALTY : 1;
  return { weighted, penaltyFactor, final: round1(weighted * penaltyFactor) };
}

// ---------------------------------------------------------------------------
// Confidence: about data quality, never a prediction of success
// ---------------------------------------------------------------------------

export interface ConfidenceInputs {
  /** Qloo sources behind this option's evidence. */
  qlooSources: ("live" | "recorded" | "sample")[];
  /** True when cultural scoring fell back to neutral values. */
  culturalDegraded: boolean;
  localityLevel: "locality" | "city";
  affinityPlaces: number;
  hasTasteOrBrandMatch: boolean;
  competitorDataFound: boolean;
  /** Points between this option and the next one in the ranking. */
  marginToNext: number | undefined;
  marketLocalitySpecific: boolean;
}

export function computeConfidence(i: ConfidenceInputs): Confidence {
  const reasons: Confidence["reasons"] = [];
  let points = 0;
  const allLive = i.qlooSources.length > 0 && i.qlooSources.every((s) => s === "live");
  const anySample = i.qlooSources.includes("sample");
  const anyRecorded = i.qlooSources.includes("recorded");

  if (allLive && !i.culturalDegraded) {
    points += 3;
    reasons.push({ text: "All cultural signals came from the live Qloo API", effect: "up" });
  } else if (!anySample && anyRecorded) {
    points += 1;
    reasons.push({ text: "Some cultural signals came from a recorded Qloo snapshot, not a live call", effect: "down" });
  } else {
    reasons.push({ text: "Cultural signals came from bundled sample data, not real Qloo data", effect: "down" });
  }

  if (i.localityLevel === "locality") {
    points += 2;
    reasons.push({ text: "Qloo resolved the neighbourhood itself, not just the city", effect: "up" });
  } else {
    reasons.push({ text: "Only city-level data was available for this area", effect: "down" });
  }

  if (i.affinityPlaces >= 5) {
    points += 1;
    reasons.push({ text: `${i.affinityPlaces} comparable places support the affinity score`, effect: "up" });
  } else {
    reasons.push({ text: `Only ${i.affinityPlaces} comparable places support the affinity score`, effect: "down" });
  }

  if (i.hasTasteOrBrandMatch) {
    points += 1;
    reasons.push({ text: "A second, independent signal (taste tags or brands) agrees", effect: "up" });
  } else {
    reasons.push({ text: "No second signal (taste tags or brands) backs this up", effect: "down" });
  }

  if (i.competitorDataFound) {
    points += 1;
    reasons.push({ text: "Similar places exist nearby, so demand is observable", effect: "up" });
  } else {
    reasons.push({ text: "No similar places found nearby: could be an open gap or missing data", effect: "down" });
  }

  if (i.marginToNext !== undefined && i.marginToNext >= 3) {
    points += 1;
    reasons.push({ text: `Clear lead of ${round1(i.marginToNext)} points over the next option`, effect: "up" });
  } else if (i.marginToNext !== undefined) {
    reasons.push({ text: `Narrow lead of ${round1(i.marginToNext)} points over the next option`, effect: "down" });
  }

  points -= 1;
  reasons.push({
    text: i.marketLocalitySpecific
      ? "Costs and footfall are estimates for this locality, not verified quotes"
      : "Costs and footfall are generic estimates, not specific to this locality",
    effect: "down",
  });
  if (!i.marketLocalitySpecific) points -= 1;

  let level: ConfidenceLevel = points >= 7 ? "High" : points >= 4 ? "Medium" : "Low";
  // Hard caps: fallback data can never look as trustworthy as live data.
  if (anySample || i.culturalDegraded) {
    if (level !== "Low") reasons.push({ text: "Capped at Low because sample or neutral data was used", effect: "cap" });
    level = "Low";
  } else if (anyRecorded && level === "High") {
    reasons.push({ text: "Capped at Medium because recorded data was used", effect: "cap" });
    level = "Medium";
  }
  return { level, points, reasons };
}
