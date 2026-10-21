"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { GroupedHBarChart as GroupedHBarChartType, HBarChart as HBarChartType } from "./charts-recharts";

/**
 * The chart system: one look for every chart (thin bars, recessive axes, values printed at the bar end,
 * a hover tooltip, a table view). Charts mount when scrolled into view so their entrance animation is seen.
 * Series colours are validated for colour-vision deficiency; see --color-series-* in globals.css.
 */

export const SERIES = ["#1f8a6a", "#6b5bd2", "#e89a2c"] as const;
export const HIGHLIGHT = "#ff735c";
export const NEUTRAL_BAR = "#c9d6cc";

export interface HBarDatum {
  label: string;
  value: number;
  /** Drawn in coral, e.g. the recommended option or an analysed area. */
  highlight?: boolean;
  /** Extra line in the tooltip. */
  note?: string;
}

// Recharts is loaded only when a chart is first needed, so the landing page stays light.
const ChartSkeleton = () => <div aria-hidden="true" className="skeleton h-40 w-full" />;
export const HBarChart = dynamic(() => import("./charts-recharts").then((m) => m.HBarChart), { ssr: false, loading: ChartSkeleton }) as typeof HBarChartType;
export const GroupedHBarChart = dynamic(() => import("./charts-recharts").then((m) => m.GroupedHBarChart), { ssr: false, loading: ChartSkeleton }) as typeof GroupedHBarChartType;

// ---------------------------------------------------------------------------
// Frame: title, caption, chart/table toggle
// ---------------------------------------------------------------------------

export function ChartFrame({
  title,
  caption,
  children,
  table,
  footer,
  legend,
}: {
  title: string;
  caption?: React.ReactNode;
  children: React.ReactNode;
  table: { headers: string[]; rows: (string | number)[][] };
  footer?: React.ReactNode;
  legend?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <figcaption className="font-semibold">{title}</figcaption>
          {caption && <p className="mt-0.5 text-xs text-muted">{caption}</p>}
        </div>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="no-print shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand underline-offset-2 hover:underline" aria-pressed={asTable}>
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {legend && !asTable && <div className="mt-3">{legend}</div>}
      <div className="mt-3">
        {asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  {table.headers.map((h, i) => (
                    <th key={h} scope="col" className={`py-2 pr-3 font-semibold ${i > 0 ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {r.map((c, j) =>
                      j === 0 ? (
                        <th key={j} scope="row" className="py-2 pr-3 text-left font-medium">
                          {c}
                        </th>
                      ) : (
                        <td key={j} className="py-2 pr-3 text-right tabular-nums">
                          {c}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
      {footer && <div className="mt-3 text-xs text-muted">{footer}</div>}
    </figure>
  );
}

export function LegendRow({ items }: { items: { label: string; color: string; pattern?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: i.pattern ? `repeating-linear-gradient(45deg, ${i.color} 0 2px, transparent 2px 5px)` : i.color, border: i.pattern ? `1px solid ${i.color}` : undefined }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Stacked budget bar (plain HTML: crisp at any width, animated on view)
// ---------------------------------------------------------------------------

export interface Segment {
  label: string;
  value: number;
  color: string;
  /** Hatched fill for "not spent" or "over budget" so it does not rely on colour alone. */
  pattern?: boolean;
  hint?: string;
}

export function StackedBar({ segments, total, format, ariaLabel }: { segments: Segment[]; total: number; format: (n: number) => string; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div ref={ref} className="flex h-5 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label={`${ariaLabel}: ${shown.map((s) => `${s.label} ${format(s.value)}`).join(", ")}`}>
        {shown.map((s, i) => (
          <motion.div
            key={s.label}
            title={`${s.label}: ${format(s.value)}`}
            className="h-full origin-left first:rounded-l-md last:rounded-r-md"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.pattern ? `repeating-linear-gradient(45deg, ${s.color} 0 3px, transparent 3px 7px)` : s.color,
              boxShadow: s.pattern ? `inset 0 0 0 1.5px ${s.color}` : undefined,
            }}
            initial={{ scaleX: reduce ? 1 : 0 }}
            animate={inView ? { scaleX: 1 } : undefined}
            transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.label} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden="true"
              className="mt-1 h-3 w-3 shrink-0 rounded-sm"
              style={{ background: s.pattern ? `repeating-linear-gradient(45deg, ${s.color} 0 2px, transparent 2px 5px)` : s.color, boxShadow: s.pattern ? `inset 0 0 0 1px ${s.color}` : undefined }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span>{s.label}</span>
                <span className="font-semibold tabular-nums">{format(s.value)}</span>
              </span>
              {s.hint && <span className="block text-xs text-muted">{s.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel (counts at successive stages)
// ---------------------------------------------------------------------------

export function Funnel({ steps }: { steps: { label: string; value: number; hint?: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol ref={ref} className="space-y-2.5">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = steps[i - 1];
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{s.value.toLocaleString("en-IN")}</span>
                {prev && prev.value > 0 && <span className="ml-1.5 text-xs text-muted">{((s.value / prev.value) * 100).toFixed(1)}% of previous step</span>}
              </span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-md bg-line/60">
              <motion.div
                className="h-full origin-left rounded-md"
                style={{ width: `${Math.max(pct, 1)}%`, background: SERIES[0] }}
                initial={{ scaleX: reduce ? 1 : 0 }}
                animate={inView ? { scaleX: 1 } : undefined}
                transition={{ duration: 0.7, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            {s.hint && <p className="mt-0.5 text-xs text-muted">{s.hint}</p>}
          </li>
        );
      })}
    </ol>
  );
}
