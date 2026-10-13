import { NISHA_EXAMPLE } from "@/lib/nisha";
import { runInputSchema, type RunInput } from "@/lib/schemas";
import type { AgentContext } from "@/server/agents/types";
import { getConcept, type Concept } from "@/server/data/concepts";
import { readServerEnv } from "@/server/env";
import { createQlooClient } from "@/server/qloo";
import type { QlooClient } from "@/server/qloo/types";

/** A Qloo client that only ever serves bundled sample data (no network, no snapshot). */
export function sampleOnlyQloo(): QlooClient {
  return createQlooClient({ env: readServerEnv({ QLOO_MODE: "recorded" }), snapshot: null });
}

export function makeCtx(overrides: Partial<RunInput> = {}, qloo: QlooClient = sampleOnlyQloo()): AgentContext & { notes: string[] } {
  const input = runInputSchema.parse({ ...NISHA_EXAMPLE, ...overrides });
  const notes: string[] = [];
  return {
    qloo,
    input,
    concepts: input.conceptIds.map(getConcept).filter((c): c is Concept => Boolean(c)),
    note: (text) => notes.push(text),
    notes,
  };
}
