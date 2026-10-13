# Progress

To resume in a new session, say: **"continue from PROGRESS.md"**.

## Current state

- **Date:** 13 Oct 2026
- **Last completed phase:** Phase 7 (run API with streaming)
- **Next phase:** Phase 8 (frontend screens)

## Features by status

See `docs/features.json` (single source of truth; `node scripts/progress.mjs list` prints it).

- Tested: scaffold, qloo-live-client, qloo-fallback, all four agents, orchestrator, scoring-confidence, llm-layer, api-run-stream
- Implemented: env-setup, qloo-discovery, qloo-scripts
- Pending: all UI features, branding, dev-page, docs, e2e, github, deploy

## Checks run

| Date | Command | Result |
|---|---|---|
| 13 Oct | `git check-ignore -v .env.local` | Ignored by `.gitignore` rule `.env.*` |
| 13 Oct | 29 manual probe calls to the live Qloo API | All HTTP 200 except two deliberate `take=300` tests (HTTP 400) |
| 13 Oct | `npm run build` | Pass (Next.js 15.5.27), last run in Phase 3 |
| 13 Oct | `npm run lint` | Pass (exit 0), re-run after Phase 7 |
| 13 Oct | `npm run typecheck` | Pass (exit 0), re-run after Phase 7 |
| 13 Oct | `npm test` | Pass: 10 files, 126 of 126 tests (no network), after Phase 7 |
| 13 Oct | `npm run qloo:check` | Pass 3 of 3 live calls (about 0.3 to 1.0 s each) |
| 13 Oct | `npm run test:live` | Pass: 5 of 5 live tests |
| 13 Oct | `npm run qloo:record` | Wrote private snapshot `.qloo-cache/snapshot.json` (90 calls, git-ignored) |
| 13 Oct | `npm run nisha` (live) | Completed in about 9 s, 30 live calls, winner: art print pop-up in Jayanagar (73.8, High confidence) |
| 13 Oct | `QLOO_MODE=recorded npm run nisha` | Completed from the snapshot, 30 recorded calls, same scores, confidence Medium |
| 13 Oct | `npm run nisha -- sample` | Completed on bundled sample data, confidence Low |

## Live Qloo status

Working with the key in `.env.local`. Limits: 10,000 calls per month, 5 per second, `take` max 50.
About 250 calls used so far (9,753 remaining). One full Nisha run costs 30 calls; repeats within
30 minutes are served from the in-memory cache.

## LLM status

Off (`LLM_PROVIDER=none`, no key). The LLM layer is covered by 17 tests with a mocked provider.
**No real Gemini call has been made yet**; that needs a free key in `.env.local`.

## Known issues

- `gh` (GitHub CLI) and Vercel CLI are not installed. Needed in Phase 12 (or use the websites).
- The parent folder `C:\Users\vaish` is a git repository; the project has its own, see DECISIONS D1.
- Node is 20.11.1; npm prints an EBADENGINE warning for one ESLint sub-package (wants 20.19+). Lint still passes. Vitest is pinned to v3 / Vite 6 for the same reason.
- `filter.tag.types` with several comma-separated types returned only `genre:place` tags in the live test; cross-domain taste tags would need one call per tag type.
- The top four options in the live Nisha run are within 3 points of each other; the winner leads mainly on a lower estimated stall fee, not on taste.
- Thrift has thin Qloo data in Bengaluru (one comparable place, no competitors found within 2 km), reflected as Medium confidence.
- The project is inside OneDrive; watch for slow or locked `node_modules`.
- Qloo terms forbid committing response data, so bundled fallback data is illustrative, see DECISIONS D2.
- Git Bash on this machine mangles here-documents that contain apostrophes; write files with the editor instead.

## Next steps

1. Phase 8: frontend screens (input, live workflow, recommendation, pilot plan, pilot results).
2. Phase 9 onwards: branding, /dev page, docs, full verification, GitHub, deployment prep.
