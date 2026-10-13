# Progress

To resume in a new session, say: **"continue from PROGRESS.md"**.

## Current state

- **Date:** 13 Oct 2026
- **Last completed phase:** Phase 4 (Qloo client layer)
- **Next phase:** Phase 5 (agents, orchestrator, scoring, confidence)

## Features by status

See `docs/features.json` (single source of truth).

- Tested: scaffold, qloo-live-client, qloo-fallback
- Implemented: env-setup, qloo-discovery, qloo-scripts
- Pending: everything else

## Checks run

| Date | Command | Result |
|---|---|---|
| 13 Oct | `git check-ignore -v .env.local` | Ignored by `.gitignore` rule `.env.*` |
| 13 Oct | 29 manual probe calls to the live Qloo API | All HTTP 200 except two deliberate `take=300` tests (HTTP 400). Monthly quota 9,971 of 10,000 remaining. |
| 13 Oct | `npm run lint` | Pass (exit 0, no warnings) |
| 13 Oct | `npm run typecheck` | Pass (exit 0) |
| 13 Oct | `npm run build` | Pass (Next.js 15.5.27, 4 static pages), last run in Phase 3 |
| 13 Oct | `npm test` | Pass: 4 files, 38 of 38 tests (no network) |
| 13 Oct | `npm run qloo:check` | Pass 3 of 3 live calls (about 0.3 to 1.0 s each) |
| 13 Oct | `npm run test:live` | Pass: 5 of 5 live tests |
| 13 Oct | `npm run qloo:record` | Wrote private snapshot `.qloo-cache/snapshot.json` (git-ignored) |

## Live Qloo status

Working with the key in `.env.local`. Limits: 10,000 calls per month, 5 per second, `take` max 50.
About 60 calls used so far.

## Known issues

- `gh` (GitHub CLI) and Vercel CLI are not installed. Needed in Phase 12 (or use the websites).
- The parent folder `C:\Users\vaish` is a git repository; the project has its own, see DECISIONS D1.
- Node is 20.11.1; npm prints an EBADENGINE warning for one ESLint sub-package (wants 20.19+). Lint still passes. Vitest is pinned to v3 / Vite 6 for the same reason.
- `filter.tag.types` with several comma-separated types returned only `genre:place` tags in the live test; cross-domain taste tags need one call per tag type.
- The project is inside OneDrive; watch for slow or locked `node_modules`.
- Qloo terms forbid committing response data, so bundled fallback data is illustrative, see DECISIONS D2.

## Next steps

1. Phase 5: agents, orchestrator, scoring, Nisha integration test.
