import { BROWNIE_EXAMPLE, NISHA_EXAMPLE } from "../src/lib/nisha";
import type { RunInput } from "../src/lib/schemas";
import { CONCEPTS } from "../src/server/data/concepts";
import { runPipeline } from "../src/server/orchestrator";
import type { QlooClient } from "../src/server/qloo/types";

/**
 * Replays real agent runs so the private snapshot contains exactly the calls the agents
 * make. Covers both demo scenarios first, then the other demo localities and ideas.
 */
export async function recordScenario(client: QlooClient): Promise<void> {
  const nishaConcepts = NISHA_EXAMPLE.conceptIds;
  const otherConcepts = CONCEPTS.map((c) => c.id).filter((id) => !nishaConcepts.includes(id)).slice(0, 5);
  const otherLocalities = ["HSR Layout", "Malleshwaram"];

  const runs: { label: string; input: RunInput }[] = [
    { label: "Nisha's example", input: NISHA_EXAMPLE },
    { label: "Partner example (brownies, both modes)", input: BROWNIE_EXAMPLE },
    { label: "Nisha's localities, other ideas", input: { ...NISHA_EXAMPLE, conceptIds: otherConcepts } },
    { label: "Other localities, Nisha's ideas", input: { ...NISHA_EXAMPLE, localities: otherLocalities } },
  ];

  for (const run of runs) {
    const result = await runPipeline(run.input, { qloo: client });
    const calls = result.agents.reduce((n, a) => n + a.qlooCalls.length, 0);
    console.log(`  ${run.label}: ${result.status}, ${calls} calls`);
    if (result.status === "failed") throw new Error(`Recording run failed: ${run.label}`);
  }
}
