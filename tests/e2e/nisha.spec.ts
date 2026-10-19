import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke tests over the multi-page journey (landing → discover → agents → recommendation →
 * pitch & pilot) on bundled sample data (no key, no network). Set C2C_SCREENSHOTS=1 to also
 * save README screenshots.
 */
const shotsDir = path.join(process.cwd(), "docs", "screenshots");
// Screenshots are written once all tests finish, not during them: writing into the project while
// `next dev` watches it can trigger a Fast Refresh rebuild mid-test and stall a page reload.
const pendingShots: { name: string; png: Buffer }[] = [];
const shoot = async (page: Page, name: string, fullPage = false) => {
  if (!process.env.C2C_SCREENSHOTS) return;
  pendingShots.push({ name, png: await page.screenshot({ fullPage }) });
};
test.afterAll(() => {
  if (pendingShots.length === 0) return;
  fs.mkdirSync(shotsDir, { recursive: true });
  for (const shot of pendingShots.splice(0)) fs.writeFileSync(path.join(shotsDir, shot.name), shot.png);
});

/** Open a collapsed "Supporting analysis" section by its title. */
const openSection = (page: Page, title: string | RegExp) => page.getByRole("button", { name: title }).first().click();

test("Nisha's example runs end to end on the offline fallback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Landing page: hero only, no form.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Turn cultural signals into your next big opportunity.");
  await expect(page.getByRole("button", { name: "Try Nisha’s example" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Four agents, one clear next step" })).toBeVisible();
  await expect(page.getByText("Discover promising local business ideas, uncover what makes them relevant, and turn them into small, actionable pilots.")).toBeVisible();
  await expect(page.locator(".walker")).toHaveCount(8);
  await expect(page.locator("header .logo-swap").first()).toBeAttached();
  if (process.env.C2C_SCREENSHOTS) await page.waitForTimeout(1500); // let the hero entrance animation finish
  await shoot(page, "0-landing.png");

  // Discover Opportunity navigates to the dedicated input page.
  await page.getByRole("link", { name: /Discover Opportunity/ }).first().click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading", { name: "Tell us what, where and how much" })).toBeVisible();
  await shoot(page, "1-input.png");

  // Agents page: user-facing cards, technical details on demand.
  await page.getByRole("button", { name: "Try Nisha’s example" }).click();
  await expect(page).toHaveURL(/\/agents$/);
  await expect(page.getByRole("heading", { name: /Discovering your opportunity|Your agents have finished/ })).toBeVisible();
  for (const agent of ["Local Researcher", "Cultural Opportunity Finder", "Feasibility Critic", "Pilot Planner"]) {
    await expect(page.getByRole("heading", { name: agent })).toBeVisible();
  }
  await expect(page.getByText("4 of 4 agents completed")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/0 live, 0 recorded and 30 sample Qloo calls/)).toBeVisible();
  await expect(page.getByText("Qloo calls: 12")).toBeVisible();
  await expect(page.locator("main code")).toHaveCount(0);
  await expect(page.getByText(/QLOO_API_KEY/)).toHaveCount(0);
  await page.getByRole("button", { name: /What this agent did/ }).first().click();
  await expect(page.getByText("What it asked Qloo")).toBeVisible();
  await expect(page.locator("main code")).toHaveCount(0);
  await shoot(page, "2-agents.png", true);

  // Recommendation: summary first, analysis in collapsible sections.
  await page.getByRole("button", { name: /See the recommendation/ }).click();
  await expect(page).toHaveURL(/\/recommendation$/);
  await expect(page.getByText("Your Top Recommendation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Art print pop-up", level: 2 })).toBeVisible();
  await expect(page.getByRole("img", { name: /Illustration of an art print pop-up stall/ })).toBeVisible();
  await expect(page.getByText("Estimated pilot budget")).toBeVisible();
  await expect(page.getByText("Pilot duration")).toBeVisible();
  await expect(page.getByText(/Suggested test price:/)).toBeVisible();
  await expect(page.getByText(/Not a success probability/)).toHaveCount(0);
  await page.getByRole("button", { name: /See why we recommend this/ }).click();
  await expect(page.getByText(/Not a success probability/)).toBeVisible();
  await expect(page.getByText("Worth checking:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore the details" })).toBeVisible();

  await openSection(page, /Why this recommendation\?/);
  await expect(page.getByText("Low confidence").first()).toBeVisible();
  await expect(page.getByText("High confidence")).toHaveCount(0);
  await expect(page.getByText("Evidence trail").first()).toBeVisible();

  await openSection(page, /How Qloo influenced this decision/);
  await expect(page.getByRole("heading", { name: "Without Qloo vs With Qloo" })).toBeVisible();

  await openSection(page, /Explore neighbourhoods/);
  await expect(page.getByRole("heading", { name: "How the answer changes by locality" })).toBeVisible();
  await expect(page.locator(".c2c-map .c2c-pin")).toHaveCount(3);
  await page.getByRole("button", { name: /^Jayanagar, best idea/ }).click();
  await expect(page.locator(".c2c-pin.is-selected")).toContainText("Jayanagar");

  // The over-budget coffee pop-up is listed as rejected, with its reason.
  await openSection(page, /Explore other opportunities/);
  await page.getByRole("button", { name: /Show all 9 options/ }).click();
  const coffee = page.getByRole("button", { name: /Coffee pop-up in/ }).first();
  await expect(coffee).toContainText("Rejected");
  await expect(coffee).toContainText("₹15,000 budget");
  await shoot(page, "3-recommendation.png", true);

  // Launch Plan: plan and results.
  await page.getByRole("button", { name: /View My Pilot Plan/ }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("heading", { name: /2-weekend pilot/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision rule" })).toBeVisible();
  await expect(page.getByText("No pilot results yet")).toBeVisible();
  await expect(page.getByRole("button", { name: /Download run trace/ })).toHaveCount(0);
  await expect(page.getByText("Written by LLM")).toHaveCount(0);
  await expect(page.getByText("Cost figures are estimates and should be verified before making financial commitments.", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Built for the Qloo Agentic Hackathon")).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download my pilot plan/ }).click();
  expect((await download).suggestedFilename()).toMatch(/pilot-plan\.md$/);

  await page.getByLabel(/sold$/).fill("3");
  await page.getByLabel("Revenue (₹)").fill("700");
  await page.getByLabel(/^Footfall/).fill("900");
  await page.getByRole("button", { name: "Get verdict" }).click();
  await expect(page.getByText("Verdict: Stop")).toBeVisible();
  await expect(page.getByRole("table", { name: "Predicted versus actual pilot results" })).toBeVisible();
  await shoot(page, "4-pilot-plan.png", true);

  // Refresh and back keep the run without starting a new one.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /2-weekend pilot/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/recommendation$/);
  await expect(page.getByText("Your Top Recommendation")).toBeVisible();

  // Edit inputs: the form keeps what was entered.
  await page.goto("/discover");
  await expect(page.getByLabel("City")).toHaveValue("Bengaluru");

  // The developer page exists but is not linked from the app.
  await expect(page.locator('a[href="/dev"]')).toHaveCount(0);
  await page.goto("/dev");
  await expect(page.getByRole("heading", { name: "Developer status" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("the partner example compares both approaches and drafts outreach messages", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/discover");
  await expect(page.getByRole("radio", { name: /With an existing business/ })).toBeVisible();
  await page.getByRole("button", { name: "Try the partner example" }).click();
  await expect(page.getByText("4 of 4 agents completed")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /See the recommendation/ }).click();

  await openSection(page, /Partner strategy/);
  await expect(page.getByRole("heading", { name: /Recommended: start (on your own|with an existing business)|Neither approach fits yet/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Potential partners" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Collaboration options/ })).toBeVisible();

  await page.getByRole("button", { name: /High-visibility hosts \(\d+\)/ }).click();
  const firstCard = page.locator("li").filter({ has: page.getByText("Potential high-visibility host") }).first();
  await firstCard.getByRole("button").first().click();
  await expect(firstCard.getByText(/not verified footfall/)).toBeVisible();
  await firstCard.getByRole("button", { name: "Write an outreach message" }).click();
  await expect(firstCard.locator("textarea")).toHaveValue(/\[Your name\]/);
  await firstCard.getByRole("button", { name: "WhatsApp / DM" }).click();
  await expect(firstCard.locator("textarea")).toHaveValue(/Happy to drop by with samples/);
  await shoot(page, "5-partners.png", true);

  await openSection(page, /Explore neighbourhoods/);
  await expect(page.getByRole("heading", { name: "Where your idea's audience is" })).toBeVisible();
  await openSection(page, /View detailed budget/);
  await expect(page.getByRole("heading", { name: "Price positioning" })).toBeVisible();

  // Partner pilot plan.
  const toPlan = page.getByRole("button", { name: "See the partner pilot and outreach messages" });
  if (await toPlan.count()) {
    await toPlan.first().click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByRole("heading", { name: "Who to contact, in this order" })).toBeVisible();
    await shoot(page, "6-partner-plan.png", true);
  }
  expect(errors).toEqual([]);
});

test("the theme starts dark, switches, persists and avoids a flash on reload", async ({ page }) => {
  // First visit: the dark "aurora" theme, whatever the OS preference.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/discover");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(7, 7, 13)");
  await expect(page.getByRole("button", { name: "Try Nisha’s example" })).toBeVisible();
  await shoot(page, "7-dark-discover.png");

  // Switch to light; the choice persists across pages and reloads (set before first paint).
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(246, 245, 251)");
  await page.goto("/");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});

test("pages fit a phone screen and keep the theme toggle reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ["/", "/discover", "/agents", "/recommendation", "/plan"]) {
    await page.goto(route);
    await expect(page.getByRole("button", { name: /Switch to (dark|light) mode/ })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.waitForTimeout(1500); // let the hero entrance animation finish before the screenshot
  await shoot(page, "8-mobile-landing.png");
});

test("continuous animations stop for reduced-motion users", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".walker")).toHaveCount(8);
  const names = await page.evaluate(() => ({
    walker: getComputedStyle(document.querySelector(".walker")!).animationName,
    logo: getComputedStyle(document.querySelector("header .logo-swap > span")!).animationName,
    float: getComputedStyle(document.querySelector(".animate-float")!).animationName,
  }));
  expect(names).toEqual({ walker: "none", logo: "none", float: "none" });
});

test("users can add their own business idea and it is selected", async ({ page }) => {
  await page.goto("/discover");
  await page.getByLabel("Add your own business idea").fill("Handmade candles");
  await page.getByRole("button", { name: "+ Add idea" }).click();
  await expect(page.getByRole("checkbox", { name: /Handmade candles/ })).toBeChecked();
  await expect(page.locator("label").filter({ hasText: "Handmade candles" })).toContainText("Your idea");
});
