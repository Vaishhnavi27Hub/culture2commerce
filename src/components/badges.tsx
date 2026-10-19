import { RUN_SOURCE_LABEL, SOURCE_HELP, SOURCE_LABEL } from "@/lib/format";
import type { AgentStatus, ConfidenceLevel, DataSource } from "@/lib/schemas";

const SOURCE_STYLE: Record<DataSource, string> = {
  live: "bg-leaf-soft text-leaf border-leaf/30",
  recorded: "bg-warn-soft text-warn border-warn/30",
  sample: "bg-bad-soft text-bad border-bad/30",
  estimate: "bg-spark-soft text-spark-dark border-spark-dark/25",
  llm: "bg-brand-soft text-brand-dark border-brand/30",
  template: "bg-paper text-muted border-line",
  user: "bg-paper text-muted border-line",
};

const SOURCE_SHORT: Record<DataSource, string> = {
  live: "Live Qloo",
  recorded: "Recorded Qloo",
  sample: "Sample",
  estimate: "Estimate",
  llm: "LLM",
  template: "Template",
  user: "Your input",
};

/** Small label showing where a value came from. */
export function SourceBadge({ source, long = false }: { source: DataSource; long?: boolean }) {
  return (
    <span
      title={SOURCE_HELP[source]}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 ${SOURCE_STYLE[source]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {long ? SOURCE_LABEL[source] : SOURCE_SHORT[source]}
      <span className="sr-only">. {SOURCE_HELP[source]}</span>
    </span>
  );
}

/** The honest run-level badge: live, recorded snapshot or sample fallback. */
export function RunSourceBadge({ source }: { source: "live" | "recorded" | "sample" }) {
  return (
    <span
      title={SOURCE_HELP[source]}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${SOURCE_STYLE[source]}`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
      {RUN_SOURCE_LABEL[source]}
    </span>
  );
}

const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  High: "bg-leaf-soft text-leaf border-leaf/30",
  Medium: "bg-warn-soft text-warn border-warn/30",
  Low: "bg-bad-soft text-bad border-bad/30",
};

export function ConfidenceBadge({ level, size = "sm" }: { level: ConfidenceLevel; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${CONFIDENCE_STYLE[level]} ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden="true" className="flex items-end gap-0.5">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-1 rounded-sm bg-current ${bar === 1 ? "h-1.5" : bar === 2 ? "h-2.5" : "h-3.5"} ${
              (level === "Low" && bar > 1) || (level === "Medium" && bar > 2) ? "opacity-25" : ""
            }`}
          />
        ))}
      </span>
      {level} confidence
    </span>
  );
}

const VERDICT_STYLE = {
  accepted: "bg-leaf-soft text-leaf border-leaf/30",
  downgraded: "bg-warn-soft text-warn border-warn/30",
  rejected: "bg-bad-soft text-bad border-bad/30",
} as const;

export function VerdictBadge({ verdict }: { verdict: keyof typeof VERDICT_STYLE }) {
  const label = verdict === "accepted" ? "Fits" : verdict === "downgraded" ? "Downgraded" : "Rejected";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${VERDICT_STYLE[verdict]}`}>{label}</span>;
}

const STATUS_STYLE: Record<AgentStatus, string> = {
  queued: "bg-paper text-muted border-line",
  running: "bg-brand-soft text-brand-dark border-brand/30",
  completed: "bg-leaf-soft text-leaf border-leaf/30",
  failed: "bg-bad-soft text-bad border-bad/30",
  skipped: "bg-paper text-muted border-line",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  queued: "Waiting",
  running: "In progress",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full bg-current ${status === "running" ? "animate-status" : ""}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Understated estimate disclosure: a small muted caption with an info icon and a tooltip,
 * used instead of a loud badge where figures are planning estimates (not Qloo findings).
 */
export function EstimateHint({ text = "Estimate", detail = "Planning estimate from our curated cost data, not a Qloo finding. Verify locally before spending.", className = "text-muted" }: { text?: string; detail?: string; className?: string }) {
  return (
    <span title={detail} className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 7.2v3.6M8 5.1v.1" strokeLinecap="round" />
      </svg>
      {text}
      <span className="sr-only">. {detail}</span>
    </span>
  );
}
