import { z } from "zod";
import type { MarketEstimate } from "@/lib/schemas";
import bengaluruRaw from "./bengaluru.json";
import defaultRaw from "./default.json";

/**
 * Local market estimates: stall fees, footfall, venue types and permit notes.
 * Qloo does not provide these, so they come from a small curated dataset of
 * ILLUSTRATIVE ESTIMATES. Everything returned here is labelled source: "estimate".
 */

const venueOption = z.object({ type: z.string(), description: z.string(), feePerDayInr: z.number() });

const localityEntry = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  stallFeePerDayInr: z.number(),
  weekendFootfallPerDay: z.number(),
  venueOptions: z.array(venueOption),
});

const cityFile = z.object({
  city: z.string(),
  aliases: z.array(z.string()),
  suggestedLocalities: z.array(z.string()),
  permitNotes: z.array(z.string()),
  localities: z.record(z.string(), localityEntry),
});

const defaultFile = z.object({
  stallFeePerDayInr: z.number(),
  weekendFootfallPerDay: z.number(),
  venueOptions: z.array(venueOption),
  permitNotes: z.array(z.string()),
});

const CITIES = [cityFile.parse(bengaluruRaw)];
const DEFAULTS = defaultFile.parse(defaultRaw);

const norm = (s: string) => s.trim().toLowerCase();

function findCity(city: string) {
  return CITIES.find((c) => c.aliases.includes(norm(city)));
}

/** Localities to compare when the user chose "suggest for me". Falls back to the city itself. */
export function suggestLocalities(city: string): { localities: string[]; cityKnown: boolean } {
  const found = findCity(city);
  return found ? { localities: found.suggestedLocalities, cityKnown: true } : { localities: [city.trim()], cityKnown: false };
}

export function knownLocalities(city: string): string[] {
  return Object.values(findCity(city)?.localities ?? {}).map((l) => l.name);
}

export function getMarketEstimate(city: string, locality: string): MarketEstimate {
  const found = findCity(city);
  const entry = found ? Object.values(found.localities).find((l) => l.aliases.includes(norm(locality))) : undefined;
  const base = entry ?? DEFAULTS;
  return {
    localitySpecific: Boolean(entry),
    stallFeePerDayInr: base.stallFeePerDayInr,
    weekendFootfallPerDay: base.weekendFootfallPerDay,
    venueOptions: base.venueOptions.map((v) => ({ ...v, source: "estimate" as const })),
    permitNotes: found?.permitNotes ?? DEFAULTS.permitNotes,
    source: "estimate",
  };
}
