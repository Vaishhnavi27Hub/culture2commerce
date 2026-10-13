# Progress

To resume in a new session, say: **"continue from PROGRESS.md"**.

## Current state

- **Date:** 13 Oct 2026
- **Last completed phase:** Phase 2 (Qloo discovery and plan)
- **Next phase:** Phase 3 (scaffold Next.js + TypeScript + Tailwind, lint, typecheck, Vitest, LICENSE)

## Features by status

See `docs/features.json` (single source of truth).

- Implemented: env-setup, qloo-discovery
- Pending: everything else

## Checks run

| Date | Command | Result |
|---|---|---|
| 13 Oct | `git check-ignore -v .env.local` | Ignored by `.gitignore` rule `.env.*` |
| 13 Oct | 29 manual probe calls to the live Qloo API | All HTTP 200 except two deliberate `take=300` tests (HTTP 400). Monthly quota 9,971 of 10,000 remaining. |

No lint, typecheck, test or build has been run yet (no code exists yet).

## Live Qloo status

Working with the key in `.env.local`. Limits: 10,000 calls per month, 5 per second, `take` max 50.

## Known issues

- `gh` (GitHub CLI) and Vercel CLI are not installed. Needed in Phase 12 (or use the websites).
- The parent folder `C:\Users\vaish` is a git repository; the project has its own, see DECISIONS D1.
- The project is inside OneDrive; watch for slow or locked `node_modules`.
- Qloo terms forbid committing response data, so bundled fallback data is illustrative, see DECISIONS D2.

## Next steps

1. Phase 3: scaffold and first build.
2. Phase 4: Qloo client layer, `qloo:check`, `qloo:record`, contract tests.
3. Phase 5: agents, orchestrator, scoring, Nisha integration test.
