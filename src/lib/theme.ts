/**
 * Light/dark theme. One shared source of truth: the `data-theme` attribute on <html>.
 *
 * - First visit: the dark "aurora" theme, the product's signature look.
 * - After the user clicks the toggle: their choice is saved in localStorage and wins.
 * - THEME_SCRIPT runs inline in <head> before the page paints, so there is no flash.
 */

export type Theme = "light" | "dark";

// "-v2": choices saved under the earlier palette are not carried over, so everyone starts on aurora.
export const THEME_STORAGE_KEY = "c2c:theme-v2";

/** Inline script for <head>. Kept tiny and dependency-free; wrapped in try/catch for private mode. */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var t=s==="light"||s==="dark"?s:"dark";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Applies and remembers a theme the user chose. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 250);
  }
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be blocked; the theme still applies for this page view.
  }
}

/** Subscribes to theme changes on <html> (for components that draw with JS colours, like charts). */
export function subscribeTheme(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
