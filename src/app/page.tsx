import { App } from "@/components/app";
import { listConceptOptions } from "@/server/data/concepts";
import { knownLocalities } from "@/server/data/local-market";
import { readServerEnv } from "@/server/env";
import { loadSnapshotFromDisk } from "@/server/qloo/recorded";

// Rendered per request so the data-source badge reflects the current configuration.
export const dynamic = "force-dynamic";

export default function Home() {
  const env = readServerEnv();
  const qlooStatus = env.qlooMode === "live" && env.qlooApiKey ? "live" : loadSnapshotFromDisk() ? "recorded" : "sample";
  return <App concepts={listConceptOptions()} knownLocalities={{ bengaluru: knownLocalities("Bengaluru") }} qlooStatus={qlooStatus} />;
}
