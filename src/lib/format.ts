import type { DataSource } from "./schemas";

export const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

export const score = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const SOURCE_LABEL: Record<DataSource, string> = {
  live: "Live Qloo data",
  recorded: "Recorded Qloo snapshot",
  sample: "Sample data",
  estimate: "Illustrative estimate",
  llm: "Written by LLM",
  template: "Template text",
  user: "Your input",
};

export const SOURCE_HELP: Record<DataSource, string> = {
  live: "Fetched from the Qloo API during this run.",
  recorded: "Offline fallback: real Qloo data saved earlier on this machine, not fetched now.",
  sample: "Offline fallback: hand-written illustrative data bundled with the app. Not Qloo data.",
  estimate: "A planning estimate from our curated dataset. Verify locally.",
  llm: "Wording polished by a language model. Numbers and decisions are unchanged.",
  template: "Written from fixed templates, with no language model.",
  user: "Taken from what you entered.",
};

/** The honest, run-level label for where Qloo data came from. */
export const RUN_SOURCE_LABEL: Record<"live" | "recorded" | "sample", string> = {
  live: "Live Qloo data",
  recorded: "Recorded Qloo snapshot (offline fallback)",
  sample: "Sample data, not Qloo (offline fallback)",
};
