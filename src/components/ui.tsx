"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";

/**
 * Shared presentation pieces: scroll reveals, disclosures, segmented controls, KPI tiles and icons.
 * Motion is short and subtle; MotionConfig in app.tsx turns it off for prefers-reduced-motion.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

// ---------------------------------------------------------------------------
// Reveal: fade and rise once when scrolled into view
// ---------------------------------------------------------------------------

export function Reveal({ children, delay = 0, className, y = 14 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Children reveal one after another. Wrap each child in StaggerItem. */
export function Stagger({ children, className, as = "div", gap = 0.07 }: { children: React.ReactNode; className?: string; as?: "div" | "ul" | "ol"; gap?: number }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Disclosure: collapsed details with a smooth height transition
// ---------------------------------------------------------------------------

/** Opens every disclosure while printing, so a printed plan is complete. */
function usePrintOpen(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, [setOpen]);
}

export function Disclosure({
  title,
  hint,
  children,
  defaultOpen = false,
  icon,
  tone = "plain",
  className = "",
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  tone?: "plain" | "lavender" | "card";
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  usePrintOpen(setOpen);
  const id = useId();
  const reduce = useReducedMotion();
  const surface = tone === "lavender" ? "border-lavender-ink/15 bg-lavender/60" : tone === "card" ? "card" : "border-line bg-paper/60";
  return (
    <div className={`rounded-2xl border ${surface} ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-ink/[0.03]"
      >
        {icon && (
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card text-brand shadow-sm">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
        <motion.span aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-muted">
          <ChevronIcon />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 text-sm">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control with an animated selection pill
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  role = "group",
  size = "md",
}: {
  options: readonly (readonly [T, React.ReactNode])[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  role?: "group" | "tablist";
  size?: "sm" | "md";
}) {
  const layoutId = useId();
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-xl border border-line bg-card p-1 shadow-sm" role={role} aria-label={label}>
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            {...(role === "tablist" ? { role: "tab", "aria-selected": on } : { "aria-pressed": on })}
            onClick={() => onChange(v)}
            className={`relative rounded-lg font-semibold transition-colors ${size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${on ? "text-on-brand" : "text-muted hover:text-ink"}`}
          >
            {on && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-lg bg-brand" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A row of filter chips, each a toggle button. */
export function FilterChips<T extends string>({ options, value, onChange, label }: { options: readonly { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  const layoutId = useId();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`relative rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${on ? "border-brand text-on-brand" : "border-line bg-card text-ink hover:border-brand/60"}`}
          >
            {on && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">
              {o.label}
              {o.count !== undefined && <span className={on ? "text-on-brand/75" : "text-muted"}> ({o.count})</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Headings, KPI tiles and empty states
// ---------------------------------------------------------------------------

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  actions,
  level = 2,
}: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  level?: 2 | 3;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-spark-dark">{eyebrow}</p>}
        <H id={id} className={`${level === 2 ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-semibold leading-tight`}>
          {title}
        </H>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Kpi({ label, value, hint, tone = "plain", icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "plain" | "good" | "warn" | "bad" | "dark"; icon?: React.ReactNode }) {
  const styles = {
    plain: "card",
    good: "rounded-[1.25rem] border border-leaf/25 bg-leaf-soft",
    warn: "rounded-[1.25rem] border border-warn/25 bg-warn-soft",
    bad: "rounded-[1.25rem] border border-bad/25 bg-bad-soft",
    dark: "rounded-[1.25rem] bg-white/10 text-white",
  }[tone];
  return (
    <div className={`${styles} p-3.5`}>
      <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${tone === "dark" ? "text-white/70" : "text-muted"}`}>
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold leading-snug tabular-nums">{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${tone === "dark" ? "text-white/70" : "text-muted"}`}>{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-paper/60 px-4 py-8 text-center">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted shadow-sm">
        {icon ?? <ChartIcon />}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {children && <div className="max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons (decorative; always paired with text)
// ---------------------------------------------------------------------------

function Svg({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const ChevronIcon = () => (
  <Svg>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const ArrowIcon = () => (
  <Svg>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IdeaIcon = () => (
  <Svg>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z" />
  </Svg>
);
export const PeopleIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6" />
  </Svg>
);
export const PinIcon = () => (
  <Svg>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);
export const WalletIcon = () => (
  <Svg>
    <rect x="3" y="6" width="18" height="14" rx="3" />
    <path d="M3 10h18M16 15h2" />
  </Svg>
);
export const ClockIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const SparkIcon = () => (
  <Svg>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const ChartIcon = () => (
  <Svg>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const FlagIcon = () => (
  <Svg>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Svg>
);
export const AlertIcon = () => (
  <Svg>
    <path d="M12 4 2.5 20h19L12 4ZM12 10v4M12 17h.01" />
  </Svg>
);
export const ListIcon = () => (
  <Svg>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Svg>
);
