import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readServerEnv } from "@/server/env";
import { resolveLlmConfig } from "@/server/llm/client";
import { loadSnapshotFromDisk } from "@/server/qloo/recorded";
import features from "../../../docs/features.json";

/**
 * Developer status page. Not linked from the app.
 * Available only when NODE_ENV is not "production" or ENABLE_DEV_PAGE=true.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Developer status", robots: { index: false, follow: false } };

interface TestSummary {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numTotalTestSuites?: number;
  startTime?: number;
  success?: boolean;
}

interface QlooCheck {
  checkedAt?: string;
  ok?: boolean;
  monthRemaining?: number;
  note?: string;
  results?: { name: string; ok: boolean; ms: number; detail: string }[];
}

function readJson<T>(relative: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relative), "utf8")) as T;
  } catch {
    return undefined;
  }
}

const STATUS_STYLE: Record<string, string> = {
  tested: "bg-leaf-soft text-leaf",
  implemented: "bg-brand-soft text-brand-dark",
  in_progress: "bg-warn-soft text-warn",
  pending: "bg-line text-muted",
};

export default function DevPage() {
  const env = readServerEnv();
  if (!env.enableDevPage) notFound();

  const tests = readJson<TestSummary>(".dev-status/test-results.json");
  const check = readJson<QlooCheck>(".dev-status/qloo-check.json");
  const counts = features.features.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }), {});

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Developer status</h1>
        <p className="mt-1 text-sm text-muted">Internal page. Source of truth: docs/features.json (updated {features.updated}).</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Latest test run</h2>
          {tests?.numTotalTests !== undefined ? (
            <>
              <p className={`mt-2 font-display text-3xl font-bold ${tests.success ? "text-leaf" : "text-bad"}`}>
                {tests.numPassedTests} / {tests.numTotalTests}
              </p>
              <p className="text-sm text-muted">
                tests passed in {tests.numTotalTestSuites} files{tests.startTime ? ` · ${new Date(tests.startTime).toLocaleString("en-IN")}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No summary found. Run <code>npm test</code>.</p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Last qloo:check</h2>
          {check ? (
            <>
              <p className={`mt-2 font-display text-3xl font-bold ${check.ok ? "text-leaf" : "text-bad"}`}>{check.ok ? "Passed" : "Failed"}</p>
              <p className="text-sm text-muted">
                {check.checkedAt ? new Date(check.checkedAt).toLocaleString("en-IN") : ""}
                {check.monthRemaining !== undefined ? ` · ${check.monthRemaining} calls left this month` : ""}
              </p>
              {check.note && <p className="mt-1 text-sm text-bad">{check.note}</p>}
              <ul className="mt-2 space-y-1 text-xs">
                {(check.results ?? []).map((r) => (
                  <li key={r.name}>
                    <span className={r.ok ? "text-leaf" : "text-bad"}>{r.ok ? "PASS" : "FAIL"}</span> {r.name} · {r.ms} ms · {r.detail}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No result found. Run <code>npm run qloo:check</code>.</p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Configuration</h2>
          <dl className="mt-2 space-y-1 text-sm">
            {[
              ["QLOO_MODE", env.qlooMode],
              ["Qloo key", env.qlooApiKey ? "set" : "not set"],
              ["Recorded snapshot", loadSnapshotFromDisk() ? "present" : "none"],
              ["LLM", resolveLlmConfig(env) ? `on (${env.llmProvider})` : "off (templates)"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">Secret values are never shown here.</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">Features</h2>
        <p className="mt-1 text-sm text-muted">
          {Object.entries(counts)
            .map(([status, n]) => `${n} ${status.replace("_", " ")}`)
            .join(" · ")}
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="p-3 font-semibold">Feature</th>
                <th scope="col" className="p-3 font-semibold">Status</th>
                <th scope="col" className="p-3 font-semibold">Tests</th>
                <th scope="col" className="p-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {features.features.map((f) => (
                <tr key={f.id} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="p-3 text-left font-medium">
                    {f.title}
                    <span className="block text-xs font-normal text-muted">{f.id}</span>
                  </th>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[f.status] ?? STATUS_STYLE.pending}`}>{f.status.replace("_", " ")}</span>
                  </td>
                  <td className="p-3 text-xs text-muted">{f.tests.length ? f.tests.join(", ") : "none"}</td>
                  <td className="p-3 text-xs">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
