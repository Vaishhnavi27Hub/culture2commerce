import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Smoke test: Nisha's example from the first click to a pilot verdict, on bundled sample
 * data (no key, no network). Set C2C_SCREENSHOTS=1 to also save README screenshots.
 */
const shotsDir = path.join(process.cwd(), "docs", "screenshots");
const shoot = async (page: import("@playwright/test").Page, name: string, fullPage = false) => {
  if (!process.env.C2C_SCREENSHOTS) return;
  fs.mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: path.join(shotsDir, name), fullPage });
};

test("Nisha's example runs end to end on the offline fallback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("worth testing");
  await expect(page.getByText("Sample data, not Qloo (offline fallback)")).toBeVisible();
  await shoot(page, "1-input.png");

  // Screen 2: live agent workflow.
  await page.getByRole("button", { name: "Try Nisha’s example" }).click();
  await expect(page.getByRole("heading", { name: "Agent workflow" })).toBeVisible();
  for (const agent of ["Local Researcher", "Cultural Opportunity Finder", "Feasibility Critic", "Pilot Planner"]) {
    await expect(page.getByRole("button", { name: new RegExp(agent) })).toBeVisible();
  }
  await expect(page.getByText("4 of 4 agents finished")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/0 live, 0 recorded and 30 sample Qloo calls/)).toBeVisible();

  await page.getByRole("button", { name: /Local Researcher/ }).click();
  await expect(page.getByText("Qloo calls (12)")).toBeVisible();
  await expect(page.getByText(/Fallback reason|Popular places in the area/).first()).toBeVisible();
  await shoot(page, "2-agents.png", true);

  // Screen 3: recommendation.
  await page.getByRole("button", { name: /See the recommendation/ }).click();
  await expect(page.getByText("Your best bet")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Test an? .+ in (Indiranagar|Koramangala|Jayanagar)/ })).toBeVisible();
  await expect(page.getByText("Low confidence").first()).toBeVisible();
  await expect(page.getByText("High confidence")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Without Qloo vs With Qloo" })).toBeVisible();
  await expect(page.getByText("How the final score is computed")).toBeVisible();
  await expect(page.getByText(/final = 0\.4 × /)).toBeVisible();
  await expect(page.getByText("Evidence trail")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How the answer changes by locality" })).toBeVisible();

  // The over-budget coffee pop-up is listed as rejected, with its reason.
  await page.getByRole("button", { name: /Show all 9 options/ }).click();
  const coffee = page.getByRole("button", { name: /Coffee pop-up in/ }).first();
  await expect(coffee).toContainText("Rejected");
  await expect(coffee).toContainText("₹15,000 budget");
  await shoot(page, "3-recommendation.png", true);

  // Screen 4: pilot plan and results.
  await page.getByRole("button", { name: /See the pilot plan/ }).click();
  await expect(page.getByRole("heading", { name: /2-weekend pilot/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision rule" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download Markdown" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download run trace (JSON)" })).toBeVisible();
  await expect(page.getByText("Estimates for planning only, not financial or legal advice.")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  expect((await download).suggestedFilename()).toMatch(/pilot-plan\.md$/);

  await page.getByLabel(/sold$/).fill("3");
  await page.getByLabel("Revenue (₹)").fill("700");
  await page.getByLabel(/^Footfall/).fill("900");
  await page.getByRole("button", { name: "Get verdict" }).click();
  await expect(page.getByText("Verdict: Stop")).toBeVisible();
  await expect(page.getByRole("table", { name: "Predicted versus actual pilot results" })).toBeVisible();
  await shoot(page, "4-pilot-plan.png", true);

  // The developer page exists but is not linked from the app.
  await expect(page.locator('a[href="/dev"]')).toHaveCount(0);
  await page.goto("/dev");
  await expect(page.getByRole("heading", { name: "Developer status" })).toBeVisible();

  expect(errors).toEqual([]);
});
