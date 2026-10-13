import { bindAll } from "./recorded";
import { QlooError, type QlooClient, type QlooMethodName, type QlooMethods, type QlooSource, type Sourced } from "./types";

export interface FallbackLayer {
  label: QlooSource;
  client: QlooClient;
}

export interface FallbackOptions {
  /** After a connectivity-type failure, skip that layer for this long so a demo stays fast. */
  cooldownMs?: number;
  now?: () => number;
}

/** Failures that will very likely repeat on the next call, so retrying immediately only adds delay. */
const TRIPPING: ReadonlySet<string> = new Set(["no_key", "rate_limited", "timeout", "network"]);

function describe(err: unknown): { kind: string; message: string } {
  if (err instanceof QlooError) return { kind: err.kind, message: err.message };
  return { kind: "unknown", message: "unexpected error" };
}

/**
 * Tries each layer in order for every call (live, then recorded, then sample) and
 * records why earlier layers were skipped in `call.fallbackReason`.
 */
export function createFallbackQlooClient(layers: FallbackLayer[], options: FallbackOptions = {}): QlooClient {
  const { cooldownMs = 60_000, now = Date.now } = options;
  const tripped = new Map<QlooSource, { until: number; message: string }>();

  async function call<M extends QlooMethodName>(
    method: M,
    args: QlooMethods[M]["args"],
  ): Promise<Sourced<QlooMethods[M]["result"]>> {
    const reasons: string[] = [];
    for (const layer of layers) {
      const trip = tripped.get(layer.label);
      if (trip && trip.until > now()) {
        reasons.push(`${layer.label}: ${trip.message}`);
        continue;
      }
      try {
        const fn = layer.client[method] as (a: QlooMethods[M]["args"]) => Promise<Sourced<QlooMethods[M]["result"]>>;
        const result = await fn(args);
        if (reasons.length === 0) return result;
        return { ...result, call: { ...result.call, fallbackReason: reasons.join("; ") } };
      } catch (err) {
        const { kind, message } = describe(err);
        // A missing recording is normal and not worth reporting on its own.
        if (kind !== "not_recorded") reasons.push(`${layer.label}: ${message}`);
        if (TRIPPING.has(kind)) tripped.set(layer.label, { until: now() + cooldownMs, message });
      }
    }
    throw new QlooError("network", `No Qloo data source could answer ${method} (${reasons.join("; ")})`);
  }

  return bindAll(call);
}
