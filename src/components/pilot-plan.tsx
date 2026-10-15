"use client";

import { useId, useState } from "react";
import { downloadText, partnerPlanToMarkdown, planToMarkdown, slugify } from "@/lib/export";
import { inr } from "@/lib/format";
import { evaluatePilot } from "@/lib/pilot";
import { pilotActualsSchema, type PartnerPlan, type PilotPlan, type RunResult } from "@/lib/schemas";
import { SourceBadge } from "./badges";
import { OutreachPanel } from "./partners";

function Card({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <section className="print-plain rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{title}</h3>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const DECISION_STYLE = {
  continue: { box: "border-leaf/40 bg-leaf-soft", text: "text-leaf", label: "Continue" },
  pivot: { box: "border-warn/40 bg-warn-soft", text: "text-warn", label: "Pivot" },
  stop: { box: "border-bad/40 bg-bad-soft", text: "text-bad", label: "Stop" },
} as const;

export function PilotResultsForm({ plan, saved, onSave }: { plan: PilotPlan; saved: RunResult["pilotResults"]; onSave: (results: NonNullable<RunResult["pilotResults"]>) => void }) {
  const uid = useId();
  const [units, setUnits] = useState(saved ? String(saved.actuals.unitsSold) : "");
  const [revenue, setRevenue] = useState(saved ? String(saved.actuals.revenueInr) : "");
  const [footfall, setFootfall] = useState(saved ? String(saved.actuals.footfall) : "");
  const [error, setError] = useState("");
  const digits = (v: string) => v.replace(/[^\d]/g, "").slice(0, 8);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (units === "" || revenue === "" || footfall === "") {
      setError("Fill in all three numbers. Enter 0 if nothing sold.");
      return;
    }
    const parsed = pilotActualsSchema.safeParse({ unitsSold: Number(units), revenueInr: Number(revenue), footfall: Number(footfall) });
    if (!parsed.success) {
      setError("Please enter whole numbers that are zero or more.");
      return;
    }
    setError("");
    onSave({ actuals: parsed.data, verdict: evaluatePilot(plan, parsed.data), reportedAt: new Date().toISOString() });
  };

  const fields = [
    { key: "units", label: `${plan.unitLabel[0]?.toUpperCase()}${plan.unitLabel.slice(1)}s sold`, value: units, set: setUnits, predicted: String(plan.predicted.units) },
    { key: "revenue", label: "Revenue (₹)", value: revenue, set: setRevenue, predicted: inr(plan.predicted.revenueInr) },
    { key: "footfall", label: "Footfall (people who passed your stall)", value: footfall, set: setFootfall, predicted: String(plan.predicted.footfall) },
  ];
  const verdict = saved?.verdict;
  const style = verdict ? DECISION_STYLE[verdict.decision] : undefined;

  return (
    <Card title="Report pilot results">
      <p className="text-sm text-muted">
        After your pilot, enter what actually happened. You will see predicted vs actual and a continue, pivot or stop verdict from the rule above. Results are saved in this run’s downloadable JSON.
      </p>
      <form onSubmit={submit} noValidate className="no-print mt-4 grid gap-4 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`${uid}-${f.key}`} className="text-sm font-semibold">
              {f.label}
            </label>
            <input
              id={`${uid}-${f.key}`}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:border-brand"
              value={f.value}
              onChange={(e) => f.set(digits(e.target.value))}
              aria-describedby={`${uid}-${f.key}-hint`}
            />
            <p id={`${uid}-${f.key}-hint`} className="mt-1 text-xs text-muted">
              Predicted: {f.predicted}
            </p>
          </div>
        ))}
        <div className="sm:col-span-3">
          {error && (
            <p role="alert" className="mb-2 text-sm font-medium text-bad">
              {error}
            </p>
          )}
          <button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
            {saved ? "Update verdict" : "Get verdict"}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {verdict && style && (
          <div className={`animate-rise mt-5 rounded-2xl border p-4 ${style.box}`}>
            <p className={`font-display text-2xl font-bold ${style.text}`}>Verdict: {style.label}</p>
            <p className="mt-1 text-sm">{verdict.reason}</p>
            <div className="mt-3 overflow-x-auto rounded-xl bg-card">
              <table className="w-full min-w-[420px] text-sm">
                <caption className="sr-only">Predicted versus actual pilot results</caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="p-2.5 font-semibold">
                      Metric
                    </th>
                    <th scope="col" className="p-2.5 text-right font-semibold">
                      Predicted
                    </th>
                    <th scope="col" className="p-2.5 text-right font-semibold">
                      Actual
                    </th>
                    <th scope="col" className="p-2.5 font-semibold">
                      Actual as % of predicted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {verdict.comparison.map((c) => (
                    <tr key={c.metric} className="border-b border-line last:border-0">
                      <th scope="row" className="p-2.5 text-left font-medium">
                        {c.metric}
                      </th>
                      <td className="p-2.5 text-right tabular-nums">{c.predicted.toLocaleString("en-IN")}</td>
                      <td className="p-2.5 text-right font-semibold tabular-nums">{c.actual.toLocaleString("en-IN")}</td>
                      <td className="p-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-24 overflow-hidden rounded-full bg-line" aria-hidden="true">
                            <span className={`block h-full rounded-full ${c.pctOfPredicted >= 100 ? "bg-leaf" : c.pctOfPredicted >= 50 ? "bg-spark" : "bg-bad"}`} style={{ width: `${Math.min(100, c.pctOfPredicted)}%` }} />
                          </span>
                          <span className="tabular-nums">{c.pctOfPredicted}%</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">Predictions were estimates made before the pilot. Your actual numbers are the first real evidence.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export function PilotPlanView({ result, plan, onSaveResults }: { result: RunResult; plan: PilotPlan; onSaveResults: (results: NonNullable<RunResult["pilotResults"]>) => void }) {
  const base = `culture2commerce-${slugify(plan.conceptLabel)}-${slugify(plan.locality)}`;
  const rules = [
    { ...DECISION_STYLE.continue, text: plan.rule.continueIf },
    { ...DECISION_STYLE.pivot, text: plan.rule.pivotIf },
    { ...DECISION_STYLE.stop, text: plan.rule.stopIf },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">{plan.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {plan.locality}, {plan.city} · {plan.days} days · {inr(plan.totalCostInr)} of {inr(plan.budgetInr)}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadText(`${base}-pilot-plan.md`, planToMarkdown(plan, result), "text/markdown")} className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold hover:border-brand">
            Download Markdown
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold hover:border-brand">
            Print or save as PDF
          </button>
          <button type="button" onClick={() => downloadText(`${base}-run-trace.json`, JSON.stringify(result, null, 2), "application/json")} className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold hover:border-brand">
            Download run trace (JSON)
          </button>
        </div>
      </div>

      {result.narrative && (
        <div className="rounded-2xl bg-brand-soft p-4">
          <p className="text-sm leading-6">{result.narrative.pilotPitch}</p>
          <div className="mt-2">
            <SourceBadge source={result.narrative.source} long />
          </div>
        </div>
      )}

      <Card title="Decision rule">
        <ul className="grid gap-3 md:grid-cols-3">
          {rules.map((r) => (
            <li key={r.label} className={`rounded-xl border p-3 ${r.box}`}>
              <p className={`font-display text-lg font-bold ${r.text}`}>{r.label}</p>
              <p className="mt-1 text-sm">{r.text.replace(/: (continue|pivot|stop)\. /, ". ")}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">“Continue” means the pilot earned back its running costs (everything except reusable equipment).</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Success metrics">
          <ul className="divide-y divide-line">
            {plan.successMetrics.map((m) => (
              <li key={m.metric} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-sm font-semibold">{m.metric}</span>
                <span className="text-sm text-muted sm:text-right">{m.target}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <span className="font-semibold">Who to aim at:</span> {plan.targetAudience}.
          </p>
        </Card>

        <Card title="What to prepare and what to charge">
          <table className="w-full text-sm">
            <caption className="sr-only">Quantities and prices</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 font-semibold">
                  Item
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Quantity
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.quantities.map((q, i) => (
                <tr key={q.item} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 text-left font-medium">
                    {q.item}
                    {q.note && <span className="block text-xs font-normal text-muted">{q.note}</span>}
                  </th>
                  <td className="py-2 text-right tabular-nums">{q.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{plan.pricePoints[i] ? inr(plan.pricePoints[i].priceInr) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.venueSuggestion && (
            <p className="mt-3 rounded-xl bg-paper p-3 text-sm">
              <span className="font-semibold">Suggested venue type:</span> {plan.venueSuggestion.type.toLowerCase()}. {plan.venueSuggestion.description} About{" "}
              {inr(plan.venueSuggestion.feePerDayInr)} per day. <SourceBadge source="estimate" />
            </p>
          )}
        </Card>

        <Card title="Budget" badge={<SourceBadge source="estimate" long />}>
          <table className="w-full text-sm">
            <caption className="sr-only">Budget breakdown</caption>
            <tbody>
              {plan.budget.map((b) => (
                <tr key={b.item} className="border-b border-line">
                  <th scope="row" className="py-2 text-left font-medium">
                    {b.item}
                    {b.note && <span className="block text-xs font-normal text-muted">{b.note}</span>}
                  </th>
                  <td className="py-2 text-right align-top tabular-nums">{inr(b.amountInr)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <th scope="row" className="py-2 text-left">
                  Total
                </th>
                <td className="py-2 text-right tabular-nums">{inr(plan.totalCostInr)}</td>
              </tr>
            </tbody>
          </table>
          <p className={`mt-2 text-sm ${plan.bufferInr >= 0 ? "text-leaf" : "text-bad"}`}>
            {plan.bufferInr >= 0 ? `${inr(plan.bufferInr)} of your ${inr(plan.budgetInr)} budget stays unspent as a buffer.` : `This is ${inr(-plan.bufferInr)} over your ${inr(plan.budgetInr)} budget.`}
          </p>
        </Card>

        <Card title="Setup checklist">
          <ul className="space-y-2">
            {plan.checklist.map((c) => (
              <li key={c} className="flex items-start gap-2.5 text-sm">
                <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 rounded border border-muted/50" />
                {c}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Schedule">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plan.schedule.map((s) => (
            <li key={s.when} className="rounded-xl bg-paper p-3">
              <p className="text-sm font-bold">{s.when}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                {s.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Permits and permissions" badge={<SourceBadge source="estimate" />}>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {plan.permitNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Card>

      <PilotResultsForm plan={plan} saved={result.pilotResults} onSave={onSaveResults} />
    </div>
  );
}

export function PartnerPlanView({ result, plan }: { result: RunResult; plan: PartnerPlan }) {
  const base = `culture2commerce-partner-${slugify(plan.shortlist[0]?.name ?? "pilot")}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">{plan.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {plan.modelLabel} · {inr(plan.upfrontInr)} of {inr(plan.budgetInr)} · {result.input.city}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadText(`${base}-plan.md`, partnerPlanToMarkdown(plan), "text/markdown")} className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold hover:border-brand">
            Download Markdown
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold hover:border-brand">
            Print or save as PDF
          </button>
          <button type="button" onClick={() => downloadText(`${base}-run-trace.json`, JSON.stringify(result, null, 2), "application/json")} className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold hover:border-brand">
            Download run trace (JSON)
          </button>
        </div>
      </div>

      <Card title="Who to contact, in this order">
        <ol className="space-y-4">
          {plan.shortlist.map((s, i) => (
            <li key={s.partnerId} className="rounded-xl border border-line p-3">
              <p className="font-semibold">
                {i + 1}. {s.name} <span className="font-normal text-muted">({s.partnerType}, {s.locality}) · {s.model}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted">{s.why}</p>
              <div className="mt-2">
                <OutreachPanel initial={s.outreach} />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">These are businesses worth contacting, not confirmed partners. Do not promise anything until terms are agreed in writing.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Success metrics">
          <ul className="divide-y divide-line">
            {plan.successMetrics.map((m) => (
              <li key={m.metric} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-sm font-semibold">{m.metric}</span>
                <span className="text-sm text-muted sm:text-right">{m.target}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Budget" badge={<SourceBadge source="estimate" long />}>
          <table className="w-full text-sm">
            <caption className="sr-only">Partner pilot budget</caption>
            <tbody>
              {plan.budget.map((b) => (
                <tr key={b.item} className="border-b border-line">
                  <th scope="row" className="py-2 text-left font-medium">
                    {b.item}
                    {b.note && <span className="block text-xs font-normal text-muted">{b.note}</span>}
                  </th>
                  <td className="py-2 text-right align-top tabular-nums">{inr(b.amountInr)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <th scope="row" className="py-2 text-left">
                  Total upfront
                </th>
                <td className="py-2 text-right tabular-nums">{inr(plan.upfrontInr)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Decision rule">
        <ul className="grid gap-3 md:grid-cols-3">
          {[
            { ...DECISION_STYLE.continue, text: plan.rule.continueIf },
            { ...DECISION_STYLE.pivot, text: plan.rule.pivotIf },
            { ...DECISION_STYLE.stop, text: plan.rule.stopIf },
          ].map((r) => (
            <li key={r.label} className={`rounded-xl border p-3 ${r.box}`}>
              <p className={`font-display text-lg font-bold ${r.text}`}>{r.label}</p>
              <p className="mt-1 text-sm">{r.text}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Timeline">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plan.timeline.map((s) => (
            <li key={s.when} className="rounded-xl bg-paper p-3">
              <p className="text-sm font-bold">{s.when}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                {s.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Before you invest more">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {[...plan.validationSteps, ...plan.compliance].map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
