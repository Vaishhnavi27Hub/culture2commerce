"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DISCLAIMER, TEAM_CREDIT } from "@/lib/brand";
import { AgentPipeline } from "./agent-pipeline";
import { LocalityCompare, WithWithoutQloo } from "./compare";
import { CityHero, HeroHeadline } from "./hero";
import { InputForm } from "./input-form";
import { CollabCalculator, ComparisonPanel, NeighbourhoodPanel, PartnerList, PartnerStrategyCard, PricingPanel } from "./partners";
import { PartnerPlanView, PilotPlanView } from "./pilot-plan";
import { ConfidencePanel, CulturalAffinityChart, EvidenceTrail, FeasibilityBreakdown, OptionDetail, RankedOptions, ScoreBreakdown, WinnerCard } from "./recommendation";
import { useRun } from "./run-provider";
import { ArrowIcon, ChartIcon, ClockIcon, Disclosure, FlagIcon, PeopleIcon, PinIcon, Reveal, SectionHeading, Segmented, SparkIcon, Stagger, StaggerItem, WalletIcon } from "./ui";

/**
 * The five pages of the journey. Each is a thin view over the shared run state in RunProvider,
 * reusing the existing analysis components; only their arrangement changes.
 */

function PageShell({ children, wide = true }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full ${wide ? "max-w-6xl" : "max-w-3xl"} px-4 pb-16 pt-6 sm:px-6 sm:pt-10`}>
      {children}
      <p className="mt-14 border-t border-line pt-4 text-center text-xs text-muted">{DISCLAIMER}</p>
    </div>
  );
}

/** Focus the page heading after client-side navigation, so screen readers announce the new page. */
function useFocusHeading() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

function NothingYet({ title, text }: { title: string; text: string }) {
  return (
    <PageShell wide={false}>
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted">{text}</p>
        <Link href="/discover" className="btn-primary mt-6 px-5 py-3 text-sm">
          Discover an opportunity <ArrowIcon />
        </Link>
      </div>
    </PageShell>
  );
}

function Loading() {
  return (
    <PageShell wide={false}>
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// 1. Landing
// ---------------------------------------------------------------------------

const STEPS = [
  { title: "Research locally", text: "Qloo ranks the neighbourhoods and venues most linked to your idea’s audience.", icon: <PinIcon />, tone: "bg-sage text-brand" },
  { title: "Find cultural fit", text: "Taste affinities show which ideas resonate with the people already in each area.", icon: <SparkIcon />, tone: "bg-lavender text-lavender-ink" },
  { title: "Evaluate feasibility", text: "Costs, competition and risk are checked against your budget, with reasons for every rejection.", icon: <WalletIcon />, tone: "bg-spark-soft text-spark-dark" },
  { title: "Plan a pilot", text: "The winner becomes a small, low-cost experiment with a clear continue, pivot or stop rule.", icon: <FlagIcon />, tone: "bg-info-soft text-info" },
];

export function LandingPage() {
  const { config } = useRun();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <CityHero discoverHref="/discover" learnHref="#how-it-works">
        <HeroHeadline />
      </CityHero>

      <section id="how-it-works" aria-labelledby="how-heading" className="mt-6 scroll-mt-24 sm:mt-10">
        <Reveal>
          <SectionHeading id="how-heading" eyebrow="How it works" title="Four agents, one clear next step" subtitle="Each agent hands its findings to the next, so you end with one opportunity and a plan to test it." />
        </Reveal>
        <Stagger as="ol" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <StaggerItem as="li" key={s.title}>
              <div className="card lift relative h-full p-5">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-full ${s.tone}`}>
                    {s.icon}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Agent {i + 1}</span>
                </div>
                <p className="mt-3 font-display text-xl font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
                {i < STEPS.length - 1 && (
                  <span aria-hidden="true" className="absolute -right-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card text-xs text-muted lg:flex">
                    →
                  </span>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section aria-labelledby="example-heading" className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <SectionHeading
            id="example-heading"
            eyebrow="What you get"
            title="One specific bet, not a list of pros and cons"
            subtitle="A concept, a locality, the audience to target, and a small pilot with costs and a decision rule. Every number shows whether it came from live Qloo data or an estimate."
          />
          <Link href="/discover" className="btn-primary mt-6 px-6 py-3.5 text-base">
            Discover Opportunity <ArrowIcon />
          </Link>
        </Reveal>
        <Reveal delay={0.1}>
          <figure className="card relative overflow-hidden p-5 sm:p-6">
            <span className="absolute right-4 top-4 rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-muted">Example · illustrative</span>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">Top opportunity</p>
            <p className="mt-1 font-display text-2xl font-semibold">Art print pop-up</p>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <PinIcon /> Koramangala, Bengaluru
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {[
                ["Overall score", "78 / 100", <ChartIcon key="c" />],
                ["Pilot investment", "≈ ₹13,000", <WalletIcon key="w" />],
                ["Duration", "2 weekends", <ClockIcon key="k" />],
                ["Audience", "Ages 25 to 34", <PeopleIcon key="p" />],
              ].map(([label, value, icon]) => (
                <div key={String(label)} className="rounded-xl bg-paper p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                    {icon}
                    {label}
                  </dt>
                  <dd className="mt-0.5 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <figcaption className="mt-3 text-xs text-muted">Shape of a real result from an earlier run in Bengaluru. Your numbers will differ.</figcaption>
          </figure>
        </Reveal>
      </section>

      <section id="about" aria-labelledby="about-heading" className="mt-14 scroll-mt-24">
        <Reveal>
          <div className="card grid gap-6 p-6 sm:p-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeading id="about-heading" eyebrow="About" title="Built for first-time entrepreneurs" />
              <p className="mt-3 text-muted">
                Culture2Commerce helps students, artists and small sellers test a weekend stall, workshop or partnership before committing to a shop. Cultural signals come from Qloo’s taste graph; costs are
                planning estimates you can verify locally.
              </p>
              <p className="mt-3 text-sm font-semibold">{TEAM_CREDIT} · Qloo Agentic Hackathon</p>
            </div>
            <ul className="space-y-2 text-sm">
              {[
                ["Live Qloo data", "neighbourhoods, venues, affinities, price levels"],
                ["Estimates", "stall fees, costs, commissions (labelled everywhere)"],
                ["Fixed formulas", "scores and money maths; no AI changes a number"],
              ].map(([k, v]) => (
                <li key={k} className="rounded-xl bg-paper p-3">
                  <span className="font-semibold">{k}:</span> <span className="text-muted">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        {config.qlooStatus !== "live" && (
          <p className="mt-4 rounded-2xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
            {config.qlooStatus === "recorded"
              ? "The live Qloo API is not configured here, so runs use a recorded Qloo snapshot."
              : "No Qloo API key is configured here, so runs use bundled sample data. Results are illustrative, not real Qloo signals."}
          </p>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Discover (input form)
// ---------------------------------------------------------------------------

export function DiscoverPage() {
  const { config, hydrated, running, issues, start, draft, setDraft } = useRun();
  const heading = useFocusHeading();
  return (
    <PageShell wide={false}>
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <span aria-hidden="true">←</span> Back to home
      </Link>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">Discover an opportunity</p>
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none sm:text-4xl">
          Tell us what, where and how much
        </h1>
        <p className="mt-1.5 text-muted">Takes about a minute. Nothing personal is needed.</p>
      </div>
      <div className="card mt-6 p-5 sm:p-8">
        {hydrated ? (
          <InputForm concepts={config.concepts} knownLocalities={config.knownLocalities} busy={running} serverIssues={issues} onSubmit={start} draft={draft} onDraftChange={setDraft} />
        ) : (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-40 w-full" />
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// 3. Agents at work
// ---------------------------------------------------------------------------

export function AgentsPage() {
  const { hydrated, traces, running, result, error } = useRun();
  const router = useRouter();
  const started = running || Boolean(result) || Boolean(error) || traces.some((t) => t.status !== "queued");
  if (!hydrated) return <Loading />;
  if (!started) return <NothingYet title="No discovery is running" text="Start by describing your idea, and four agents will analyse it here." />;
  return (
    <PageShell>
      {error && (
        <div role="alert" className="mb-6 rounded-2xl border border-bad/30 bg-bad-soft p-4 text-bad">
          <p className="font-semibold">The run could not finish.</p>
          <p className="mt-1 text-sm">{error}</p>
          <Link href="/discover" className="mt-3 inline-flex rounded-xl bg-bad px-4 py-2 text-sm font-semibold text-on-brand">
            Back to your inputs
          </Link>
        </div>
      )}
      <AgentPipeline traces={traces} running={running} />
      {result && (
        <div className="animate-rise card mt-6 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-semibold">
              {result.status === "completed" ? "All four agents finished." : result.status === "partial" ? "Finished, but some detail is missing." : "The run stopped early."}{" "}
              <span className="font-normal text-muted">
                {result.qlooCallCounts.live} live, {result.qlooCallCounts.recorded} recorded and {result.qlooCallCounts.sample} sample Qloo calls.
              </span>
            </p>
            {result.message && <p className="mt-1 text-sm text-warn">{result.message}</p>}
            {result.status === "partial" && <p className="mt-1 text-sm text-warn">The recommendation may be incomplete; check the warnings on each agent.</p>}
          </div>
          {result.options.length > 0 && (
            <button type="button" onClick={() => router.push("/recommendation")} className="btn-primary mt-3 w-full shrink-0 px-5 py-3 text-sm sm:mt-0 sm:w-auto">
              See the recommendation <ArrowIcon />
            </button>
          )}
        </div>
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// 4. Recommendation
// ---------------------------------------------------------------------------

export function RecommendationPage() {
  const { hydrated, result, running, selectedId, setSelectedId, partnerId, setPartnerId, setPlanTab, config } = useRun();
  const router = useRouter();
  const heading = useFocusHeading();
  if (!hydrated) return <Loading />;
  if (!result || result.options.length === 0) {
    return running ? (
      <NothingYet title="Your agents are still working" text="The recommendation appears as soon as the four agents finish." />
    ) : (
      <NothingYet title="No recommendation yet" text="Run a discovery first; the recommendation will appear here." />
    );
  }

  const mode = result.input.launchMode;
  const winner = result.options.find((o) => o.id === result.winnerId);
  const selected = result.options.find((o) => o.id === selectedId) ?? winner ?? result.options[0];
  const categoryOf = (conceptId: string) => config.concepts.find((c) => c.id === conceptId)?.category;
  const openPlan = (tab: "solo" | "partner") => {
    setPlanTab(tab);
    router.push("/plan");
  };
  // Which card leads the page: the approach the comparison recommends, or the one the user chose.
  const partnerFirst = mode === "partner" || (mode === "both" && result.comparison?.recommended === "partner");
  const hasPartner = mode !== "solo";

  const soloCard =
    mode !== "partner" &&
    (winner ? (
      <WinnerCard result={result} winner={winner} onOpenPlan={() => openPlan("solo")} />
    ) : (
      <div className="rounded-2xl border border-bad/30 bg-bad-soft p-5">
        <h2 className="text-2xl font-semibold text-bad">No solo option fits this budget</h2>
        <p className="mt-1 text-sm">The comparison below shows why. Try a larger budget, fewer weekends, a simpler idea, or a partnership.</p>
      </div>
    ));
  const partnerCard = hasPartner && <PartnerStrategyCard result={result} onOpenPlan={() => openPlan("partner")} />;

  return (
    <PageShell>
      <h1 ref={heading} tabIndex={-1} className="sr-only">
        Recommendation
      </h1>
      {result.message && <p className="mb-6 rounded-2xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">{result.message}</p>}

      <div className="space-y-6">
        {partnerFirst ? partnerCard : soloCard}
        {mode === "both" && result.comparison && (
          <p className="rounded-2xl border border-line bg-card p-3 text-sm">
            <span className="font-semibold">Compared with {partnerFirst ? "going solo" : "partnering"}: </span>
            <span className="text-muted">{result.comparison.reasons[0]}</span>{" "}
            <a href="#analysis-partner" className="font-semibold text-brand underline-offset-4 hover:underline">
              See the comparison
            </a>
          </p>
        )}
      </div>

      <section id="analysis" aria-labelledby="analysis-heading" className="mt-12 scroll-mt-24">
        <SectionHeading id="analysis-heading" eyebrow="Supporting analysis" title="The evidence behind it" subtitle="Open any section for the details. Nothing here changes the recommendation above." />
        <div className="mt-5 space-y-3">
          {winner && (
            <Disclosure tone="card" icon={<SparkIcon />} title="Cultural evidence and reasoning" hint="Qloo signals, evidence strength and how cultural fit is scored">
              <div id="analysis-cultural" className="space-y-5">
                <CulturalAffinityChart option={winner} />
                {result.weights && <ScoreBreakdown option={winner} weights={result.weights} />}
                <ConfidencePanel option={winner} />
                <div>
                  <p className="mb-2 font-semibold">Evidence trail</p>
                  <EvidenceTrail option={winner} />
                </div>
                <WithWithoutQloo result={result} winner={winner} />
              </div>
            </Disclosure>
          )}
          <Disclosure tone="card" icon={<WalletIcon />} title="Feasibility, costs and risks" hint="Budget fit, cost breakdown, price positioning and what still needs checking">
            <div className="space-y-5">
              {winner && <FeasibilityBreakdown option={winner} budgetInr={result.input.budgetInr} />}
              {winner && winner.verdictReasons.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {winner.verdictReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <PricingPanel result={result} />
              <p className="rounded-xl border border-warn/30 bg-warn-soft p-3 text-warn">Stall fees, costs and commissions are illustrative estimates. Verify them locally before spending.</p>
            </div>
          </Disclosure>
          <Disclosure tone="card" icon={<ChartIcon />} title="Compare other opportunities" hint={`All ${result.options.length} options, ranked, with the reasons for each score`}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_1fr]">
              <RankedOptions result={result} selectedId={selected?.id ?? ""} onSelect={setSelectedId} categoryOf={categoryOf} />
              {selected && result.weights && <OptionDetail result={result} option={selected} weights={result.weights} />}
            </div>
          </Disclosure>
          <Disclosure tone="card" icon={<PinIcon />} title="Locality analysis" hint="How the answer changes by area, and where the idea’s audience is">
            <div className="space-y-6">
              <LocalityCompare result={result} />
              <NeighbourhoodPanel result={result} />
            </div>
          </Disclosure>
          {hasPartner && (
            <Disclosure tone="card" icon={<PeopleIcon />} title="Partner strategy" hint="Potential partners, collaboration options and the solo vs partner comparison">
              <div id="analysis-partner" className="space-y-6">
                {result.comparison && <ComparisonPanel comparison={result.comparison} />}
                {mode === "both" && (partnerFirst ? soloCard : partnerCard)}
                {result.partners.length > 0 && <PartnerList result={result} selectedId={partnerId} onSelect={setPartnerId} />}
                <CollabCalculator result={result} partnerId={partnerId} />
              </div>
            </Disclosure>
          )}
        </div>
      </section>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// 5. Pitch & Pilot
// ---------------------------------------------------------------------------

export function PlanPage() {
  const { hydrated, result, planTab, setPlanTab, saveResults } = useRun();
  const router = useRouter();
  const heading = useFocusHeading();
  if (!hydrated) return <Loading />;
  if (!result || !(result.pilotPlan || result.partnerPlan)) {
    return <NothingYet title="No pilot plan yet" text="A pilot plan is built at the end of a discovery run." />;
  }
  const both = Boolean(result.pilotPlan && result.partnerPlan);
  const showPartner = Boolean(result.partnerPlan && (planTab === "partner" || !result.pilotPlan));
  return (
    <PageShell>
      <h1 ref={heading} tabIndex={-1} className="sr-only">
        Pitch and pilot plan
      </h1>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/recommendation" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <span aria-hidden="true">←</span> Back to the recommendation
        </Link>
        {both && (
          <Segmented
            role="tablist"
            label="Choose a pilot plan"
            value={showPartner ? "partner" : "solo"}
            onChange={setPlanTab}
            options={[
              ["solo", <>On your own{result.comparison?.recommended === "solo" && <span className="ml-1.5 rounded-full bg-spark px-1.5 py-0.5 text-[10px] text-[#2b2540]">Recommended</span>}</>],
              ["partner", <>With a partner{result.comparison?.recommended === "partner" && <span className="ml-1.5 rounded-full bg-spark px-1.5 py-0.5 text-[10px] text-[#2b2540]">Recommended</span>}</>],
            ]}
          />
        )}
      </div>
      {showPartner && result.partnerPlan ? (
        <PartnerPlanView result={result} plan={result.partnerPlan} onEditInputs={() => router.push("/discover")} />
      ) : (
        result.pilotPlan && <PilotPlanView result={result} plan={result.pilotPlan} onSaveResults={saveResults} onEditInputs={() => router.push("/discover")} />
      )}
    </PageShell>
  );
}
