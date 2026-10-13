import { z } from "zod";
import type { Narrative } from "@/lib/schemas";
import { readServerEnv, type ServerEnv } from "../env";
import { templateNarrative, type NarrativeFacts } from "./templates";

/**
 * Optional LLM layer for narrative polish only.
 *
 * One small OpenAI-compatible chat client, configured by env vars:
 *   LLM_PROVIDER = none | gemini | openai_compatible
 *   LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
 *
 * The LLM receives the already-computed facts and a template draft, and may only rephrase
 * them. Its output is validated with Zod and rejected if it contains any number that is
 * not in the facts, so it cannot change scores, rankings or amounts. On any failure the
 * caller falls back to the deterministic template.
 *
 * Verified on 13 Oct 2026 from Google's Gemini API docs (ai.google.dev):
 *   OpenAI-compatible base URL and a Flash-Lite model with a free tier.
 */
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
/** Tried when the default model is overloaded or slow. Also on the free tier. */
export const GEMINI_FALLBACK_MODELS = ["gemini-3.1-flash-lite"];

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export interface LlmConfig {
  provider: "gemini" | "openai_compatible";
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Other models to try, in order, if `model` is unavailable, overloaded or too slow. */
  fallbackModels?: string[];
}

/** Returns the LLM settings, or undefined when the LLM is switched off or not fully configured. */
export function resolveLlmConfig(env: ServerEnv = readServerEnv()): LlmConfig | undefined {
  if (env.llmProvider === "none" || !env.llmApiKey) return undefined;
  if (env.llmProvider === "gemini") {
    return {
      provider: "gemini",
      apiKey: env.llmApiKey,
      baseUrl: env.llmBaseUrl || GEMINI_BASE_URL,
      model: env.llmModel || GEMINI_DEFAULT_MODEL,
      // Only when the default is in use: a model the user chose is respected as is.
      ...(env.llmModel ? {} : { fallbackModels: GEMINI_FALLBACK_MODELS }),
    };
  }
  if (!env.llmBaseUrl || !env.llmModel) return undefined;
  return { provider: "openai_compatible", apiKey: env.llmApiKey, baseUrl: env.llmBaseUrl, model: env.llmModel };
}

const llmNarrativeSchema = z.object({
  headline: z.string().trim().min(8).max(120),
  whyThis: z.string().trim().min(40).max(900),
  pilotPitch: z.string().trim().min(20).max(600),
});

const chatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

/** Every number in a text, without thousands separators: "₹11,500" gives "11500". */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.0+$/, ""));
}

/** True when `candidate` introduces no number that is absent from `reference`. */
export function introducesNoNewNumbers(candidate: string, reference: string): boolean {
  const allowed = new Set(numbersIn(reference));
  return numbersIn(candidate).every((n) => allowed.has(n));
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LlmError("The LLM did not return JSON");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new LlmError("The LLM returned malformed JSON");
  }
}

export interface NarratorOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const cache = new Map<string, Narrative>();
export function clearNarrativeCache(): void {
  cache.clear();
}

const SYSTEM_PROMPT =
  "You polish short product copy for a small-business planning tool. " +
  "Rewrite the DRAFT so it is clear, warm and concrete for a first-time entrepreneur. " +
  "Rules: use only information in FACTS and DRAFT; keep every number exactly as written; " +
  "do not add numbers, names, promises or advice; do not change which option is recommended; " +
  "plain text, no markdown. Reply with only a JSON object with the keys headline, whyThis and pilotPitch.";

/**
 * Builds the narrative writer used by the orchestrator. One LLM call per run, cached.
 * Throws LlmError on failure; the orchestrator then keeps the template text.
 */
export function createNarrator(config: LlmConfig, options: NarratorOptions = {}) {
  const {
    fetchImpl = fetch,
    timeoutMs = 10_000,
    maxRetries = 2,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options;

  return async function narrate(facts: NarrativeFacts): Promise<Narrative> {
    const draft = templateNarrative(facts);
    const reference = JSON.stringify(facts) + JSON.stringify(draft);
    const cacheKey = `${config.model}|${reference}`;
    const hit = cache.get(cacheKey);
    if (hit) return hit;

    const url = new URL("chat/completions", config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `FACTS:
${JSON.stringify(facts)}

DRAFT:
${JSON.stringify({ headline: draft.headline, whyThis: draft.whyThis, pilotPitch: draft.pilotPitch })}` },
    ];

    // Try each model in turn. A rate limit (429) is retried with backoff on the same model;
    // an overloaded, missing or slow model is skipped straight away so a run never stalls.
    let content: string | undefined;
    let lastError = new LlmError("The LLM could not be reached");
    models: for (const model of [config.model, ...(config.fallbackModels ?? [])]) {
      const body = JSON.stringify({ model, temperature: 0.4, messages });
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetchImpl(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
            body,
            signal: controller.signal,
          });
          if (res.ok) {
            const parsed = chatResponseSchema.safeParse(await res.json().catch(() => undefined));
            if (!parsed.success) throw new LlmError("The LLM returned an unexpected response");
            content = parsed.data.choices[0]?.message.content ?? "";
            break models;
          }
          if (res.status === 401 || res.status === 403) throw new LlmError(`The LLM rejected the API key (HTTP ${res.status})`);
          if (res.status === 429) {
            lastError = new LlmError("The LLM rate limit was reached (HTTP 429)");
            continue; // back off, then retry this model
          }
          lastError = new LlmError(`The LLM responded with HTTP ${res.status}`);
          continue models;
        } catch (err) {
          if (err instanceof LlmError) throw err;
          // Deliberately generic so no request detail (including the key) can leak.
          lastError = new LlmError(err instanceof Error && err.name === "AbortError" ? "The LLM timed out" : "The LLM could not be reached");
          continue models;
        } finally {
          clearTimeout(timer);
        }
      }
    }
    if (content === undefined) throw lastError;

    const parsed = llmNarrativeSchema.safeParse(extractJson(content));
    if (!parsed.success) throw new LlmError("The LLM reply did not match the expected format");
    const text = `${parsed.data.headline} ${parsed.data.whyThis} ${parsed.data.pilotPitch}`;
    if (!introducesNoNewNumbers(text, reference)) throw new LlmError("The LLM changed or added numbers, so its text was discarded");
    if (!text.includes(facts.locality)) throw new LlmError("The LLM dropped the recommended locality, so its text was discarded");

    const narrative: Narrative = { ...parsed.data, source: "llm" };
    cache.set(cacheKey, narrative);
    return narrative;
  };
}

/** The narrator configured by env vars, or undefined when the LLM is off. */
export function getNarrator(env: ServerEnv = readServerEnv(), options: NarratorOptions = {}) {
  const config = resolveLlmConfig(env);
  return config ? createNarrator(config, options) : undefined;
}
