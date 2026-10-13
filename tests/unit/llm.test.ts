import { beforeEach, describe, expect, it } from "vitest";
import { NISHA_EXAMPLE } from "@/lib/nisha";
import { readServerEnv } from "@/server/env";
import {
  clearNarrativeCache,
  createNarrator,
  GEMINI_BASE_URL,
  GEMINI_DEFAULT_MODEL,
  getNarrator,
  introducesNoNewNumbers,
  numbersIn,
  resolveLlmConfig,
  type LlmConfig,
} from "@/server/llm/client";
import { templateNarrative, type NarrativeFacts } from "@/server/llm/templates";
import { runPipeline } from "@/server/orchestrator";
import { sampleOnlyQloo } from "../helpers/ctx";

const LLM_KEY = "llm-test-key-NOT-REAL";
const config: LlmConfig = { provider: "gemini", apiKey: LLM_KEY, baseUrl: GEMINI_BASE_URL, model: GEMINI_DEFAULT_MODEL };

const facts: NarrativeFacts = {
  city: "Bengaluru",
  conceptLabel: "Art print pop-up",
  locality: "Jayanagar",
  targetAudience: "People aged 35 to 44 who go to Jayanagar places like Sapna Book House",
  finalScore: 73.8,
  culturalFit: 66.7,
  feasibility: 84.4,
  riskAdjustment: 70.5,
  confidenceLevel: "High",
  meanAffinity: 0.93,
  topSignals: ["Dyu Art Cafe (0.90)"],
  rejected: [{ conceptLabel: "Coffee pop-up", reason: "Needs about ₹30,461, which is 203% of the ₹15,000 budget." }],
  totalCostInr: 10843,
  budgetInr: 15000,
  weekends: 2,
  continueRule: "At least 36 prints sold or at least ₹9,000 revenue across 2 weekends: continue.",
};

const good = {
  headline: "Try an art print pop-up in Jayanagar",
  whyThis: "Jayanagar regulars already love places like Dyu Art Cafe, and this idea scores 73.8 out of 100 with High confidence.",
  pilotPitch: "Spend about ₹10,843 of your ₹15,000 over 2 weekends, and continue if you sell 36 prints.",
};

function mockLlm(respond: (callIndex: number) => Response) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) }, body: String(init?.body) });
    return respond(calls.length - 1);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const chat = (content: string) => Response.json({ choices: [{ message: { role: "assistant", content } }] });
const noSleep = async () => {};

describe("LLM configuration", () => {
  it("is off by default and when no key is set", () => {
    expect(resolveLlmConfig(readServerEnv({}))).toBeUndefined();
    expect(resolveLlmConfig(readServerEnv({ LLM_PROVIDER: "gemini" }))).toBeUndefined();
    expect(getNarrator(readServerEnv({ LLM_PROVIDER: "none", LLM_API_KEY: "x" }))).toBeUndefined();
  });

  it("needs only a key for Gemini, using the documented endpoint and a free-tier model", () => {
    expect(resolveLlmConfig(readServerEnv({ LLM_PROVIDER: "gemini", LLM_API_KEY: "k" }))).toEqual({
      provider: "gemini",
      apiKey: "k",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      model: "gemini-3.5-flash-lite",
    });
  });

  it("needs a base URL and model for other OpenAI-compatible providers", () => {
    expect(resolveLlmConfig(readServerEnv({ LLM_PROVIDER: "openai_compatible", LLM_API_KEY: "k" }))).toBeUndefined();
    expect(
      resolveLlmConfig(readServerEnv({ LLM_PROVIDER: "openai_compatible", LLM_API_KEY: "k", LLM_BASE_URL: "http://localhost:11434/v1", LLM_MODEL: "m" }))?.model,
    ).toBe("m");
  });
});

describe("number guard", () => {
  it("normalises thousands separators", () => {
    expect(numbersIn("₹11,500 for 36 prints at 73.8")).toEqual(["11500", "36", "73.8"]);
  });

  it("accepts rephrasing and rejects new or changed numbers", () => {
    expect(introducesNoNewNumbers("Sell 36 prints for ₹9,000", "36 prints or 9000 revenue")).toBe(true);
    expect(introducesNoNewNumbers("Sell 40 prints", "36 prints")).toBe(false);
  });
});

describe("narrator", () => {
  beforeEach(() => clearNarrativeCache());

  it("returns LLM text labelled llm, sending the key only as a bearer header", async () => {
    const { fetchImpl, calls } = mockLlm(() => chat("```json\n" + JSON.stringify(good) + "\n```"));
    const narrative = await createNarrator(config, { fetchImpl })(facts);
    expect(narrative).toEqual({ ...good, source: "llm" });
    expect(calls[0]?.url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${LLM_KEY}`);
    expect(calls[0]?.url).not.toContain(LLM_KEY);
    expect(calls[0]?.body).not.toContain(LLM_KEY);
    expect(JSON.parse(calls[0]!.body).model).toBe(GEMINI_DEFAULT_MODEL);
  });

  it("makes one call per run and caches the result", async () => {
    const { fetchImpl, calls } = mockLlm(() => chat(JSON.stringify(good)));
    const narrate = createNarrator(config, { fetchImpl });
    await narrate(facts);
    await narrate(facts);
    expect(calls).toHaveLength(1);
  });

  it("backs off and retries on HTTP 429", async () => {
    const sleeps: number[] = [];
    const { fetchImpl, calls } = mockLlm((i) => (i === 0 ? new Response("{}", { status: 429 }) : chat(JSON.stringify(good))));
    const narrative = await createNarrator(config, { fetchImpl, sleep: async (ms) => void sleeps.push(ms) })(facts);
    expect(narrative.source).toBe("llm");
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([1000]);
  });

  it("gives up after repeated 429s with a safe message", async () => {
    const { fetchImpl, calls } = mockLlm(() => new Response(`quota for ${LLM_KEY}`, { status: 429 }));
    const err = await createNarrator(config, { fetchImpl, sleep: noSleep })(facts).catch((e: Error) => e);
    expect((err as Error).message).toBe("The LLM rate limit was reached (HTTP 429)");
    expect(calls).toHaveLength(3);
  });

  it.each([
    ["non-JSON text", "Sure! Here is your copy."],
    ["missing fields", JSON.stringify({ headline: good.headline })],
    ["a changed number", JSON.stringify({ ...good, pilotPitch: "Spend about ₹9,999 of your ₹15,000 over 2 weekends and see." })],
    ["a different locality", JSON.stringify({ ...good, headline: "Try an art print pop-up in Indiranagar", whyThis: good.whyThis.replace("Jayanagar", "Indiranagar") })],
  ])("rejects %s", async (_name, content) => {
    const { fetchImpl } = mockLlm(() => chat(content));
    await expect(createNarrator(config, { fetchImpl, sleep: noSleep })(facts)).rejects.toThrow(/LLM/);
  });

  it("never leaks the key when the network fails", async () => {
    const { fetchImpl } = mockLlm(() => {
      throw new Error(`socket closed, Authorization: Bearer ${LLM_KEY}`);
    });
    const err = (await createNarrator(config, { fetchImpl, sleep: noSleep, maxRetries: 0 })(facts).catch((e: Error) => e)) as Error;
    expect(err.message).toBe("The LLM could not be reached");
  });
});

describe("pipeline with the LLM", () => {
  beforeEach(() => clearNarrativeCache());

  it("looks complete with the LLM disabled (template narrative)", async () => {
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo() });
    expect(result.narrative?.source).toBe("template");
    expect(result.narrative?.headline.length).toBeGreaterThan(10);
    expect(result.narrative?.whyThis).toMatch(/out of 100/);
    expect(result.narrative?.pilotPitch).toMatch(/continue/);
  });

  it("falls back to the template when the LLM returns invalid output, without changing any score", async () => {
    const baseline = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo() });
    const { fetchImpl } = mockLlm(() => chat("not json at all"));
    const result = await runPipeline(NISHA_EXAMPLE, { qloo: sampleOnlyQloo(), narrate: createNarrator(config, { fetchImpl, sleep: noSleep }) });
    expect(result.status).toBe("completed");
    expect(result.narrative?.source).toBe("template");
    expect(result.narrative?.note).toBeTruthy();
    expect(result.options.map((o) => [o.id, o.scores.final])).toEqual(baseline.options.map((o) => [o.id, o.scores.final]));
    expect(result.agents[3]?.dataSources).not.toContain("llm");
  });

  it("the template narrative itself introduces no numbers beyond the facts", () => {
    const draft = templateNarrative(facts);
    expect(introducesNoNewNumbers(`${draft.headline} ${draft.whyThis} ${draft.pilotPitch}`, JSON.stringify(facts) + "100")).toBe(true);
  });
});
