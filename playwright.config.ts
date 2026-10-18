import { defineConfig, devices } from "@playwright/test";

/**
 * One end-to-end smoke test. The app is started with the live API switched off and no key,
 * so the test never spends Qloo quota and exercises the offline fallback path.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  // Each route compiles on first visit under `next dev`, so navigations can take several seconds.
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/meta`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { QLOO_MODE: "recorded", QLOO_API_KEY: "", LLM_PROVIDER: "none", C2C_DISABLE_SNAPSHOT: "true", C2C_DIST_DIR: ".next-e2e", ENABLE_DEV_PAGE: "true" },
  },
});
