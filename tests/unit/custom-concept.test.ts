import { describe, expect, it } from "vitest";
import { CUSTOM_PREFIX, getConcept } from "@/server/data/concepts";

describe("custom business ideas", () => {
  it("builds a concept from the user's words, costed like the most similar stall", () => {
    const c = getConcept(`${CUSTOM_PREFIX}Handmade candles`);
    expect(c?.label).toBe("Handmade candles");
    expect(c?.id).toBe(`${CUSTOM_PREFIX}Handmade candles`);
    expect(c?.keywords).toContain("candles");
    expect(c?.unitCostInr).toBe(getConcept("plant-stall")?.unitCostInr);
  });

  it("falls back to a general stall model and rejects empty labels", () => {
    expect(getConcept(`${CUSTOM_PREFIX}Zine swap`)?.unitCostInr).toBe(getConcept("art-prints")?.unitCostInr);
    expect(getConcept(`${CUSTOM_PREFIX} `)).toBeUndefined();
    expect(getConcept("not-a-concept")).toBeUndefined();
  });
});
