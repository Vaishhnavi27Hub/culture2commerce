"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { RunSourceBadge } from "./badges";
import { BrandLogo } from "./brand-logo";
import { useRun } from "./run-provider";
import { ThemeToggle } from "./theme-toggle";

/** The journey's steps, each a real page, so the browser back button works naturally. */
export const STEPS = [
  { href: "/discover", label: "Your idea", short: "Idea" },
  { href: "/agents", label: "Your Agents at Work", short: "Agents" },
  { href: "/recommendation", label: "Recommendation", short: "Result" },
  { href: "/plan", label: "Launch Plan", short: "Plan" },
] as const;

function Stepper() {
  const pathname = usePathname();
  const { running, result, error, traces } = useRun();
  const started = running || Boolean(result) || Boolean(error) || traces.some((t) => t.status !== "queued");
  const available: Record<string, boolean> = {
    "/discover": true,
    "/agents": started,
    "/recommendation": Boolean(result && result.options.length > 0),
    "/plan": Boolean(result?.pilotPlan || result?.partnerPlan),
  };
  const currentIndex = STEPS.findIndex((s) => pathname.startsWith(s.href));
  return (
    <nav aria-label="Steps" className="no-print">
      <ol className="flex items-center gap-0.5 sm:gap-1">
        {STEPS.map((s, i) => {
          const current = i === currentIndex;
          const done = currentIndex > i && available[s.href];
          const enabled = available[s.href];
          const inner = (
            <>
              <span
                aria-hidden="true"
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${current ? "bg-on-brand/20" : done ? "bg-leaf text-on-brand" : "bg-line"}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="relative hidden whitespace-nowrap xl:inline">{s.label}</span>
              <span className={`relative whitespace-nowrap xl:hidden ${current ? "" : "sr-only sm:not-sr-only"}`}>{s.short}</span>
              {s.href === "/agents" && running && <span aria-hidden="true" className="animate-status relative h-2 w-2 rounded-full bg-current" />}
            </>
          );
          const cls = `relative flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors duration-300 sm:px-3 sm:text-sm ${
            current ? "bg-brand text-on-brand shadow-sm" : enabled ? "text-ink hover:bg-brand-soft/70" : "cursor-not-allowed text-muted/60"
          }`;
          return (
            <li key={s.href}>
              {enabled ? (
                <Link href={s.href} aria-current={current ? "step" : undefined} className={cls}>
                  {inner}
                </Link>
              ) : (
                <span aria-disabled="true" className={cls} title="Available after the previous step">
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { result, config } = useRun();
  const inJourney = STEPS.some((s) => pathname.startsWith(s.href));
  const source = result?.qlooSource ?? config.qlooStatus;
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/60 bg-paper/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label={`${APP_NAME} home`}>
          <BrandLogo className="hidden sm:inline-flex" />
          <BrandLogo showWordmark={false} className="inline-flex sm:hidden" />
          <span className="sr-only">{APP_NAME}</span>
        </Link>

        {inJourney ? (
          <Stepper />
        ) : (
          <nav aria-label="Main" className="flex items-center gap-1 text-sm font-semibold">
            <Link href="/#how-it-works" className="rounded-full px-3 py-1.5 text-muted hover:bg-brand-soft/70 hover:text-ink">
              How it works
            </Link>
            <Link href="/#about" className="hidden rounded-full px-3 py-1.5 text-muted hover:bg-brand-soft/70 hover:text-ink sm:inline-block">
              About
            </Link>
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {!inJourney && (
            <Link href="/discover" className="hidden rounded-full border border-ink/25 px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand md:inline-flex">
              Get started
            </Link>
          )}
          <span className="hidden lg:inline-flex">
            <RunSourceBadge source={source} />
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
