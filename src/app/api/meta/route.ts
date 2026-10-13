import { listConceptOptions } from "@/server/data/concepts";
import { knownLocalities } from "@/server/data/local-market";
import { readServerEnv } from "@/server/env";
import { resolveLlmConfig } from "@/server/llm/client";
import { loadSnapshotFromDisk } from "@/server/qloo/recorded";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Options for the input form plus which data sources are configured. Never returns secrets. */
export async function GET(): Promise<Response> {
  const env = readServerEnv();
  return Response.json(
    {
      concepts: listConceptOptions(),
      cities: [{ name: "Bengaluru", localities: knownLocalities("Bengaluru") }],
      qloo: {
        mode: env.qlooMode,
        keyConfigured: Boolean(env.qlooApiKey),
        recordedSnapshotAvailable: Boolean(loadSnapshotFromDisk()),
      },
      llm: { enabled: Boolean(resolveLlmConfig(env)) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
