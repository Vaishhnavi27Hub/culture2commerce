import type { RunInput } from "@/lib/schemas";
import type { Concept } from "../data/concepts";
import type { QlooClient } from "../qloo/types";

/** Everything an agent may use. Agents never read env vars or create clients themselves. */
export interface AgentContext {
  qloo: QlooClient;
  input: RunInput;
  /** The catalogue entries for input.conceptIds, in order. */
  concepts: Concept[];
  /** Reports a short progress line to the live workflow view. */
  note: (text: string) => void;
}

export type Agent<I, O> = (input: I, ctx: AgentContext) => Promise<O>;

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const uniq = <T>(items: T[]): T[] => [...new Set(items)];

/**
 * True when a word in `text` starts with any of the lower-case keyword fragments
 * ("art" matches "Art gallery" and "arts" but not "party"), unless an exclude fragment
 * also appears ("martial" stops "Martial arts school" matching "art").
 */
export function matchesAny(text: string, keywords: string[], exclude: string[] = []): boolean {
  const t = text.toLowerCase();
  if (exclude.some((x) => t.includes(x))) return false;
  return keywords.some((k) => {
    let from = 0;
    for (;;) {
      const at = t.indexOf(k, from);
      if (at < 0) return false;
      if (at === 0 || !/[a-z]/.test(t[at - 1] ?? "")) return true;
      from = at + 1;
    }
  });
}

/** "a" or "an" for a following word. */
export const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
