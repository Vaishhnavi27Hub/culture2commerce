"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { HIGHLIGHT, SERIES, type HBarDatum } from "./charts";
import { EmptyState } from "./ui";

/** The Recharts-based charts, split out so charts.tsx can load them on demand. */

const AXIS = "#56645f";
const GRID = "#efe6da";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** True once the user starts printing, so charts that were never scrolled into view still render. */
function usePrinting() {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => setPrinting(true);
    window.addEventListener("beforeprint", on);
    return () => window.removeEventListener("beforeprint", on);
  }, []);
  return printing;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="max-w-64 rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-ink">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 text-muted">
            <span className="flex items-center gap-1.5">
              {r.color && <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-semibold tabular-nums text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar chart (one series)
// ---------------------------------------------------------------------------

export function HBarChart({ data, domain, format, valueName, highlightLabel }: { data: HBarDatum[]; domain?: [number, number]; format: (n: number) => string; valueName: string; highlightLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const printing = usePrinting();
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" }) || printing;
  const reduce = useReducedMotion();
  const rowH = 34;
  const height = data.length * rowH + 16;
  const yWidth = Math.min(170, Math.max(96, Math.round(width * 0.34)));
  const maxChars = Math.floor(yWidth / 7);

  if (data.length === 0) return <EmptyState title="No data to chart" />;
  return (
    <div ref={ref} style={{ height }} className="w-full">
      {inView && width > 0 && (
        <BarChart width={width} height={height} data={data} layout="vertical" margin={{ top: 4, right: 52, bottom: 4, left: 0 }} barCategoryGap={8} accessibilityLayer>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" hide domain={domain ?? [0, "auto"]} />
          <YAxis type="category" dataKey="label" width={yWidth} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(v: string) => truncate(v, maxChars)} />
          <Tooltip
            cursor={{ fill: "rgba(18,61,50,0.05)" }}
            content={({ active, payload }) => {
              const d = active && payload?.[0] ? (payload[0].payload as HBarDatum) : undefined;
              if (!d) return null;
              return <TooltipBox title={d.label} rows={[{ label: valueName, value: format(d.value) }, ...(d.highlight && highlightLabel ? [{ label: highlightLabel, value: "Yes" }] : []), ...(d.note ? [{ label: d.note, value: "" }] : [])]} />;
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={!reduce && !printing} animationDuration={700}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.highlight ? HIGHLIGHT : SERIES[0]} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v) => format(Number(v))} style={{ fill: "#1d2925", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped horizontal bars (up to three comparable 0–100 metrics)
// ---------------------------------------------------------------------------

export function GroupedHBarChart<K extends string>({
  rows,
  series,
  format = (n) => String(Math.round(n)),
  domain = [0, 100],
  marker,
}: {
  rows: ({ label: string } & Record<K, number | undefined>)[];
  series: { key: K; label: string }[];
  format?: (n: number) => string;
  domain?: [number, number];
  /** Optional reference line, e.g. a neutral score of 50. */
  marker?: { value: number; label: string };
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const printing = usePrinting();
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" }) || printing;
  const reduce = useReducedMotion();
  const groupH = series.length * 16 + 26;
  const height = rows.length * groupH + 30;
  const yWidth = Math.min(150, Math.max(90, Math.round(width * 0.26)));

  if (rows.length === 0) return <EmptyState title="Nothing to compare yet" />;
  return (
    <div ref={ref} style={{ height }} className="w-full">
      {inView && width > 0 && (
        <BarChart width={width} height={height} data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }} barGap={2} barCategoryGap={14} accessibilityLayer>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" domain={domain} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={yWidth} tickLine={false} axisLine={false} tick={{ fill: "#1d2925", fontSize: 12, fontWeight: 600 }} tickFormatter={(v: string) => truncate(v, Math.floor(yWidth / 7))} />
          {marker && <ReferenceLine x={marker.value} stroke="#b7a998" strokeDasharray="3 3" label={{ value: marker.label, position: "top", fill: AXIS, fontSize: 10 }} />}
          <Tooltip
            cursor={{ fill: "rgba(18,61,50,0.05)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={String(label)}
                  rows={payload.map((p, i) => ({ label: String(p.name), value: p.value === undefined ? "n/a" : format(Number(p.value)), color: SERIES[i] }))}
                />
              ) : null
            }
          />
          <Legend content={() => null} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={[0, 4, 4, 0]} maxBarSize={13} isAnimationActive={!reduce && !printing} animationDuration={700} animationBegin={i * 120}>
              <LabelList dataKey={s.key} position="right" formatter={(v) => (v === undefined || v === null ? "" : format(Number(v)))} style={{ fill: "#1d2925", fontSize: 11, fontWeight: 600 }} />
            </Bar>
          ))}
        </BarChart>
      )}
    </div>
  );
}

