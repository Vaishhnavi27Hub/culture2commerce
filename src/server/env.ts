/**
 * Server-side environment access. Import this only from server code (route handlers,
 * src/server, scripts). Values are never sent to the browser.
 */

export type QlooMode = "live" | "recorded";
export type LlmProvider = "none" | "gemini" | "openai_compatible";

export interface ServerEnv {
  qlooApiUrl: string;
  qlooApiKey: string;
  qlooMode: QlooMode;
  llmProvider: LlmProvider;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  enableDevPage: boolean;
}

export function readServerEnv(env: Record<string, string | undefined> = process.env): ServerEnv {
  const provider = (env.LLM_PROVIDER ?? "none").trim().toLowerCase();
  return {
    qlooApiUrl: (env.QLOO_API_URL ?? "").trim() || "https://hackathon.api.qloo.com",
    qlooApiKey: (env.QLOO_API_KEY ?? "").trim(),
    qlooMode: (env.QLOO_MODE ?? "").trim().toLowerCase() === "recorded" ? "recorded" : "live",
    llmProvider: provider === "gemini" || provider === "openai_compatible" ? provider : "none",
    llmApiKey: (env.LLM_API_KEY ?? "").trim(),
    llmBaseUrl: (env.LLM_BASE_URL ?? "").trim(),
    llmModel: (env.LLM_MODEL ?? "").trim(),
    enableDevPage: env.NODE_ENV !== "production" || (env.ENABLE_DEV_PAGE ?? "").trim().toLowerCase() === "true",
  };
}
