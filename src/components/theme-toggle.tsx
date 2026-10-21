"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, subscribeTheme, type Theme } from "@/lib/theme";

/** Current theme, kept in sync with <html data-theme>. Renders "light" on the server. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "dark");
}

function SunIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** The one light/dark switch, shown in the site header on every page. */
export function ThemeToggle() {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={label}
      title={label}
      suppressHydrationWarning
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink shadow-sm transition-[transform,border-color,background-color] duration-150 hover:border-brand hover:text-brand active:scale-95"
    >
      {/* Both icons render; CSS picks one from data-theme, so the right icon shows from the first paint. */}
      <span className="theme-icon-light">
        <SunIcon />
      </span>
      <span className="theme-icon-dark">
        <MoonIcon />
      </span>
    </button>
  );
}
