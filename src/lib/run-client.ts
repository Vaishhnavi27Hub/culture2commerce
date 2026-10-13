import { streamMessageSchema, type AgentEvent, type RunInput, type RunResult } from "./schemas";

export class RunRequestError extends Error {
  constructor(
    message: string,
    public readonly issues: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "RunRequestError";
  }
}

/**
 * Starts a run and reads the NDJSON stream from POST /api/run.
 * Calls `onEvent` for each agent event and resolves with the final result.
 */
export async function streamRun(input: RunInput, onEvent: (event: AgentEvent) => void, signal?: AbortSignal): Promise<RunResult> {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: { field: string; message: string }[] };
    throw new RunRequestError(data.error ?? `The server responded with status ${res.status}.`, data.issues ?? []);
  }
  if (!res.body) throw new RunRequestError("The server sent an empty response.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RunResult | undefined;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const parsed = streamMessageSchema.safeParse(JSON.parse(line));
    if (!parsed.success) return; // ignore anything we do not understand
    const message = parsed.data;
    if (message.type === "event") onEvent(message.event);
    else if (message.type === "result") result = message.result;
    else throw new RunRequestError(message.message);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  handleLine(buffer);

  if (!result) throw new RunRequestError("The run ended without a result. Please try again.");
  return result;
}
