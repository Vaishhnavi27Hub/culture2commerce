"use client";

import { Disclosure, SparkIcon, WalletIcon, FlagIcon, ChartIcon, PinIcon } from "./ui";
import {
  StoryIntro,
  StoryPeople,
  StoryMoney,
  StoryCompare,
  StorySummary,
} from "./story-visuals";
import {
  CulturalAffinityChart,
  ScoreBreakdown,
  ConfidencePanel,
  EvidenceTrail,
  FeasibilityBreakdown,
  RankedOptions,
  OptionDetail,
} from "./recommendation";
import { LocalityCompare, WithWithoutQloo } from "./compare";
import { CollabCalculator, ComparisonPanel, NeighbourhoodPanel, PartnerList, PricingPanel } from "./partners";
import type { ConceptCategory } from "@/lib/categories";
import type { RunResult, ScoredOption } from "@/lib/schemas";

/**
 * Story Scroll — like Spotify Wrapped for your business idea.
 *
 * Scroll through full-width cards, each with ONE animated insight.
 * Feels like a journey, not a report. Raw numbers stay behind
 * one "Show the numbers" disclosure at the very end.
 */

export function ResultsStory({
  result,
  winner,
  selected,
  setSelectedId,
  partnerId,
  setPartnerId,
  weights,
  categoryOf,
  hasPartner,
  otherCard,
}: {
  result: RunResult;
  winner: ScoredOption | undefined;
  selected: ScoredOption;
  setSelectedId: (id: string | undefined) => void;
  partnerId: string | undefined;
  setPartnerId: (id: string | undefined) => void;
  weights: RunResult["weights"];
  categoryOf: (conceptId: string) => ConceptCategory | undefined;
  hasPartner: boolean;
  otherCard: React.ReactNode;
}) {
  return (
    <div className="mt-10 space-y-6">
      {/* ── Story cards: scroll through one insight at a time ── */}

      {winner && (
        <StoryIntro winner={winner} total={result.options.length} />
      )}

      {winner && (
        <StoryPeople option={winner} />
      )}

      {winner && (
        <StoryMoney option={winner} budgetInr={result.input.budgetInr} />
      )}

      <StoryCompare
        result={result}
        selectedId={selected.id}
        onSelect={(id) => setSelectedId(id)}
      />

      {winner && (
        <StorySummary winner={winner} result={result} />
      )}

      {/* ── Location ──────────────────────────────────────────── */}
      <section className="rounded-3xl border border-line bg-card p-6 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-widest text-brand">📍 Location</p>
        <h3 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
          {winner ? `${winner.locality} came out strongest.` : "Compare the areas below."}
        </h3>
        <div className="mt-6 space-y-6">
          <LocalityCompare result={result} />
        </div>
      </section>

      {/* ── Partner section ────────────────────────────────────── */}
      {hasPartner && (
        <section className="rounded-3xl border border-line bg-card p-6 sm:p-10">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">🤝 Solo vs Partner</p>
          <h3 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            {result.comparison
              ? `We recommend ${result.comparison.recommended === "partner" ? "partnering" : "going solo"}.`
              : "Compare the two approaches below."}
          </h3>
          <p className="mt-2 text-muted">
            {result.comparison?.reasons[0]}
          </p>
          <div className="mt-6 space-y-6">
            {result.comparison && <ComparisonPanel comparison={result.comparison} />}
            {otherCard}
            {result.partners.length > 0 && (
              <PartnerList result={result} selectedId={partnerId} onSelect={setPartnerId} />
            )}
            <CollabCalculator result={result} partnerId={partnerId} />
          </div>
        </section>
      )}

      {/* ── Show the numbers — one toggle for everything ───── */}
      <section className="space-y-4">
        <p className="text-center text-sm text-muted">
          Want the full detail? Open any section below.
        </p>

        {winner && (
          <Disclosure
            tone="card"
            icon={<SparkIcon />}
            title="People & culture numbers"
            hint="Scoring formulas, weights, evidence trail"
          >
            <div className="space-y-5">
              <CulturalAffinityChart option={winner} />
              {weights && <ScoreBreakdown option={winner} weights={weights} />}
              <ConfidencePanel option={winner} />
              <div>
                <p className="mb-2 font-semibold">Evidence trail</p>
                <EvidenceTrail option={winner} />
              </div>
            </div>
          </Disclosure>
        )}

        {winner && (
          <Disclosure
            tone="card"
            icon={<WalletIcon />}
            title="Full cost & pricing breakdown"
            hint="Itemised costs, margins and pricing"
          >
            <div className="space-y-5">
              <FeasibilityBreakdown option={winner} budgetInr={result.input.budgetInr} />
              {winner.verdictReasons.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {winner.verdictReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <PricingPanel result={result} />
              <p className="text-xs text-muted">
                Stall fees, costs and commissions are planning estimates. Verify them locally before spending.
              </p>
            </div>
          </Disclosure>
        )}

        <Disclosure
          tone="card"
          icon={<ChartIcon />}
          title="All ideas ranked with full detail"
          hint={`All ${result.options.length} options with scoring`}
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_1fr]">
            <RankedOptions result={result} selectedId={selected.id} onSelect={setSelectedId} categoryOf={categoryOf} />
            {weights && <OptionDetail result={result} option={selected} weights={weights} />}
          </div>
        </Disclosure>

        {result.neighbourhoods.length > 0 && (
          <Disclosure
            tone="card"
            icon={<PinIcon />}
            title="Neighbourhood ranking"
            hint="Qloo's audience affinity heatmap for this area"
          >
            <NeighbourhoodPanel result={result} />
          </Disclosure>
        )}

        {winner && (
          <Disclosure
            tone="card"
            icon={<FlagIcon />}
            title="How Qloo influenced this decision"
            hint="Generic advice without Qloo, compared with the culturally informed answer"
          >
            <WithWithoutQloo result={result} winner={winner} />
          </Disclosure>
        )}
      </section>
    </div>
  );
}
