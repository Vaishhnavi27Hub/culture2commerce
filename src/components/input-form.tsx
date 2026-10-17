"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { CATEGORY_LABEL, CATEGORY_ORDER, type ConceptCategory } from "@/lib/categories";
import { BROWNIE_EXAMPLE, NISHA_EXAMPLE } from "@/lib/nisha";
import { runInputSchema, type LaunchMode, type RiskPreference, type RunInput } from "@/lib/schemas";
import { ArrowIcon, FilterChips, SearchIcon } from "./ui";

export interface ConceptOption {
  id: string;
  label: string;
  tagline: string;
  category: ConceptCategory;
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
  mode: LaunchMode;
  product: string;
  admired: string;
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
  mode: "solo",
  product: "",
  admired: "",
};

const MODE_OPTIONS: { value: LaunchMode; label: string; help: string }[] = [
  { value: "solo", label: "On my own", help: "Run my own stall, pop-up or workshop" },
  { value: "partner", label: "With an existing business", help: "Sell through or alongside a café, shop or venue" },
  { value: "both", label: "Show me both", help: "Compare the two approaches side by side" },
];

function toForm(example: RunInput): FormState {
  return {
    city: example.city,
    suggest: example.localities.length === 0,
    localities: example.localities,
    customLocality: "",
    budget: String(example.budgetInr),
    weekends: example.weekends,
    interests: example.interests.join(", "),
    conceptIds: example.conceptIds,
    risk: example.riskPreference,
    mode: example.launchMode,
    product: example.productDescription ?? "",
    admired: example.admiredBusiness ?? "",
  };
}

const RISK_OPTIONS: { value: RiskPreference; label: string; help: string }[] = [
  { value: "low", label: "Low risk", help: "Protect my money; weight safety more" },
  { value: "medium", label: "Balanced", help: "Balance fit and safety" },
  { value: "high", label: "Bold", help: "Weight cultural fit more" },
];

const MAX_LOCALITIES = 3;
const MAX_CONCEPTS = 5;

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base text-ink shadow-sm placeholder:text-muted/70 focus:border-brand";

const choiceClass = (on: boolean) =>
  `flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3.5 transition-all ${on ? "border-brand bg-brand-soft/70 shadow-sm" : "border-line bg-card hover:-translate-y-px hover:border-brand/50 hover:shadow-sm"}`;

function Legend({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <legend className="flex items-center gap-2.5 font-display text-xl font-semibold">
      {n !== undefined && (
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-brand font-sans text-xs font-bold text-white">
          {n}
        </span>
      )}
      {children}
    </legend>
  );
}

export function InputForm({ concepts, knownLocalities, busy, serverIssues, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ConceptCategory>("all");
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
    launchMode: f.mode,
    ...(f.product.trim() ? { productDescription: f.product.trim() } : {}),
    ...(f.admired.trim() && f.mode !== "solo" ? { admiredBusiness: f.admired.trim() } : {}),
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

  const tryExample = (example: RunInput) => {
    setForm(toForm(example));
    setErrors({});
    onSubmit(example);
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
      <div id="examples" className="scroll-mt-24">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">Explore opportunities</p>
        <p className="mt-1 font-display text-xl font-semibold">Start from a worked example</p>
        <p className="mt-1 text-sm text-muted">Each runs the full four-agent analysis, so you can see what a result looks like before entering your own idea.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { example: NISHA_EXAMPLE, title: "Start on your own: Nisha", text: "A student in Bengaluru with ₹15,000 and two weekends, choosing between a thrift stall, art prints and a coffee pop-up.", button: "Try Nisha’s example" },
          { example: BROWNIE_EXAMPLE, title: "Start with a partner: brownies", text: "Homemade eggless brownies, ₹10,000, no stall. Find cafés, bakeries and venues to sell through, and compare with going solo.", button: "Try the partner example" },
        ].map((ex) => (
          <div key={ex.button} className="lift flex flex-col justify-between gap-4 rounded-[1.25rem] border border-brand/15 bg-gradient-to-br from-card to-brand-soft/60 p-5 shadow-[var(--shadow-card)]">
            <div>
              <p className="font-semibold text-ink">{ex.title}</p>
              <p className="mt-0.5 text-sm text-muted">{ex.text}</p>
            </div>
            <button suppressHydrationWarning
              type="button"
              onClick={() => tryExample(ex.example)}
              disabled={busy}
              className="btn-primary w-full px-4 py-2.5 text-sm sm:w-auto sm:self-start"
            >
              {ex.button} <ArrowIcon />
            </button>
          </div>
        ))}
      </div>
      </div>

      <fieldset className="space-y-3">
        <Legend>How do you want to start your business?</Legend>
        <div role="radiogroup" aria-label="Launch mode" className="grid gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={choiceClass(form.mode === opt.value)}
            >
              <input suppressHydrationWarning
                type="radio"
                name={id("mode")}
                className="mt-1 accent-[var(--color-brand)]"
                checked={form.mode === opt.value}
                onChange={() => set("mode", opt.value)}
              />
              <span>
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-muted">{opt.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <Legend n={1}>Where</Legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={id("city")} className="text-sm font-semibold">
              City
            </label>
            <input suppressHydrationWarning
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
                <button suppressHydrationWarning
                  key={opt.label}
                  type="button"
                  aria-pressed={form.suggest === opt.value}
                  onClick={() => set("suggest", opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${form.suggest === opt.value ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
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
                      <button suppressHydrationWarning
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
                  <input suppressHydrationWarning
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
                  <button suppressHydrationWarning
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
        <Legend n={2}>Your limits</Legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={id("budget")} className="text-sm font-semibold">
              Budget (₹)
            </label>
            <input suppressHydrationWarning
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
            <select suppressHydrationWarning id={id("weekends")} className={inputClass} value={form.weekends} onChange={(e) => set("weekends", Number(e.target.value))}>
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
                className={choiceClass(form.risk === opt.value)}
              >
                <input suppressHydrationWarning
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
        <Legend n={3}>What you might sell</Legend>
        <div role="group" aria-labelledby={id("concepts-label")} aria-describedby={describedBy("conceptIds")}>
          <p id={id("concepts-label")} className="text-sm font-semibold">
            Business ideas to compare <span className="font-normal text-muted">(pick 1 to {MAX_CONCEPTS})</span>
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor={id("concept-search")} className="sr-only">
              Search business ideas
            </label>
            <span className="relative block sm:w-64">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <SearchIcon />
              </span>
              <input
                id={id("concept-search")}
                type="search"
                className={`${inputClass} mt-0 pl-9`}
                placeholder="Search ideas, e.g. coffee"
                value={query}
                maxLength={40}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
            <FilterChips
              label="Filter ideas by category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all" as const, label: "All" },
                ...CATEGORY_ORDER.filter((c) => concepts.some((x) => x.category === c)).map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
              ]}
            />
          </div>
          {(() => {
            const q = query.trim().toLowerCase();
            const shown = concepts.filter(
              (c) => (category === "all" || c.category === category) && (!q || `${c.label} ${c.tagline} ${CATEGORY_LABEL[c.category]}`.toLowerCase().includes(q)),
            );
            const hidden = form.conceptIds.filter((cid) => !shown.some((c) => c.id === cid));
            return (
              <>
                {shown.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">No ideas match “{query}”. Try another word or category.</p>}
                <motion.div layout className="mt-3 grid gap-2 sm:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {shown.map((c) => {
                      const on = form.conceptIds.includes(c.id);
                      return (
                        <motion.label
                          layout
                          key={c.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.18 }}
                          className={`${choiceClass(on)} ${!on && form.conceptIds.length >= MAX_CONCEPTS ? "opacity-50" : ""}`}
                        >
                          <input suppressHydrationWarning
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                            checked={on}
                            disabled={!on && form.conceptIds.length >= MAX_CONCEPTS}
                            onChange={() => toggleConcept(c.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center justify-between gap-x-2">
                              <span className="text-sm font-semibold">{c.label}</span>
                              <span className="text-[11px] font-medium text-muted">{CATEGORY_LABEL[c.category]}</span>
                            </span>
                            <span className="block text-xs text-muted">{c.tagline}</span>
                          </span>
                        </motion.label>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
                {hidden.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Also selected (hidden by the filter): {hidden.map((cid) => concepts.find((c) => c.id === cid)?.label ?? cid).join(", ")}.
                  </p>
                )}
              </>
            );
          })()}
          {errorText("conceptIds")}
        </div>

        <div>
          <label htmlFor={id("interests")} className="text-sm font-semibold">
            Your skills or interests <span className="font-normal text-muted">(optional)</span>
          </label>
          <input suppressHydrationWarning
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

        <div>
          <label htmlFor={id("product")} className="text-sm font-semibold">
            Describe your product <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea suppressHydrationWarning
            id={id("product")}
            className={`${inputClass} min-h-20`}
            placeholder="I make eggless brownies, vegan cupcakes and homemade plum cakes."
            value={form.product}
            maxLength={300}
            onChange={(e) => set("product", e.target.value)}
            aria-describedby={id("product-help")}
          />
          <p id={id("product-help")} className="mt-1.5 text-xs text-muted">
            Matched to Qloo tags to find businesses that sell similar things or whose customers might want yours.
          </p>
        </div>

        {form.mode !== "solo" && (
          <div>
            <label htmlFor={id("admired")} className="text-sm font-semibold">
              A business you admire <span className="font-normal text-muted">(optional)</span>
            </label>
            <input suppressHydrationWarning
              id={id("admired")}
              className={inputClass}
              placeholder="e.g. a bakery or café whose crowd and atmosphere you like"
              value={form.admired}
              maxLength={80}
              onChange={(e) => set("admired", e.target.value)}
              aria-describedby={id("admired-help")}
            />
            <p id={id("admired-help")} className="mt-1.5 text-xs text-muted">
              Use the name as it appears on maps; add the area if the name is common. Qloo uses it to find places with a similar crowd. It does not tell us they share actual customers.
            </p>
          </div>
        )}
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

      <button suppressHydrationWarning
        type="submit"
        disabled={busy}
        className="btn-primary w-full px-7 py-3.5 text-base sm:w-auto"
      >
        {busy ? "Agents are working…" : "Find my best bet"}
        {!busy && <ArrowIcon />}
      </button>
    </form>
  );
}
