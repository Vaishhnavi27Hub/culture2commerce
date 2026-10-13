/**
 * npm run nisha            runs the demo scenario with whatever QLOO_MODE / key is configured
 * npm run nisha -- sample  forces bundled sample data (no network)
 *
 * Prints a compact summary of the run: agents, ranking, winner, confidence and pilot rule.
 */
import { NISHA_EXAMPLE } from "../src/lib/nisha";
import { readServerEnv } from "../src/server/env";
import { getNarrator, resolveLlmConfig } from "../src/server/llm/client";
import { runPipeline } from "../src/server/orchestrator";
import { createQlooClient } from "../src/server/qloo";
import { getLastQlooQuota } from "../src/server/qloo/live";
import { loadEnvLocal } from "./load-env";

async function main() {
  loadEnvLocal();
  const forceSample = process.argv.includes("sample");
  const env = readServerEnv();
  const qloo = forceSample
    ? createQlooClient({ env: { ...env, qlooMode: "recorded" }, snapshot: null })
    : createQlooClient({ env });

  const started = Date.now();
  // The LLM is used only if LLM_PROVIDER and LLM_API_KEY are set; it never changes scores.
  const narrate = getNarrator(env);
  const llm = resolveLlmConfig(env);
  console.log(llm ? `LLM: on (${llm.provider}, model ${llm.model})` : "LLM: off (template text)");
  const result = await runPipeline(NISHA_EXAMPLE, { qloo, ...(narrate ? { narrate } : {}) });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nRun ${result.status} in ${seconds}s | Qloo data: ${result.qlooSource} | calls: live ${result.qlooCallCounts.live}, recorded ${result.qlooCallCounts.recorded}, sample ${result.qlooCallCounts.sample}`);
  if (result.message) console.log(`Message: ${result.message}`);

  console.log("\nAGENTS");
  for (const a of result.agents) {
    console.log(`  ${a.status.padEnd(9)} ${a.agent.padEnd(28)} ${String(a.durationMs ?? 0).padStart(5)} ms  ${a.qlooCalls.length} Qloo calls  [${a.dataSources.join(", ")}]`);
    console.log(`            -> ${a.outputSummary ?? a.error ?? a.warnings[0] ?? ""}`);
    for (const w of a.warnings) console.log(`            ! ${w}`);
  }

  console.log("\nLOCALITIES");
  for (const l of result.localities) {
    console.log(`  ${l.name} (${l.level}, ${l.qlooSource}) anchors: ${l.anchors.map((a) => a.name).join("; ")}`);
    console.log(`     vibe: ${l.vibeTags.map((v) => `${v.name}×${v.count}`).join(", ")}`);
    console.log(`     competitors: ${l.competitors.map((c) => `${c.conceptId}=${c.count}${c.capped ? "+" : ""}`).join(", ")}`);
  }

  console.log("\nRANKING  (final = cultural / feasibility / risk)");
  for (const o of result.options) {
    const affinity = o.evidence.filter((e) => e.kind === "concept_affinity").map((e) => e.value?.toFixed(3)).join(",");
    console.log(
      `  ${String(o.rank).padStart(2)}. ${o.id.padEnd(28)} ${String(o.scores.final).padStart(5)} = ${o.scores.culturalFit} / ${o.scores.feasibility} / ${o.scores.riskAdjustment}` +
        `  ${o.verdict.padEnd(10)} ₹${o.totalCostInr} (${o.budgetUsedPct}%)  units ${o.plannedUnits}  conf ${o.confidence.level}(${o.confidence.points})  aff[${affinity}]`,
    );
  }

  const winner = result.options.find((o) => o.id === result.winnerId);
  if (winner) {
    console.log(`\nWINNER: ${winner.conceptLabel} in ${winner.locality}`);
    console.log(`  Audience: ${winner.targetAudience}`);
    console.log(`  Evidence (${winner.evidence.length}):`);
    for (const e of winner.evidence) console.log(`    [${e.source}] ${e.kind}: ${e.label}${e.value !== undefined ? ` = ${e.value}` : ""}`);
    console.log(`  Confidence ${winner.confidence.level}: ${winner.confidence.reasons.map((r) => `${r.effect === "up" ? "+" : r.effect === "cap" ? "cap" : "-"} ${r.text}`).join(" | ")}`);
  }
  if (result.pilotPlan) {
    const p = result.pilotPlan;
    console.log(`\nPILOT: ${p.title}  cost ₹${p.totalCostInr}, buffer ₹${p.bufferInr}`);
    console.log(`  ${p.rule.continueIf}\n  ${p.rule.pivotIf}\n  ${p.rule.stopIf}`);
    console.log(`  Predicted: ${p.predicted.units} units, ₹${p.predicted.revenueInr}, footfall ${p.predicted.footfall}`);
  }
  if (result.narrative) {
    const n = result.narrative;
    console.log(`\nNARRATIVE [${n.source}]: ${n.headline}\n  WHY: ${n.whyThis}\n  PITCH: ${n.pilotPitch}`);
    if (n.note) console.log(`  NOTE: ${n.note}`);
  }

  const fallbacks = result.agents.flatMap((a) => a.qlooCalls).filter((c) => c.fallbackReason);
  if (fallbacks.length) console.log(`\n${fallbacks.length} calls used a fallback, e.g. ${fallbacks[0]?.fallbackReason}`);
  const quota = getLastQlooQuota();
  if (quota?.monthRemaining !== undefined) console.log(`\nQloo quota remaining: ${quota.monthRemaining}`);
}

main().catch((err) => {
  console.log(`Run failed: ${err instanceof Error ? err.message : "unexpected error"}`);
  process.exitCode = 1;
});
