import { describe, expect, it } from "vitest";
import { APP_NAME, DISCLAIMER, TEAM_CREDIT } from "@/lib/brand";

describe("brand constants", () => {
  it("uses the Culture2Commerce name and credits Team VKY", () => {
    expect(APP_NAME).toBe("Culture2Commerce");
    expect(TEAM_CREDIT).toContain("Vaishhnavi");
    expect(TEAM_CREDIT).toContain("Khushi");
    expect(TEAM_CREDIT).toContain("Yashi");
  });

  it("has the planning disclaimer", () => {
    expect(DISCLAIMER).toMatch(/not financial or legal advice/);
  });
});
