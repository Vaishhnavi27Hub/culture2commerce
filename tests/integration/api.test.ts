import { beforeEach, describe, expect, it } from "vitest";
import { NISHA_EXAMPLE } from "@/lib/nisha";
import { AGENT_NAMES, runResultSchema, streamMessageSchema, type StreamMessage } from "@/lib/schemas";
import { getStoredRun, handleRunRequest, resetRateLimit } from "@/server/api/run-handler";
import { sampleOnlyQloo } from "../helpers/ctx";

const post = (body: unknown, query = "", headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/run${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function readStream(res: Response): Promise<StreamMessage[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => streamMessageSchema.parse(JSON.parse(line)));
}

describe("POST /api/run", () => {
  beforeEach(() => resetRateLimit());
  const deps = () => ({ qloo: sampleOnlyQloo() });

  it("streams agent events as NDJSON and ends with the full result", async () => {
    const res = await handleRunRequest(post(NISHA_EXAMPLE), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/x-ndjson/);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);

    const messages = await readStream(res);
    const last = messages.at(-1)!;
    expect(last.type).toBe("result");
    expect(messages.slice(0, -1).every((m) => m.type === "event")).toBe(true);

    const events = messages.flatMap((m) => (m.type === "event" ? [m.event] : []));
    expect(events.slice(0, 4).map((e) => e.status)).toEqual(["queued", "queued", "queued", "queued"]);
    expect(events.filter((e) => e.status === "completed").map((e) => e.agent)).toEqual([...AGENT_NAMES]);

    if (last.type !== "result") throw new Error("unreachable");
    expect(last.result.status).toBe("completed");
    expect(last.result.winnerId).toBeDefined();
    expect(last.result.pilotPlan).toBeDefined();
    expect(getStoredRun(last.result.runId)?.runId).toBe(last.result.runId);
  });

  it("returns the whole result as one JSON document with ?stream=0", async () => {
    const res = await handleRunRequest(post(NISHA_EXAMPLE, "?stream=0"), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    const result = runResultSchema.parse(await res.json());
    expect(result.agents).toHaveLength(4);
  });

  it("applies defaults for optional fields", async () => {
    const res = await handleRunRequest(post({ city: "Bengaluru", budgetInr: 20000, weekends: 1, conceptIds: ["plant-stall"] }, "?stream=0"), deps());
    const result = runResultSchema.parse(await res.json());
    expect(result.input.riskPreference).toBe("low");
    expect(result.input.localities).toEqual([]);
    expect(result.localities).toHaveLength(3);
  });

  it.each([
    ["a negative budget", { ...NISHA_EXAMPLE, budgetInr: -1 }, "budgetInr"],
    ["no business ideas", { ...NISHA_EXAMPLE, conceptIds: [] }, "conceptIds"],
    ["too many localities", { ...NISHA_EXAMPLE, localities: ["a", "b", "c", "d"] }, "localities"],
    ["a missing city", { ...NISHA_EXAMPLE, city: "" }, "city"],
    ["a wrong risk value", { ...NISHA_EXAMPLE, riskPreference: "yolo" }, "riskPreference"],
  ])("rejects %s with a clear 400", async (_name, body, field) => {
    const res = await handleRunRequest(post(body), deps());
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; issues: { field: string; message: string }[] };
    expect(data.error).toBe("Some inputs are missing or invalid.");
    expect(data.issues.some((i) => i.field.startsWith(field))).toBe(true);
  });

  it("rejects malformed JSON and oversized bodies", async () => {
    const bad = await handleRunRequest(post("{not json"), deps());
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toMatch(/valid JSON/);
    const big = await handleRunRequest(post(JSON.stringify({ ...NISHA_EXAMPLE, pad: "x".repeat(20_000) })), deps());
    expect(big.status).toBe(413);
  });

  it("reports a crashed run as an error message on the stream, not a broken connection", async () => {
    const res = await handleRunRequest(post(NISHA_EXAMPLE), {
      run: async () => {
        throw new Error("secret internal detail");
      },
    });
    expect(res.status).toBe(200);
    const messages = await readStream(res);
    expect(messages).toEqual([{ type: "error", message: "The run failed unexpectedly. Please try again." }]);
  });

  it("returns 500 without internal details in non-streaming mode", async () => {
    const res = await handleRunRequest(post(NISHA_EXAMPLE, "?stream=0"), {
      run: async () => {
        throw new Error("secret internal detail");
      },
    });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret internal detail");
  });

  it("rate-limits each client separately", async () => {
    const limited = { ...deps(), rateLimit: { max: 2, windowMs: 60_000 } };
    const from = (ip: string) => post({ ...NISHA_EXAMPLE, conceptIds: [] }, "", { "x-forwarded-for": ip });
    expect((await handleRunRequest(from("1.1.1.1"), limited)).status).toBe(400);
    expect((await handleRunRequest(from("1.1.1.1"), limited)).status).toBe(400);
    const third = await handleRunRequest(from("1.1.1.1"), limited);
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBe("60");
    expect((await handleRunRequest(from("2.2.2.2"), limited)).status).toBe(400);
  });
});
