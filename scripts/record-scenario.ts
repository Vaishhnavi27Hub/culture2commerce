import type { QlooClient } from "../src/server/qloo/types";

/** Localities the built-in demo offers. */
export const DEMO_CITY = "Bengaluru";
export const DEMO_LOCALITIES = ["Indiranagar", "Koramangala", "Jayanagar", "HSR Layout", "Malleshwaram"];

/**
 * The calls worth having offline. Phase 5 replaces this with a real run of the agent
 * orchestrator so the snapshot always matches what the agents ask for.
 */
export async function recordScenario(client: QlooClient): Promise<void> {
  for (const locality of DEMO_LOCALITIES) {
    const places = await client.getLocalityPlaces({ locality, city: DEMO_CITY });
    const anchorIds = places.data.places.slice(0, 5).map((p) => p.id);
    if (anchorIds.length === 0) continue;
    await Promise.all([
      client.getBrandAffinity({ anchorIds }),
      client.getDemographics({ anchorIds }),
    ]);
    console.log(`  recorded ${locality}`);
  }
}
