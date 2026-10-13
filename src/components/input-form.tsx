"use client";

import { useId, useState } from "react";
import { NISHA_EXAMPLE } from "@/lib/nisha";
import { runInputSchema, type RiskPreference, type RunInput } from "@/lib/schemas";

export interface ConceptOption {
  id: string;
  label: string;
  tagline: string;
}

interface Props {
  concepts: ConceptOption[];
  knownLocalities: Record<string, string[]>;
  busy: boolean;
  serverIssues: { field: string; message: string }[];
  onSubmit: (input: RunInput) => void;
}

interface FormState {
  city: string;
  suggest: boolean;
  localities: string[];
  customLocality: string;
  budget: string;
  weekends: number;
  interests: string;
  conceptIds: string[];
  risk: RiskPreference;
}

const EMPTY: FormState = {
  city: "Bengaluru",
  suggest: true,
  localities: [],
  customLocality: "",
  budget: "15000",
  weekends: 2,
  interests: "",
  conceptIds: [],
  risk: "low",
};

const RISK_OPTIONS: { value: RiskPreference; label: string; help: string }[] = [
  { value: "low", label: "Low risk", help: "Protect my money; weight safety more" },
  { value: "medium", label: "Balanced", help: "Balance fit and safety" },
  { value: "high", label: "Bold", help: "Weight cultural fit more" },
];

const MAX_LOCALITIES = 3;
const MAX_CONCEPTS = 5;

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-brand";

export function InputForm({ concepts, knownLocalities, busy, serverIssues, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const cityKey = form.city.trim().toLowerCase();
  const suggestions = knownLocalities[cityKey === "bangalore" ? "bengaluru" : cityKey] ?? [];
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toInput = (f: FormState) => ({
    city: f.city.trim(),
    localities: f.suggest ? [] : f.localities,
    budgetInr: Number(f.budget),
    weekends: f.weekends,
    interests: f.interests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8),
    conceptIds: f.conceptIds,
    riskPreference: f.risk,
  });

  const validate = (f: FormState): RunInput | undefined => {
    const next: Record<string, string> = {};
    if (!f.city.trim()) next.city = "Enter a city.";
    if (!f.suggest && f.localities.length === 0) next.localities = "Pick at least one locality, or choose “Suggest for me”.";
    const budget = Number(f.budget);
    if (!f.budget.trim() || !Number.isFinite(budget) || !Number.isInteger(budget)) next.budget = "Enter your budget as a whole number of rupees.";
    else if (budget < 1000) next.budget = "The budget must be at least ₹1,000.";
    else if (budget > 1_000_000) next.budget = "The budget must be ₹10,00,000 or less.";
    if (f.conceptIds.length === 0) next.conceptIds = "Pick at least one business idea.";
    setErrors(next);
    if (Object.keys(next).length > 0) return undefined;
    const parsed = runInputSchema.safeParse(toInput(f));
    if (!parsed.success) {
      setErrors({ form: parsed.error.issues[0]?.message ?? "Please check your inputs." });
      return undefined;
    }
    return parsed.data;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = validate(form);
    if (input) onSubmit(input);
  };

  const tryNisha = () => {
    const filled: FormState = {
      city: NISHA_EXAMPLE.city,
      suggest: false,
      localities: NISHA_EXAMPLE.localities,
      customLocality: "",
      budget: String(NISHA_EXAMPLE.budgetInr),
      weekends: NISHA_EXAMPLE.weekends,
      interests: NISHA_EXAMPLE.interests.join(", "),
      conceptIds: NISHA_EXAMPLE.conceptIds,
      risk: NISHA_EXAMPLE.riskPreference,
    };
    setForm(filled);
    setErrors({});
    onSubmit(NISHA_EXAMPLE);
  };

  const toggleLocality = (name: string) => {
    const has = form.localities.includes(name);
    if (!has && form.localities.length >= MAX_LOCALITIES) return;
    set("localities", has ? form.localities.filter((l) => l !== name) : [...form.localities, name]);
  };

  const addCustomLocality = () => {
    const name = form.customLocality.trim();
    if (!name || form.localities.length >= MAX_LOCALITIES) return;
    if (!form.localities.some((l) => l.toLowerCase() === name.toLowerCase())) set("localities", [...form.localities, name]);
    setForm((f) => ({ ...f, customLocality: "" }));
  };

  const toggleConcept = (conceptId: string) => {
    const has = form.conceptIds.includes(conceptId);
    if (!has && form.conceptIds.length >= MAX_CONCEPTS) return;
    set("conceptIds", has ? form.conceptIds.filter((c) => c !== conceptId) : [...form.conceptIds, conceptId]);
  };

  const errorText = (name: string) =>
    errors[name] ? (
      <p id={id(`${name}-error`)} role="alert" className="mt-1.5 text-sm font-medium text-bad">
        {errors[name]}
      </p>
    ) : null;
  const describedBy = (name: string, help?: boolean) =>
    [errors[name] ? id(`${name}-error`) : "", help ? id(`${name}-help`) : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={submit} noValidate className="space-y-8" aria-busy={busy}>
      <div className="rounded-2xl border border-brand/25 bg-brand-soft p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="font-semibold text-ink">New here? Start with Nisha.</p>
          <p className="mt-0.5 text-sm text-muted">
            A student in Bengaluru with ₹15,000 and two weekends, choosing between a thrift stall, art prints and a coffee pop-up.
          </p>
        </div>
        <button
          type="button"
          onClick={tryNisha}
          disabled={busy}
          className="mt-3 inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-50 sm:mt-0 sm:w-auto"
        >
          Try Nisha’s example
        </button>
      </div>

      <fieldset className="space-y-5">
        <legend className="text-lg font-bold">1. Where</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={id("city")} className="text-sm font-semibold">
              City
            </label>
            <input
              id={id("city")}
              className={inputClass}
              value={form.city}
              maxLength={60}
              autoComplete="address-level2"
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value, localities: [] }))}
              aria-invalid={Boolean(errors.city)}
              aria-describedby={describedBy("city", true)}
            />
            <p id={id("city-help")} className="mt-1.5 text-xs text-muted">
              Bengaluru has locality-level estimates. Other cities work with generic estimates and lower confidence.
            </p>
            {errorText("city")}
          </div>

          <div role="group" aria-labelledby={id("locality-label")} aria-describedby={describedBy("localities")}>
            <p id={id("locality-label")} className="text-sm font-semibold">
              Locality
            </p>
            <div className="mt-1 inline-flex rounded-xl border border-line bg-card p-1">
              {[
                { value: true, label: "Suggest for me" },
                { value: false, label: "I’ll choose" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={form.suggest === opt.value}
                  onClick={() => set("suggest", opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${form.suggest === opt.value ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.suggest ? (
              <p className="mt-2 text-xs text-muted">The Local Researcher will compare up to three areas for you.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">
                  Pick up to {MAX_LOCALITIES} to compare ({form.localities.length} chosen).
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...suggestions, ...form.localities])].map((name) => {
                    const on = form.localities.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && form.localities.length >= MAX_LOCALITIES}
                        onClick={() => toggleLocality(name)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                          on ? "border-brand bg-brand text-white" : "border-line bg-card text-ink hover:border-brand"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <label htmlFor={id("custom-locality")} className="sr-only">
                    Add another locality
                  </label>
                  <input
                    id={id("custom-locality")}
                    className={`${inputClass} mt-0`}
                    placeholder="Add another locality"
                    value={form.customLocality}
                    maxLength={60}
                    onChange={(e) => set("customLocality", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomLocality();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addCustomLocality}
                    disabled={!form.customLocality.trim() || form.localities.length >= MAX_LOCALITIES}
                    className="shrink-0 rounded-xl border border-line bg-card px-3 text-sm font-semibold hover:border-brand disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            {errorText("localities")}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-bold">2. Your limits</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={id("budget")} className="text-sm font-semibold">
              Budget (₹)
            </label>
            <input
              id={id("budget")}
              className={inputClass}
              inputMode="numeric"
              value={form.budget}
              onChange={(e) => set("budget", e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
              aria-invalid={Boolean(errors.budget)}
              aria-describedby={describedBy("budget", true)}
            />
            <p id={id("budget-help")} className="mt-1.5 text-xs text-muted">
              Everything you can spend on the pilot, including stall fees and stock.
            </p>
            {errorText("budget")}
          </div>
          <div>
            <label htmlFor={id("weekends")} className="text-sm font-semibold">
              Duration
            </label>
            <select id={id("weekends")} className={inputClass} value={form.weekends} onChange={(e) => set("weekends", Number(e.target.value))}>
              {[1, 2, 3, 4, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "weekend" : "weekends"} (Saturday and Sunday)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div role="radiogroup" aria-labelledby={id("risk-label")}>
          <p id={id("risk-label")} className="text-sm font-semibold">
            Risk preference
          </p>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {RISK_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${
                  form.risk === opt.value ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-brand/50"
                }`}
              >
                <input
                  type="radio"
                  name={id("risk")}
                  className="mt-1 accent-[var(--color-brand)]"
                  checked={form.risk === opt.value}
                  onChange={() => set("risk", opt.value)}
                />
                <span>
                  <span className="block text-sm font-semibold">{opt.label}</span>
                  <span className="block text-xs text-muted">{opt.help}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-bold">3. What you might sell</legend>
        <div role="group" aria-labelledby={id("concepts-label")} aria-describedby={describedBy("conceptIds")}>
          <p id={id("concepts-label")} className="text-sm font-semibold">
            Business ideas to compare <span className="font-normal text-muted">(pick 1 to {MAX_CONCEPTS})</span>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {concepts.map((c) => {
              const on = form.conceptIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${
                    on ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-brand/50"
                  } ${!on && form.conceptIds.length >= MAX_CONCEPTS ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                    checked={on}
                    disabled={!on && form.conceptIds.length >= MAX_CONCEPTS}
                    onChange={() => toggleConcept(c.id)}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{c.label}</span>
                    <span className="block text-xs text-muted">{c.tagline}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {errorText("conceptIds")}
        </div>

        <div>
          <label htmlFor={id("interests")} className="text-sm font-semibold">
            Your skills or interests <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={id("interests")}
            className={inputClass}
            placeholder="illustration, baking, hosting events"
            value={form.interests}
            maxLength={200}
            onChange={(e) => set("interests", e.target.value)}
            aria-describedby={id("interests-help")}
          />
          <p id={id("interests-help")} className="mt-1.5 text-xs text-muted">
            Separate with commas. Ideas that match your skills count as lower risk. Please don’t enter personal details.
          </p>
        </div>
      </fieldset>

      {(errors.form || serverIssues.length > 0) && (
        <div role="alert" className="rounded-xl border border-bad/30 bg-bad-soft p-3 text-sm text-bad">
          {errors.form && <p>{errors.form}</p>}
          {serverIssues.map((issue) => (
            <p key={`${issue.field}-${issue.message}`}>
              {issue.field}: {issue.message}
            </p>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Agents are working…" : "Find my best bet"}
      </button>
    </form>
  );
}
