"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import { budgetSplit, winnerReasons } from "@/lib/explain";
import { downloadText, partnerPlanToMarkdown, planToMarkdown, slugify } from "@/lib/export";
import { inr, score, splitAudience } from "@/lib/format";
import { evaluatePilot } from "@/lib/pilot";
import { pilotActualsSchema, type PartnerPlan, type PilotPlan, type RunResult } from "@/lib/schemas";
import { EstimateHint } from "./badges";
import { ChartFrame, Funnel, HBarChart, StackedBar } from "./charts";
import { OutreachPanel } from "./partners";
import { AlertIcon, ArrowIcon, ChartIcon, CheckIcon, ClockIcon, Disclosure, EmptyState, FlagIcon, IdeaIcon, Kpi, ListIcon, PeopleIcon, PinIcon, SparkIcon, Stagger, StaggerItem, WalletIcon } from "./ui";

/**
 * Launch Plan: the recommendation first, the details only on request.
 * A founder should see what to test, where, for whom, for how much and how to judge it within seconds;
 * the schedule, checklist, permits, risks and alternatives stay one click away.
 */

function Card({ title, children, badge, icon, id }: { title: string; children: React.ReactNode; badge?: React.ReactNode; icon?: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="print-plain card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="flex items-center gap-2 text-xl font-semibold">
          {icon && (
            <span aria-hidden="true" className="text-brand">
              {icon}
            </span>
          )}
          {title}
        </h3>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const DECISION_STYLE = {
  continue: { box: "border-leaf/30 bg-leaf-soft", text: "text-leaf", label: "Continue", mark: "✓" },
  pivot: { box: "border-warn/30 bg-warn-soft", text: "text-warn", label: "Pivot", mark: "↻" },
  stop: { box: "border-bad/30 bg-bad-soft", text: "text-bad", label: "Stop", mark: "✕" },
} as const;

/** Rule texts are written as "<condition>: continue. <next step>". Show the condition first, the next step quieter. */
function splitRule(text: string) {
  const m = text.match(/^(.*?):\s*(continue|pivot|stop)[^.]*\.\s*(.*)$/i);
  return m ? { when: m[1]!, then: m[3]! } : { when: text, then: "" };
}

function DecisionRule({ rule }: { rule: { continueIf: string; pivotIf: string; stopIf: string } }) {
  const rows = [
    { ...DECISION_STYLE.continue, ...splitRule(rule.continueIf) },
    { ...DECISION_STYLE.pivot, ...splitRule(rule.pivotIf) },
    { ...DECISION_STYLE.stop, ...splitRule(rule.stopIf) },
  ];
  return (
    <Card title="Decision rule" icon={<FlagIcon />} id="decision-rule-heading">
      <ul className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <li key={r.label} className={`rounded-2xl border p-3.5 ${r.box}`}>
            <p className={`flex items-center gap-2 font-display text-lg font-semibold ${r.text}`}>
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm">
                {r.mark}
              </span>
              {r.label}
            </p>
            <p className="mt-1.5 text-sm font-medium">{r.when}</p>
            {r.then && <p className="mt-1 text-xs text-muted">{r.then}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces: summary card, three steps, goals, actions
// ---------------------------------------------------------------------------

function SummaryField({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="font-semibold leading-snug">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function RecommendedPilot({ eyebrow, title, reason, fields }: { eyebrow: string; title: string; reason?: string; fields: React.ReactNode }) {
  return (
    <motion.section
      aria-labelledby="pilot-summary-heading"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="print-plain relative overflow-hidden rounded-[1.75rem] border border-line bg-card p-5 shadow-[var(--shadow-lift)] sm:p-7"
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-spark to-brand print:hidden" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lavender/70 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">{eyebrow}</p>
        <h2 id="pilot-summary-heading" className="mt-1 text-2xl font-semibold leading-tight sm:text-[2.1rem]">
          {title}
        </h2>
        {reason && (
          <p className="mt-2 flex items-start gap-2 text-sm text-muted">
            <span aria-hidden="true" className="mt-0.5 text-leaf">
              <CheckIcon />
            </span>
            {reason}
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields}</div>
      </div>
    </motion.section>
  );
}

interface Step {
  name: string;
  action: string;
  meta: string[];
  tasks: { when: string; tasks: string[] }[];
}

/** Groups a dated schedule into Prepare, Test and Measure, keeping every original task. */
function groupSchedule(schedule: { when: string; tasks: string[] }[]) {
  const last = schedule.length - 1;
  const isPrep = (w: string, i: number) => /before|^days? \d/i.test(w) || (i === 0 && !/weekend/i.test(w));
  const prepare = schedule.filter((s, i) => i !== last && isPrep(s.when, i));
  const measure = last >= 0 && /^after/i.test(schedule[last]!.when) ? [schedule[last]!] : [];
  const test = schedule.filter((s) => !prepare.includes(s) && !measure.includes(s));
  return { prepare, test, measure };
}

function PilotSteps({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState<number | undefined>();
  const icons = [<ListIcon key="p" />, <PinIcon key="t" />, <ChartIcon key="m" />];
  return (
    <section aria-labelledby="steps-heading">
      <h3 id="steps-heading" className="text-xl font-semibold">
        Pilot plan in three steps
      </h3>
      <Stagger as="ol" className="relative mt-4 grid gap-3 md:grid-cols-3">
        <span aria-hidden="true" className="absolute left-[16%] right-[16%] top-7 hidden h-0.5 bg-gradient-to-r from-brand/30 via-spark/40 to-brand/30 md:block" />
        {steps.map((s, i) => (
          <StaggerItem as="li" key={s.name} className="relative">
            <div className="card lift h-full p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`flex h-10 w-10 items-center justify-center rounded-full ${i === 1 ? "bg-spark text-[#2b2540]" : "bg-brand text-on-brand"}`}>
                  {icons[i]}
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Step {i + 1}</p>
                  <p className="font-display text-lg font-semibold leading-tight">{s.name}</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium">{s.action}</p>
              <ul className="mt-2 space-y-1">
                {s.meta.map((m) => (
                  <li key={m} className="flex items-center gap-1.5 text-xs text-muted">
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-spark" />
                    {m}
                  </li>
                ))}
              </ul>
              {s.tasks.length > 0 && (
                <>
                  <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? undefined : i)} className="no-print mt-3 text-xs font-semibold text-brand underline-offset-2 hover:underline">
                    {open === i ? "Hide tasks" : `Show ${s.tasks.reduce((n, t) => n + t.tasks.length, 0)} tasks`}
                  </button>
                  {open === i && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                      {s.tasks.map((t) => (
                        <div key={t.when} className="mt-2 rounded-xl bg-paper p-2.5">
                          <p className="text-xs font-bold">{t.when}</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                            {t.tasks.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Goals({ metrics, extra }: { metrics: { metric: string; target: string }[]; extra?: React.ReactNode }) {
  const primary = metrics.slice(0, 3);
  const rest = metrics.slice(3);
  return (
    <Card title="Success metrics" icon={<FlagIcon />} id="metrics-heading" badge={<span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-muted">Proposed goals, not results</span>}>
      <ul className="grid gap-2 sm:grid-cols-3">
        {primary.map((m) => (
          <li key={m.metric} className="rounded-2xl border border-line bg-paper/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Goal · {m.metric}</p>
            <p className="mt-1 text-sm font-semibold">{m.target}</p>
          </li>
        ))}
      </ul>
      {(rest.length > 0 || extra) && (
        <Disclosure title={rest.length > 0 ? `${rest.length} more ${rest.length === 1 ? "metric" : "metrics"}` : "More detail"} className="mt-3">
          {rest.length > 0 && (
            <ul className="divide-y divide-line">
              {rest.map((m) => (
                <li key={m.metric} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="font-semibold">{m.metric}</span>
                  <span className="text-muted sm:text-right">{m.target}</span>
                </li>
              ))}
            </ul>
          )}
          {extra}
        </Disclosure>
      )}
    </Card>
  );
}

function PlanActions({ onDownload, onEdit }: { onDownload: () => void; onEdit?: () => void }) {
  return (
    <div className="no-print flex flex-col gap-3 rounded-[1.25rem] border border-brand/15 bg-brand-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Ready to run it?</p>
        <p className="text-sm text-muted">Take the plan with you. Nothing is booked or sent by the app.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onDownload} className="btn-primary px-5 py-3 text-sm">
          Download my pilot plan <ArrowIcon />
        </button>
        <button type="button" onClick={() => window.print()} className="btn-secondary px-3.5 py-2.5 text-sm">
          Print or save as PDF
        </button>
        {onEdit && (
          <button type="button" onClick={onEdit} className="btn-secondary px-3.5 py-2.5 text-sm">
            Edit assumptions
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pilot results and the performance dashboard
// ---------------------------------------------------------------------------

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

  const unitTitle = `${plan.unitLabel[0]?.toUpperCase()}${plan.unitLabel.slice(1)}`;
  const fields = [
    { key: "units", label: `${unitTitle}s sold`, value: units, set: setUnits, predicted: String(plan.predicted.units) },
    { key: "revenue", label: "Revenue (₹)", value: revenue, set: setRevenue, predicted: inr(plan.predicted.revenueInr) },
    { key: "footfall", label: "Footfall (people who passed your stall)", value: footfall, set: setFootfall, predicted: String(plan.predicted.footfall) },
  ];
  const verdict = saved?.verdict;
  const actuals = saved?.actuals;
  const style = verdict ? DECISION_STYLE[verdict.decision] : undefined;
  const conversion = actuals && actuals.footfall > 0 ? (actuals.unitsSold / actuals.footfall) * 100 : undefined;
  const predictedConversion = plan.predicted.footfall > 0 ? (plan.predicted.units / plan.predicted.footfall) * 100 : undefined;

  return (
    <Card title="Report pilot results" icon={<ChartIcon />} id="results-heading">
      <p className="text-sm text-muted">After your pilot, enter what actually happened to see predicted vs actual and a continue, pivot or stop verdict.</p>
      <form onSubmit={submit} noValidate className="no-print mt-4 grid gap-4 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`${uid}-${f.key}`} className="text-sm font-semibold">
              {f.label}
            </label>
            <input
              id={`${uid}-${f.key}`}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base shadow-sm focus:border-brand"
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
          <button type="submit" className="btn-primary px-5 py-2.5 text-sm">
            {saved ? "Update verdict" : "Get verdict"}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-5">
        {verdict && style && actuals ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className={`rounded-2xl border p-4 ${style.box}`}>
              <p className={`font-display text-2xl font-semibold ${style.text}`}>Verdict: {style.label}</p>
              <p className="mt-1 text-sm">{verdict.reason}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Kpi label="Footfall" value={actuals.footfall.toLocaleString("en-IN")} hint={`Predicted ${plan.predicted.footfall.toLocaleString("en-IN")}`} />
              <Kpi label={`${unitTitle}s sold`} value={actuals.unitsSold.toLocaleString("en-IN")} hint={`Continue at ${plan.rule.continueUnits}`} tone={actuals.unitsSold >= plan.rule.continueUnits ? "good" : "plain"} />
              <Kpi label="Revenue" value={inr(actuals.revenueInr)} hint={`Continue at ${inr(plan.rule.continueRevenueInr)}`} tone={actuals.revenueInr >= plan.rule.continueRevenueInr ? "good" : "plain"} />
              <Kpi
                label="Purchase conversion"
                value={conversion === undefined ? "n/a" : `${conversion.toFixed(1)}%`}
                hint={predictedConversion === undefined ? "Needs footfall" : `Planned ${predictedConversion.toFixed(1)}% of passers-by`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartFrame
                title="From passers-by to purchases"
                caption="Footfall is an estimate you counted at the stall. Only purchases are evidence of demand."
                table={{ headers: ["Stage", "Count"], rows: [["Footfall (estimated)", actuals.footfall], [`${unitTitle}s sold`, actuals.unitsSold]] }}
              >
                <Funnel
                  steps={[
                    { label: "Passed the stall (estimated)", value: actuals.footfall },
                    { label: `${unitTitle}s sold`, value: actuals.unitsSold, hint: "Purchases only. Interest, sign-ups or follows are not counted as sales." },
                  ]}
                />
              </ChartFrame>
              <ChartFrame
                title="Actual as % of plan"
                caption="100% means the result matched the pre-pilot estimate exactly."
                table={{ headers: ["Metric", "Predicted", "Actual", "% of predicted"], rows: verdict.comparison.map((c) => [c.metric, c.predicted.toLocaleString("en-IN"), c.actual.toLocaleString("en-IN"), `${c.pctOfPredicted}%`]) }}
                footer={`Planned spend ${inr(plan.totalCostInr)}. Actual spend is not recorded in this app, so spend versus plan cannot be shown.`}
              >
                <HBarChart
                  data={verdict.comparison.map((c) => ({ label: c.metric, value: c.pctOfPredicted, highlight: c.pctOfPredicted < 50 }))}
                  domain={[0, Math.max(120, ...verdict.comparison.map((c) => c.pctOfPredicted))]}
                  format={(n) => `${n}%`}
                  valueName="Actual as % of predicted"
                  highlightLabel="Below half of plan"
                />
              </ChartFrame>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line bg-card">
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
                    <th scope="col" className="p-2.5 text-right font-semibold">
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
                      <td className="p-2.5 text-right tabular-nums">{c.pctOfPredicted}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">Predictions were estimates made before the pilot. Your actual numbers are the first real evidence.</p>
          </motion.div>
        ) : (
          <EmptyState title="No pilot results yet">Run the pilot, then enter units sold, revenue and footfall above. The dashboard appears here once real numbers exist; nothing is estimated in their place.</EmptyState>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Solo pilot
// ---------------------------------------------------------------------------

export function PilotPlanView({ result, plan, onSaveResults, onEditInputs }: { result: RunResult; plan: PilotPlan; onSaveResults: (results: NonNullable<RunResult["pilotResults"]>) => void; onEditInputs?: () => void }) {
  const base = `culture2commerce-${slugify(plan.conceptLabel)}-${slugify(plan.locality)}`;
  const option = result.options.find((o) => o.id === plan.optionId);
  const audience = splitAudience(plan.targetAudience);
  const reasons = option ? winnerReasons(result, option) : [];
  const groups = groupSchedule(plan.schedule);
  const stockUnits = plan.quantities.reduce((n, q) => n + q.quantity, 0);
  const split = budgetSplit(plan.totalCostInr, option?.runningCostInr ?? plan.totalCostInr, plan.budgetInr);
  const alternatives = result.options.filter((o) => o.id !== plan.optionId && o.verdict !== "rejected").slice(0, 3);
  const risks = option?.confidence.reasons.filter((r) => r.effect !== "up") ?? [];

  const steps: Step[] = [
    {
      name: "Prepare",
      action: `Make ${stockUnits} ${plan.unitLabel}s and book a spot.`,
      meta: [groups.prepare[0]?.when ?? "Before the first weekend", `${plan.checklist.length} checklist items`],
      tasks: groups.prepare,
    },
    {
      name: "Test",
      action: "Sell for real and count who stops by.",
      meta: [`${plan.weekends} ${plan.weekends === 1 ? "weekend" : "weekends"} · ${plan.days} selling days`, ...(plan.venueSuggestion ? [`${plan.venueSuggestion.type}, about ${inr(plan.venueSuggestion.feePerDayInr)}/day`] : [])],
      tasks: groups.test,
    },
    {
      name: "Measure",
      action: "Compare sales and costs with the rule below.",
      meta: [`Continue at ${plan.rule.continueUnits} ${plan.unitLabel}s or ${inr(plan.rule.continueRevenueInr)}`, groups.measure[0]?.when ?? "After the final weekend"],
      tasks: groups.measure,
    },
  ];

  return (
    <div className="space-y-6">
      <RecommendedPilot
        eyebrow="Launch Plan · recommended next step"
        title={plan.title}
        reason={reasons.length > 0 ? `${reasons.join(", ")}.` : undefined}
        fields={
          <>
            <SummaryField icon={<IdeaIcon />} label="Business idea" value={plan.conceptLabel} />
            <SummaryField icon={<PeopleIcon />} label="Target audience" value={audience.who} hint={audience.detail} />
            <SummaryField icon={<PinIcon />} label="Locality" value={`${plan.locality}, ${plan.city}`} />
            <SummaryField icon={<WalletIcon />} label="Pilot budget" value={`${inr(plan.totalCostInr)} of ${inr(plan.budgetInr)}`} hint="Estimate" />
            <SummaryField icon={<ClockIcon />} label="Duration" value={`${plan.weekends} ${plan.weekends === 1 ? "weekend" : "weekends"} (${plan.days} days)`} />
            <SummaryField icon={<FlagIcon />} label="Continue if" value={`${plan.rule.continueUnits} ${plan.unitLabel}s or ${inr(plan.rule.continueRevenueInr)}`} hint="Otherwise pivot or stop" />
          </>
        }
      />

      <PlanActions
        onDownload={() => downloadText(`${base}-pilot-plan.md`, planToMarkdown(plan, result), "text/markdown")}
        {...(onEditInputs ? { onEdit: onEditInputs } : {})}
      />

      <PilotSteps steps={steps} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card title="Budget" icon={<WalletIcon />} id="budget-heading" badge={<EstimateHint text="Estimates · verify before spending" />}>
          <StackedBar
            ariaLabel="Pilot budget"
            total={split.scale}
            format={inr}
            segments={[
              { label: "Setup (reusable equipment)", value: split.equipment, color: "#6b5bd2" },
              { label: "Running costs", value: split.running, color: "#1f8a6a", hint: "Stock, venue, transport, contingency" },
              { label: "Left in budget", value: split.buffer, color: "#8fb39c", pattern: true },
              { label: "Funding gap", value: split.over, color: "#b42318", pattern: true },
            ]}
          />
          <p className={`mt-3 text-sm font-medium ${plan.bufferInr >= 0 ? "text-leaf" : "text-bad"}`}>
            {plan.bufferInr >= 0 ? `${inr(plan.bufferInr)} of your ${inr(plan.budgetInr)} budget stays unspent as a buffer.` : `This is ${inr(-plan.bufferInr)} over your ${inr(plan.budgetInr)} budget.`}
          </p>
          <Disclosure title="Budget breakdown" hint={`${plan.budget.length} estimated line items`} className="mt-3">
            <table className="w-full">
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
          </Disclosure>
        </Card>

        <Goals
          metrics={plan.successMetrics}
          extra={
            <p className="mt-2">
              <span className="font-semibold">Who to aim at:</span> {plan.targetAudience}.
            </p>
          }
        />
      </div>

      <DecisionRule rule={plan.rule} />

      <section aria-labelledby="details-heading" className="space-y-2">
        <h3 id="details-heading" className="text-xl font-semibold">
          Details when you need them
        </h3>
        <Disclosure tone="card" icon={<ListIcon />} title="What to prepare and what to charge" hint={`${plan.quantities.length} items, ${stockUnits} ${plan.unitLabel}s in total`}>
          <table className="w-full">
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
            <p className="mt-3 rounded-xl bg-paper p-3">
              <span className="font-semibold">Suggested venue type:</span> {plan.venueSuggestion.type.toLowerCase()}. {plan.venueSuggestion.description} About {inr(plan.venueSuggestion.feePerDayInr)} per day.{" "}
              <EstimateHint />
            </p>
          )}
        </Disclosure>
        <Disclosure tone="card" icon={<CheckIcon />} title="Setup checklist" hint={`${plan.checklist.length} things to have ready`}>
          <ul className="space-y-2">
            {plan.checklist.map((c) => (
              <li key={c} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 rounded border border-muted/50" />
                {c}
              </li>
            ))}
          </ul>
        </Disclosure>
        <Disclosure tone="card" icon={<ClockIcon />} title="Full schedule" hint={`${plan.schedule.length} stages, day by day`}>
          <ol className="grid gap-3 sm:grid-cols-2">
            {plan.schedule.map((s) => (
              <li key={s.when} className="rounded-xl bg-paper p-3">
                <p className="font-bold">{s.when}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {s.tasks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Disclosure>
        {risks.length > 0 && (
          <Disclosure tone="card" icon={<AlertIcon />} title="Risks and data gaps" hint="What could make this estimate wrong">
            <ul className="space-y-1.5">
              {risks.map((r) => (
                <li key={r.text} className="flex gap-2">
                  <span aria-hidden="true" className={r.effect === "cap" ? "text-bad" : "text-warn"}>
                    {r.effect === "cap" ? "!" : "−"}
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        <Disclosure tone="card" icon={<FlagIcon />} title="Permits and permissions" hint="Estimates; check locally">
          <ul className="list-disc space-y-1 pl-5">
            {plan.permitNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Disclosure>
        {alternatives.length > 0 && (
          <Disclosure tone="card" icon={<IdeaIcon />} title="Alternative ideas" hint="Next-best options if this one stops">
            <ul className="divide-y divide-line">
              {alternatives.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {o.conceptLabel} <span className="text-muted">in {o.locality}</span>
                  </span>
                  <span className="font-display text-lg font-semibold tabular-nums">{score(o.scores.final)}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        {result.narrative && (
          <Disclosure tone="lavender" icon={<SparkIcon />} title="Pilot pitch" hint="A written summary you can share">
            <p className="leading-6">{result.narrative.pilotPitch}</p>
          </Disclosure>
        )}
      </section>

      <PilotResultsForm plan={plan} saved={result.pilotResults} onSave={onSaveResults} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partner pilot
// ---------------------------------------------------------------------------

export function PartnerPlanView({ result, plan, onEditInputs }: { result: RunResult; plan: PartnerPlan; onEditInputs?: () => void }) {
  const base = `culture2commerce-partner-${slugify(plan.shortlist[0]?.name ?? "pilot")}`;
  const first = plan.shortlist[0];
  const groups = groupSchedule(plan.timeline);
  const weekends = result.input.weekends;
  const steps: Step[] = [
    { name: "Prepare", action: "Contact the partner and agree simple terms.", meta: [groups.prepare.map((g) => g.when).join(", ") || "First week", `${plan.shortlist.length} businesses shortlisted`], tasks: groups.prepare },
    { name: "Test", action: `Supply a small batch through ${plan.modelLabel.toLowerCase()}.`, meta: [`${weekends} ${weekends === 1 ? "weekend" : "weekends"}`, `${inr(plan.upfrontInr)} upfront`], tasks: groups.test },
    { name: "Measure", action: "Count sales and ask if they want to continue.", meta: [groups.measure[0]?.when ?? "After the pilot"], tasks: groups.measure },
  ];
  return (
    <div className="space-y-6">
      <RecommendedPilot
        eyebrow="Launch Plan · partner pilot"
        title={plan.title}
        reason={first?.why}
        fields={
          <>
            <SummaryField icon={<IdeaIcon />} label="Product" value={plan.conceptLabel} hint={plan.product !== plan.conceptLabel ? plan.product : undefined} />
            <SummaryField icon={<PeopleIcon />} label="First partner to contact" value={first ? first.name : "None shortlisted"} hint={first ? `${first.partnerType}, ${first.locality}` : undefined} />
            <SummaryField icon={<PinIcon />} label="Format" value={plan.modelLabel} />
            <SummaryField icon={<WalletIcon />} label="Upfront budget" value={`${inr(plan.upfrontInr)} of ${inr(plan.budgetInr)}`} hint="Estimate" />
            <SummaryField icon={<ClockIcon />} label="Duration" value={`${weekends} ${weekends === 1 ? "weekend" : "weekends"}`} />
          </>
        }
      />

      <PlanActions
        onDownload={() => downloadText(`${base}-plan.md`, partnerPlanToMarkdown(plan), "text/markdown")}
        {...(onEditInputs ? { onEdit: onEditInputs } : {})}
      />

      <PilotSteps steps={steps} />

      <Card title="Who to contact, in this order" icon={<PeopleIcon />} id="contact-heading">
        <ol className="space-y-3">
          {plan.shortlist.map((s, i) => (
            <li key={s.partnerId}>
              <Disclosure
                defaultOpen={i === 0}
                title={
                  <>
                    {i + 1}. {s.name} <span className="font-normal text-muted">({s.partnerType}, {s.locality}) · {s.model}</span>
                  </>
                }
                hint={s.why}
              >
                <OutreachPanel initial={s.outreach} />
              </Disclosure>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">These are businesses worth contacting, not confirmed partners. Do not promise anything until terms are agreed in writing.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Budget" icon={<WalletIcon />} id="partner-budget-heading" badge={<EstimateHint text="Estimates · verify before spending" />}>
          <StackedBar
            ariaLabel="Partner pilot budget"
            total={Math.max(plan.budgetInr, plan.upfrontInr)}
            format={inr}
            segments={[
              { label: "Upfront cost", value: plan.upfrontInr, color: "#1f8a6a" },
              { label: "Left in budget", value: Math.max(0, plan.budgetInr - plan.upfrontInr), color: "#8fb39c", pattern: true },
              { label: "Funding gap", value: Math.max(0, plan.upfrontInr - plan.budgetInr), color: "#b42318", pattern: true },
            ]}
          />
          <Disclosure title="Budget breakdown" hint={`${plan.budget.length} estimated line items`} className="mt-3">
            <table className="w-full">
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
          </Disclosure>
        </Card>
        <Goals metrics={plan.successMetrics} />
      </div>

      <DecisionRule rule={plan.rule} />

      <Disclosure tone="card" icon={<AlertIcon />} title="Before you invest more" hint="Validation steps and compliance notes">
        <ul className="list-disc space-y-1 pl-5">
          {[...plan.validationSteps, ...plan.compliance].map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Disclosure>
      <Disclosure tone="card" icon={<ClockIcon />} title="Full timeline" hint={`${plan.timeline.length} stages`}>
        <ol className="grid gap-3 sm:grid-cols-2">
          {plan.timeline.map((s) => (
            <li key={s.when} className="rounded-xl bg-paper p-3">
              <p className="font-bold">{s.when}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {s.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Disclosure>
    </div>
  );
}
