"use client";

import { MotionConfig } from "motion/react";
import { CursorEffects } from "./cursor-effects";
import { RunProvider, type AppConfig } from "./run-provider";

/** Client-side providers for the whole app: shared run state, and motion that respects reduced-motion settings. */
export function Providers({ config, children }: { config: AppConfig; children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <RunProvider config={config}>{children}</RunProvider>
      <CursorEffects />
    </MotionConfig>
  );
}
