import { runInputSchema, type AgentEvent, type RunResult, type StreamMessage } from "@/lib/schemas";
import type { NarrativeFacts } from "../llm/templates";
import { runPipeline, type RunOptions } from "../orchestrator";
import type { Narrative } from "@/lib/schemas";
import type { QlooClient } from "../qloo/types";

/**
 * POST /api/run
 *
 * Body: RunInput as JSON. Response: a stream of newline-delimited JSON messages
 * (`application/x-ndjson`), one per agent event, ending with the full result:
 *
 *   {"type":"event","event":{...}}      many
 *   {"type":"result","result":{...}}    once, last
 *   {"type":"error","message":"..."}    instead of result if the run crashed
 *
 * Add `?stream=0` to get the final result as a single JSON document instead.
 */

export interface RunHandlerDeps {
  qloo?: QlooClient;
  narrate?: (facts: NarrativeFacts) => Promise<Narrative>;
  /** Injected for tests. */
  run?: (input: unknown, options: RunOptions) => Promise<RunResult>;
  rateLimit?: { max: number; windowMs: number };
  now?: () => number;
}

export const MAX_BODY_BYTES = 10_000;
const DEFAULT_RATE_LIMIT = { max: 12, windowMs: 10 * 60_000 };

// --- Run storage: in-memory, most recent runs only. No database. ---
const MAX_STORED_RUNS = 50;
const runs = new Map<string, RunResult>();

export function storeRun(result: RunResult): void {
  runs.set(result.runId, result);
  while (runs.size > MAX_STORED_RUNS) {
    const oldest = runs.keys().next().value;
    if (oldest === undefined) break;
    runs.delete(oldest);
  }
}

export function getStoredRun(runId: string): RunResult | undefined {
  return runs.get(runId);
}

// --- Rate limit: protects the shared Qloo quota on a public deployment. ---
const hits = new Map<string, number[]>();

export function resetRateLimit(): void {
  hits.clear();
}

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function allow(key: string, limit: { max: number; windowMs: number }, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < limit.windowMs);
  if (recent.length >= limit.max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function handleRunRequest(request: Request, deps: RunHandlerDeps = {}): Promise<Response> {
  const now = deps.now ?? Date.now;
  const limit = deps.rateLimit ?? DEFAULT_RATE_LIMIT;

  if (!allow(clientKey(request), limit, now())) {
    return json(
      { error: "Too many runs in a short time. Please wait a few minutes and try again." },
      429,
      { "Retry-After": String(Math.ceil(limit.windowMs / 1000)) },
    );
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ error: "Could not read the request body." }, 400);
  }
  if (text.length > MAX_BODY_BYTES) return json({ error: "The request is too large." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "The request body must be valid JSON." }, 400);
  }

  const parsed = runInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Some inputs are missing or invalid.",
        issues: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "(root)", message: i.message })),
      },
      400,
    );
  }

  const run = deps.run ?? runPipeline;
  const options: RunOptions = {
    ...(deps.qloo ? { qloo: deps.qloo } : {}),
    ...(deps.narrate ? { narrate: deps.narrate } : {}),
  };
  const wantsStream = new URL(request.url).searchParams.get("stream") !== "0";

  if (!wantsStream) {
    try {
      const result = await run(parsed.data, options);
      storeRun(result);
      return json(result, 200);
    } catch {
      return json({ error: "The run failed unexpectedly. Please try again." }, 500);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (message: StreamMessage) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
        } catch {
          open = false; // the client went away; let the run finish quietly
        }
      };
      try {
        const result = await run(parsed.data, { ...options, onEvent: (event: AgentEvent) => send({ type: "event", event }) });
        storeRun(result);
        send({ type: "result", result });
      } catch {
        send({ type: "error", message: "The run failed unexpectedly. Please try again." });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
