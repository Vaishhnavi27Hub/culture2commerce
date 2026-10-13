import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/contract/**/*.test.ts"],
    // The normal test run must never reach the real Qloo API or an LLM.
    env: { QLOO_API_KEY: "", QLOO_MODE: "recorded", LLM_PROVIDER: "none", LLM_API_KEY: "" },
  },
});
