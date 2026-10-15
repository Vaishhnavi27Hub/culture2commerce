"use client";

import { useId, useMemo, useState } from "react";
import { COLLAB_MODEL_INFO, computeCollab } from "@/lib/collab";
import { inr, score } from "@/lib/format";
import { buildOutreach } from "@/lib/outreach";
import type { CollabOption, PartnerCandidate, PartnerType, RunResult, StrategyComparison } from "@/lib/schemas";
import { SourceBadge, VerdictBadge } from "./badges";

const TYPE_LABEL: Record<PartnerType, string> = {
  similar: "Similar business",
  complementary: "Complementary business",
  host: "Potential high-visibility host",
};

const TYPE_STYLE: Record<PartnerType, string> = {
  similar: "bg-warn-soft text-warn border-warn/30",
  complementary: "bg-leaf-soft text-leaf border-leaf/30",
  host: "bg-brand-soft text-brand-dark border-brand/30",
};

function TypeBadge({ type }: { type: PartnerType }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[type]}`}>{TYPE_LABEL[type]}</span>;
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-xl font-bold">
        {title}
      </h3>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Solo vs partnership
// ---------------------------------------------------------------------------

export function ComparisonPanel({ comparison }: { comparison: StrategyComparison }) {
  const sides = [
    { key: "solo" as const, side: comparison.solo, heading: "On your own" },
    { key: "partner" as const, side: comparison.partner, heading: "With an existing business" },
  ];
  const rows: { label: string; get: (s: StrategyComparison["solo"]) => string }[] = [
    { label: "Upfront investment", get: (s) => (s.available ? inr(s.upfrontInr) : "n/a") },
    { label: "Budget fit", get: (s) => s.budgetFit },
    { label: "Operating costs", get: (s) => s.operatingNote },
    { label: "Financial risk", get: (s) => s.financialRisk },
    { label: "Setup complexity", get: (s) => s.setupComplexity },
    { label: "Permissions", get: (s) => s.permissions.join("; ") || "n/a" },
    { label: "Audience relevance", get: (s) => s.audienceRelevance },
    { label: "Depends on others", get: (s) => s.thirdPartyDependence },
    { label: "Time to launch", get: (s) => s.timeToLaunch },
  ];
  return (
    <section aria-labelledby="comparison-heading" className="animate-rise overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
      <div className="bg-ink p-5 text-white sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-white/70">Solo vs partnership</p>
        <h2 id="comparison-heading" className="mt-1 text-2xl font-bold sm:text-3xl">
          {comparison.recommended === "none"
            ? "Neither approach fits yet"
            : comparison.recommended === "solo"
              ? "Recommended: start on your own"
              : "Recommended: start with an existing business"}
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-white/85">
          {comparison.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Comparison of starting on your own and starting with an existing business</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="w-44 p-3" />
              {sides.map(({ key, side, heading }) => (
                <th key={key} scope="col" className={`p-3 align-top ${comparison.recommended === key ? "bg-brand-soft" : ""}`}>
                  <span className="block font-display text-base font-bold">
                    {heading} {comparison.recommended === key && <span className="ml-1 rounded-full bg-spark px-2 py-0.5 text-xs text-ink">Recommended</span>}
                  </span>
                  <span className="block text-xs font-normal text-muted">{side.title}</span>
                  {side.available ? (
                    <span className="mt-1 block font-display text-2xl font-bold tabular-nums">{score(side.score)}</span>
                  ) : (
                    <span className="mt-1 block text-sm font-semibold text-bad">Not available</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line align-top">
                <th scope="row" className="p-3 text-left font-medium text-muted">
                  {row.label}
                </th>
                {sides.map(({ key, side }) => (
                  <td key={key} className={`p-3 ${comparison.recommended === key ? "bg-brand-soft/50" : ""}`}>
                    {row.get(side)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="align-top">
              <th scope="row" className="p-3 text-left font-medium text-muted">
                Pros and cons
              </th>
              {sides.map(({ key, side }) => (
                <td key={key} className="p-3">
                  <ul className="space-y-0.5">
                    {side.advantages.map((a) => (
                      <li key={a} className="text-leaf">
                        + {a}
                      </li>
                    ))}
                    {side.disadvantages.map((d) => (
                      <li key={d} className="text-bad">
                        − {d}
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-line p-3 text-xs text-muted">
        Both sides use the same price, budget and duration. Partner terms (commission, fees, wholesale discount) are example assumptions until a partner confirms them.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Best partnership hero
// ---------------------------------------------------------------------------

export function PartnerStrategyCard({ result, onOpenPlan }: { result: RunResult; onOpenPlan: () => void }) {
  const s = result.partnerStrategy;
  if (!s) return null;
  const best = s.options.find((o) => o.id === s.bestOptionId);
  const partner = result.partners.find((p) => p.id === best?.partnerId);
  if (!best || !partner) {
    return (
      <section className="rounded-3xl border border-bad/30 bg-bad-soft p-5">
        <h2 className="text-2xl font-bold text-bad">{s.status === "no_partners" ? "No suitable partners found" : "No partnership fits this budget"}</h2>
        <p className="mt-1 text-sm">{s.message}</p>
        <p className="mt-2 text-sm">Try other localities, a different idea, a larger budget, or compare with starting on your own.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="partner-hero" className="animate-rise overflow-hidden rounded-3xl bg-ink text-white shadow-lg">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-spark px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">Best partnership</span>
          <span className="rounded-full border border-white/30 px-2 py-0.5 text-xs font-semibold">{TYPE_LABEL[partner.partnerType]}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h2 id="partner-hero" className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            {best.label} with {partner.name}
          </h2>
          <p className="text-right">
            <span className="font-display text-5xl font-bold tabular-nums">{score(best.score)}</span>
            <span className="text-white/70"> / 100</span>
          </p>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Partner", `${partner.name}${partner.genre ? ` (${partner.genre})` : ""}, ${partner.neighborhood ?? partner.locality}`],
            ["Format", COLLAB_MODEL_INFO[best.model].summary],
            ["Upfront", `${inr(best.upfrontInr)} of ${inr(result.input.budgetInr)}`],
            ["Break-even", best.breakevenUnits !== undefined ? `${best.breakevenUnits} sales (about ${best.units} expected)` : "Not reached at these terms"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</p>
              <p className="mt-1 text-sm font-semibold leading-snug">{value}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 space-y-1 text-sm text-white/90">
          {partner.reasons.filter((r) => !r.startsWith("Suggested format")).slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-white/70">A partner worth contacting, not a confirmed partner. Terms shown are example assumptions.</p>
        {result.partnerPlan && (
          <button type="button" onClick={onOpenPlan} className="no-print mt-5 inline-flex items-center gap-2 rounded-xl bg-spark px-5 py-3 text-sm font-bold text-ink hover:brightness-110">
            See the partner pilot and outreach messages <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Outreach
// ---------------------------------------------------------------------------

export function OutreachPanel({ initial }: { initial: { email: { subject: string; body: string }; short: string } }) {
  const uid = useId();
  const [tab, setTab] = useState<"email" | "short">("email");
  const [email, setEmail] = useState(`Subject: ${initial.email.subject}\n\n${initial.email.body}`);
  const [short, setShort] = useState(initial.short);
  const [copied, setCopied] = useState(false);
  const text = tab === "email" ? email : short;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-line bg-card p-0.5" role="group" aria-label="Message type">
          {(
            [
              ["email", "Email"],
              ["short", "WhatsApp / DM"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === value ? "bg-brand text-white" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} className="rounded-lg border border-line bg-card px-3 py-1 text-xs font-semibold hover:border-brand">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <label className="sr-only" htmlFor={`${uid}-${tab}`}>
        Editable {tab === "email" ? "email" : "short message"}
      </label>
      <textarea
        id={`${uid}-${tab}`}
        className="mt-2 min-h-44 w-full rounded-lg border border-line bg-card p-2.5 font-mono text-[13px] leading-5"
        value={text}
        onChange={(e) => (tab === "email" ? setEmail(e.target.value) : setShort(e.target.value))}
      />
      <p className="mt-1 text-xs text-muted">Edit freely. Replace the bracketed parts. Nothing is sent by the app; you send it yourself.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partner cards
// ---------------------------------------------------------------------------

function PartnerCard({ partner, result, selected, onSelect }: { partner: PartnerCandidate; result: RunResult; selected: boolean; onSelect: () => void }) {
  const [open, setOpen] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const fromPlan = result.partnerPlan?.shortlist.find((s) => s.partnerId === partner.id)?.outreach;
  const message = useMemo(
    () =>
      fromPlan ??
      buildOutreach({
        partnerName: partner.name,
        partnerType: partner.partnerType,
        product: result.productProfile?.source === "user" && result.productProfile.description ? result.productProfile.description : (result.partnerStrategy?.conceptLabel ?? "my products").toLowerCase(),
        conceptLabel: result.partnerStrategy?.conceptLabel ?? "small business",
        modelLabel: COLLAB_MODEL_INFO[partner.suggestedModel].label,
        whyForPartner: "I think your customers would enjoy what I make",
        pilotSummary: `${result.input.weekends} ${result.input.weekends === 1 ? "weekend" : "weekends"} with a small batch`,
        city: result.input.city,
      }),
    [fromPlan, partner, result],
  );
  const panelId = `partner-${partner.id}`;
  return (
    <li className={`rounded-2xl border bg-card ${selected ? "border-brand ring-2 ring-brand/15" : "border-line"}`}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 rounded-2xl p-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold [overflow-wrap:anywhere]">{partner.name}</span>
            <TypeBadge type={partner.partnerType} />
            {partner.viaAdmired && <span className="rounded-full bg-spark-soft px-2 py-0.5 text-xs font-semibold text-spark-dark">Like the business you admire</span>}
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            {[partner.genre, partner.neighborhood ?? partner.locality, partner.rating !== undefined ? `rated ${partner.rating.toFixed(1)}` : undefined, partner.costDescription].filter(Boolean).join(" · ")}
          </span>
          <span className="mt-1 block text-sm">{partner.reasons[0]}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-xl font-bold tabular-nums">{score(partner.fitScore)}</span>
          <span className="block text-[11px] text-muted">fit</span>
        </span>
      </button>
      {open && (
        <div id={panelId} className="space-y-3 border-t border-line px-4 pb-4 pt-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Audience fit", partner.audienceScore, partner.affinity !== undefined ? `Qloo affinity ${partner.affinity.toFixed(2)}` : "Not measured"],
              [partner.secondaryLabel, partner.secondaryScore, partner.productMatches.length ? `Matches: ${partner.productMatches.join(", ")}` : ""],
              ["Reputation", partner.reputationScore, partner.popularity !== undefined ? `Qloo popularity ${partner.popularity.toFixed(2)} (relative, not footfall)` : ""],
            ].map(([label, value, note]) => (
              <div key={String(label)} className="rounded-xl bg-paper p-2.5">
                <p className="text-xs text-muted">{label}</p>
                <p className="font-display text-lg font-bold tabular-nums">{score(Number(value))}</p>
                {note && <p className="text-xs text-muted [overflow-wrap:anywhere]">{note}</p>}
              </div>
            ))}
          </div>
          <div>
            <p className="font-semibold">Why it is recommended</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {partner.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          {partner.risks.length > 0 && (
            <div className="rounded-xl border border-warn/30 bg-warn-soft p-3 text-warn">
              <p className="font-semibold">Risks</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {partner.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="font-semibold">Check before you approach them</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {partner.verifySteps.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <SourceBadge source={partner.source} long />
            {partner.signalNote && <span>Affinity measured {partner.signalNote}. Affinity is an association in Qloo&rsquo;s data, not proof of shared customers.</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSelect} className="rounded-xl border border-line bg-card px-3 py-1.5 text-sm font-semibold hover:border-brand">
              Cost the collaboration options
            </button>
            <button type="button" onClick={() => setShowMessage((s) => !s)} className="rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
              {showMessage ? "Hide message" : "Write an outreach message"}
            </button>
          </div>
          {showMessage && <OutreachPanel initial={message} />}
        </div>
      )}
    </li>
  );
}

export function PartnerList({ result, selectedId, onSelect }: { result: RunResult; selectedId: string | undefined; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | PartnerType>("all");
  const counts = { similar: 0, complementary: 0, host: 0 };
  for (const p of result.partners) counts[p.partnerType]++;
  const shown = result.partners.filter((p) => filter === "all" || p.partnerType === filter);
  return (
    <Section
      id="partners-heading"
      title="Potential partners"
      subtitle="Businesses worth contacting, ranked by audience fit, product compatibility and reputation. None has agreed to anything yet."
    >
      {result.admired && (
        <p className={`mb-3 rounded-xl border p-3 text-sm ${result.admired.status === "matched" ? "border-leaf/30 bg-leaf-soft text-leaf" : "border-warn/30 bg-warn-soft text-warn"}`}>
          <span className="font-semibold">Business you admire:</span> {result.admired.note}
          {result.admired.alternatives.length > 0 && <span> Other matches: {result.admired.alternatives.join(", ")}.</span>}
        </p>
      )}
      <div className="no-print flex flex-wrap gap-1.5" role="group" aria-label="Filter partners by type">
        {(
          [
            ["all", `All (${result.partners.length})`],
            ["similar", `Similar (${counts.similar})`],
            ["complementary", `Complementary (${counts.complementary})`],
            ["host", `High-visibility hosts (${counts.host})`],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${filter === value ? "border-brand bg-brand text-white" : "border-line bg-card hover:border-brand"}`}>
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No partners of this type were found near the localities analysed.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((p) => (
            <PartnerCard key={p.id} partner={p} result={result} selected={p.id === selectedId} onSelect={() => onSelect(p.id)} />
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Collaboration calculator
// ---------------------------------------------------------------------------

function NumberField({ label, value, onChange, suffix, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; suffix?: string; min?: number; max?: number }) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 tabular-nums"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          {...(max !== undefined ? { max } : {})}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(min, max !== undefined ? Math.min(max, n) : n));
          }}
        />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

function OptionCalculator({ option, budgetInr }: { option: CollabOption; budgetInr: number }) {
  const [a, setA] = useState(option.inputs.assumptions);
  const r = computeCollab({ ...option.inputs, assumptions: a });
  const set = (k: keyof typeof a) => (n: number) => setA((prev) => ({ ...prev, [k]: n }));
  const changed = JSON.stringify(a) !== JSON.stringify(option.inputs.assumptions);
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg font-bold">{option.label}</p>
        <VerdictBadge verdict={option.verdict} />
      </div>
      <p className="mt-0.5 text-sm text-muted">{COLLAB_MODEL_INFO[option.model].summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumberField label="Your price per unit" value={a.unitPriceInr} onChange={set("unitPriceInr")} suffix="₹" />
        {option.model === "consignment" && <NumberField label="Partner commission" value={a.commissionPct} onChange={set("commissionPct")} suffix="%" max={90} />}
        {(option.model === "consignment" || option.model === "counter") && <NumberField label="Sales per day" value={a.unitsPerDay} onChange={set("unitsPerDay")} />}
        {option.model === "counter" && <NumberField label="Counter fee per day" value={a.counterFeePerDayInr} onChange={set("counterFeePerDayInr")} suffix="₹" />}
        {option.model === "wholesale" && <NumberField label="Wholesale discount" value={a.wholesaleDiscountPct} onChange={set("wholesaleDiscountPct")} suffix="%" max={90} />}
        {option.model === "wholesale" && <NumberField label="Units per week" value={a.wholesaleUnitsPerWeek} onChange={set("wholesaleUnitsPerWeek")} />}
        {option.model === "workshop" && <NumberField label="Seats per session" value={a.seatsPerSession} onChange={set("seatsPerSession")} />}
        {option.model === "workshop" && <NumberField label="Venue share" value={a.workshopVenueSharePct} onChange={set("workshopVenueSharePct")} suffix="%" max={90} />}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {[
          ["Upfront", inr(r.upfrontInr), r.upfrontInr > budgetInr ? "text-bad" : ""],
          ["Expected sales", `${r.units}`, ""],
          ["You receive", inr(r.netRevenueInr), ""],
          ["Profit", inr(r.profitInr), r.profitInr < 0 ? "text-bad" : "text-leaf"],
          ["Break-even", r.breakevenUnits !== undefined ? `${r.breakevenUnits} sales` : "Never at this price", r.breakevenUnits === undefined || r.breakevenUnits > r.units ? "text-warn" : ""],
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded-lg bg-paper p-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`font-semibold tabular-nums ${cls}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-semibold text-brand">Cost breakdown, requirements and risks</summary>
        <table className="mt-2 w-full">
          <tbody>
            {r.costs.map((c) => (
              <tr key={c.item} className="border-b border-line">
                <td className="py-1.5">
                  {c.item}
                  {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                </td>
                <td className="py-1.5 text-right tabular-nums">{inr(c.amountInr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 font-semibold">Requirements</p>
        <ul className="list-disc pl-5">{option.requirements.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-2 font-semibold">Risks</p>
        <ul className="list-disc pl-5">{option.risks.map((x) => <li key={x}>{x}</li>)}</ul>
      </details>
      {option.reasons.length > 0 && !changed && <p className="mt-2 text-xs text-muted">{option.reasons.join(" ")}</p>}
      {changed && (
        <button type="button" onClick={() => setA(option.inputs.assumptions)} className="mt-2 text-xs font-semibold text-brand hover:underline">
          Reset to the default assumptions
        </button>
      )}
    </div>
  );
}

export function CollabCalculator({ result, partnerId }: { result: RunResult; partnerId: string | undefined }) {
  const s = result.partnerStrategy;
  if (!s || s.options.length === 0) return null;
  const targetId = partnerId ?? s.options.find((o) => o.id === s.bestOptionId)?.partnerId ?? s.options[0]?.partnerId;
  const options = s.options.filter((o) => o.partnerId === targetId);
  const partner = result.partners.find((p) => p.id === targetId);
  return (
    <Section
      id="collab-heading"
      title={`Collaboration options${partner ? ` with ${partner.name}` : ""}`}
      subtitle="Commission, fees and discounts are example assumptions, not the partner's terms. Change them to see how costs and break-even move."
    >
      {options.length === 0 ? (
        <p className="text-sm text-muted">No collaboration format was costed for this partner (its fit score was too low). Pick another partner above.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {options.map((o) => (
            <OptionCalculator key={o.id} option={o} budgetInr={result.input.budgetInr} />
          ))}
        </div>
      )}
      {s.options.length > options.length && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-brand">All costed options ({s.options.length})</summary>
          <ul className="mt-2 space-y-1">
            {s.options.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2">
                <span>
                  {o.label} with <span className="font-medium">{o.partnerName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <VerdictBadge verdict={o.verdict} />
                  <span className="tabular-nums">{inr(o.upfrontInr)}</span>
                  <span className="font-display font-bold tabular-nums">{score(o.score)}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Pricing and neighbourhoods
// ---------------------------------------------------------------------------

export function PricingPanel({ result }: { result: RunResult }) {
  const p = result.pricing;
  const [price, setPrice] = useState(p?.suggestedInr ?? 0);
  if (!p) return null;
  const unitCost = p.unitCostInr + p.packagingPerUnitInr;
  const margin = price > 0 ? Math.round(((price - unitCost) / price) * 100) : 0;
  const tierLabel = { budget: "Budget", mid: "Mid-range", premium: "Premium", unknown: "Not enough data" }[p.tier];
  return (
    <Section id="pricing-heading" title="Price positioning" subtitle={`For the ${p.locality} audience. An estimate to test, not a verified price.`}>
      <div className="grid gap-4 rounded-2xl border border-line bg-card p-4 md:grid-cols-[1fr_16rem]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">{tierLabel} positioning</span>
            <SourceBadge source={p.source} long />
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">
            {inr(p.rangeInr[0])} to {inr(p.rangeInr[1])}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {p.explanation.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-paper p-3 text-sm">
          <NumberField label="Try a price" value={price} onChange={setPrice} suffix="₹" />
          <p className="mt-2">
            Cost per unit: <span className="font-semibold">{inr(unitCost)}</span>
          </p>
          <p>
            Gross margin: <span className={`font-semibold ${margin < 30 ? "text-bad" : "text-leaf"}`}>{margin}%</span>
          </p>
          {price < p.floorInr && <p className="mt-1 text-xs text-bad">Below the floor price of {inr(p.floorInr)}.</p>}
          <p className="mt-2 text-xs text-muted">A higher price lowers the number of sales needed to break even, but may sell fewer units.</p>
        </div>
      </div>
    </Section>
  );
}

export function NeighbourhoodPanel({ result }: { result: RunResult }) {
  if (result.neighbourhoods.length === 0) {
    if (result.localitySource === "curated_fallback" || result.localitySource === "city_only") {
      return <p className="rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">Qloo returned no neighbourhood ranking for this city, so {result.localitySource === "city_only" ? "the city was analysed as one area" : "a fixed starter list of areas was used"}.</p>;
    }
    return null;
  }
  const max = Math.max(...result.neighbourhoods.map((n) => n.affinity));
  const min = Math.min(...result.neighbourhoods.map((n) => n.affinity));
  return (
    <Section
      id="neighbourhoods-heading"
      title="Where your idea's audience is"
      subtitle="Neighbourhoods Qloo associates most strongly with this idea's audience. This is cultural affinity, not measured demand or foot traffic; the top three were analysed."
    >
      <ol className="space-y-1.5">
        {result.neighbourhoods.map((n) => {
          const width = max > min ? 30 + ((n.affinity - min) / (max - min)) * 70 : 100;
          return (
            <li key={n.name} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-right text-muted tabular-nums">{n.rank}</span>
              <span className="w-44 shrink-0 font-medium [overflow-wrap:anywhere]">{n.name}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className={`block h-full rounded-full ${n.selected ? "bg-brand" : "bg-muted/40"}`} style={{ width: `${width}%` }} />
              </span>
              <span className="w-14 text-right tabular-nums">{n.affinity.toFixed(3)}</span>
              <span className="hidden w-20 text-xs sm:block">{n.selected ? <span className="font-semibold text-brand">Analysed</span> : ""}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <SourceBadge source={result.neighbourhoods[0]!.source} long />
        <span>Affinity values are relative; small differences are not meaningful on their own.</span>
      </div>
    </Section>
  );
}
