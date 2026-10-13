import { defineConfig } from "vitest/config";
import path from "node:path";

// Used only by `npm run test:live`. Makes a handful of real Qloo calls; run sparingly.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/live/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
