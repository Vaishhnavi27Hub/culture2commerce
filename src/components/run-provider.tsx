"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RunRequestError, streamRun } from "@/lib/run-client";
import { runResultSchema, type AgentTrace, type RunInput, type RunResult } from "@/lib/schemas";
import { applyEvent, emptyTraces } from "@/lib/trace";
import type { ConceptOption, FormState } from "./input-form";

/**
 * Shared state for the whole journey (landing → discover → agents → recommendation → plan).
 * It lives in the root layout, so moving between pages keeps the run, the form draft and the
 * user's selections. The finished run and the draft are also kept in sessionStorage, so a
 * refresh or the browser back button does not lose progress. Nothing starts a run except an
 * explicit submit, so navigation never triggers duplicate Qloo calls.
 */

const RESULT_KEY = "c2c:last-run";
const DRAFT_KEY = "c2c:draft";

export interface AppConfig {
  concepts: ConceptOption[];
  knownLocalities: Record<string, string[]>;
  /** What the server is configured to use, shown before the first run. */
  qlooStatus: "live" | "recorded" | "sample";
}

interface RunState {
  config: AppConfig;
  /** True once sessionStorage has been read, so pages can tell "no run" from "not loaded yet". */
  hydrated: boolean;
  traces: AgentTrace[];
  result: RunResult | undefined;
  running: boolean;
  error: string | undefined;
  issues: { field: string; message: string }[];
  draft: FormState | undefined;
  setDraft: (draft: FormState) => void;
  selectedId: string | undefined;
  setSelectedId: (id: string | undefined) => void;
  partnerId: string | undefined;
  setPartnerId: (id: string | undefined) => void;
  planTab: "solo" | "partner";
  setPlanTab: (tab: "solo" | "partner") => void;
  start: (input: RunInput) => void;
  saveResults: (pilotResults: NonNullable<RunResult["pilotResults"]>) => void;
}

const RunContext = createContext<RunState | undefined>(undefined);

export function useRun(): RunState {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun must be used inside RunProvider");
  return ctx;
}

const store = {
  read<T>(key: string): T | undefined {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  },
  write(key: string, value: unknown) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode); the app works without it.
    }
  },
};

export function RunProvider({ config, children }: { config: AppConfig; children: React.ReactNode }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [traces, setTraces] = useState<AgentTrace[]>(emptyTraces);
  const [result, setResult] = useState<RunResult | undefined>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const [draft, setDraftState] = useState<FormState | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [partnerId, setPartnerId] = useState<string | undefined>();
  const [planTab, setPlanTab] = useState<"solo" | "partner">("solo");
  const abortRef = useRef<AbortController | null>(null);

  // Restore the last run and the form draft after a refresh (kept only in this browser tab).
  useEffect(() => {
    const saved = runResultSchema.safeParse(store.read(RESULT_KEY));
    if (saved.success) {
      setResult(saved.data);
      setTraces(saved.data.agents);
      setSelectedId(saved.data.winnerId ?? saved.data.options[0]?.id);
      setPlanTab(saved.data.input.launchMode === "partner" || saved.data.comparison?.recommended === "partner" ? "partner" : "solo");
    }
    const savedDraft = store.read<FormState>(DRAFT_KEY);
    if (savedDraft && typeof savedDraft === "object" && Array.isArray(savedDraft.conceptIds)) setDraftState(savedDraft);
    setHydrated(true);
  }, []);

  const setDraft = useCallback((next: FormState) => {
    setDraftState(next);
    store.write(DRAFT_KEY, next);
  }, []);

  const start = useCallback(
    (input: RunInput) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(undefined);
      setIssues([]);
      setResult(undefined);
      setPartnerId(undefined);
      setPlanTab(input.launchMode === "partner" ? "partner" : "solo");
      setTraces(emptyTraces());
      setRunning(true);
      router.push("/agents");
      streamRun(input, (event) => setTraces((t) => applyEvent(t, event)), controller.signal)
        .then((finished) => {
          setResult(finished);
          setTraces(finished.agents);
          setSelectedId(finished.winnerId ?? finished.options[0]?.id);
          if (finished.comparison?.recommended === "partner") setPlanTab("partner");
          store.write(RESULT_KEY, finished);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof RunRequestError) {
            setError(err.message);
            setIssues(err.issues);
            if (err.issues.length > 0) router.push("/discover");
          } else {
            setError("Could not reach the server. Check your connection and try again.");
          }
        })
        .finally(() => {
          if (abortRef.current === controller) setRunning(false);
        });
    },
    [router],
  );

  const saveResults = useCallback((pilotResults: NonNullable<RunResult["pilotResults"]>) => {
    setResult((current) => {
      if (!current) return current;
      const next = { ...current, pilotResults };
      store.write(RESULT_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<RunState>(
    () => ({
      config,
      hydrated,
      traces,
      result,
      running,
      error,
      issues,
      draft,
      setDraft,
      selectedId,
      setSelectedId,
      partnerId,
      setPartnerId,
      planTab,
      setPlanTab,
      start,
      saveResults,
    }),
    [config, hydrated, traces, result, running, error, issues, draft, setDraft, selectedId, partnerId, planTab, start, saveResults],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}
