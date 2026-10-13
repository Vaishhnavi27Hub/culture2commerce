# Progress

To resume in a new session, say: **"continue from PROGRESS.md"**.

## Current state

- **Date:** 13 Oct 2026
- **Last completed phase:** Phase 12 (GitHub): `main` pushed to https://github.com/Vaishhnavi27Hub/culture2commerce (private)
- **Next phase:** Phase 13 (Vercel deployment). Needs the user's confirmation and login.
- **Waiting on the user:** team review; then deployment. Repo description and topics; make the repo public before submission.

## Features by status

See `docs/features.json` (single source of truth; `node scripts/progress.mjs list` prints it).

- Tested (automated tests passed): scaffold, qloo-live-client, qloo-fallback, all four agents, orchestrator, scoring-confidence, llm-layer, api-run-stream, e2e, and all seven UI features (via the Playwright smoke test)
- Implemented (checked by hand or by running): env-setup, qloo-discovery, qloo-scripts, branding, dev-page, docs
- Implemented: github (pushed, private)
- Pending: deploy

## Checks run (latest results, all on 13 Oct 2026)

| Command | Result |
|---|---|
| `npm run lint` | Pass (exit 0, no warnings) |
| `npm run typecheck` | Pass (exit 0) |
| `npm test` | Pass: 11 files, 142 of 142 tests, no network (after the scoring rework, D22) |
| `npm run test:e2e` | Pass: 1 of 1, re-run after D22 (now builds into `.next-e2e`, so it works while `npm run dev` is open) |
| `npm run qloo:check` | Pass: 3 of 3 live calls (295 to 1,242 ms) |
| `npm run test:live` | Pass: 5 of 5 live tests (run in Phase 4) |
| `npm run build` with `QLOO_API_KEY` empty and `LLM_PROVIDER=none` | Pass (Next.js 15.5.27) |
| `npm run nisha` (live, after D22) | Completed in 9.0 s, 30 live calls, no fallbacks. Winner: art print pop-up in Koramangala, 78.1/100, High confidence. Without Qloo signals the pick would be Jayanagar; 4 of 9 ranks differ |
| `QLOO_MODE=recorded npm run nisha` | Completed from the private snapshot, 30 recorded calls, confidence Medium (run in Phase 5) |
| `npm run nisha -- sample` | Completed on bundled sample data, confidence Low |
| `npm run qloo:record` | Wrote `.qloo-cache/snapshot.json` (90 calls, git-ignored) |
| Browser, live mode (by hand) | Nisha flow streamed all four agents live with 30 live calls; recommendation, pilot plan and results form worked; no console errors |
| Browser, 375 px wide (by hand) | No horizontal overflow on any of the four screens |
| Secret scan | Key absent from every commit, from `.next/static` and from the snapshot; `.env.local`, `.qloo-cache/` and `.dev-status/` are untracked |

## Live Qloo status

Working with the key in `.env.local`. Limits: 10,000 calls per month, 5 per second, `take` max 50.
About 310 calls used so far (9,690 remaining). One full Nisha run costs 30 calls; repeats within
30 minutes are served from the in-memory cache.

## LLM status

On in `.env.local` (`LLM_PROVIDER=gemini`, free-tier key). **One real Gemini call succeeded on 13 Oct**:
`QLOO_MODE=recorded npm run nisha` returned an LLM-written narrative in 11.8 s with every number
unchanged (it passed the number guard). An earlier attempt got HTTP 503 from `gemini-3.5-flash-lite`
(overloaded, 34 s) and correctly fell back to template text; the client now fails over to
`gemini-3.1-flash-lite` and uses a 10 s timeout. 21 LLM tests run against a mocked provider.

## Known issues and honest caveats

- **Not done:** Vercel deployment (Phase 13, deferred by the user until the team has reviewed), making the repository public.
- Gemini free-tier models can be slow or overloaded; with the LLM on, a run can take up to about 12 s longer. Template text is used if both models fail.
- `gh` (GitHub CLI) and Vercel CLI are not installed.
- **Fixed (D22):** the pick used to be the same with or without Qloo. Qloo now decides the locality, and every run reports a without-Qloo counterfactual.
- Still true: the lead is narrow (about 2 points) and locality lifts are small in absolute terms (hundredths of an affinity point). The app shows the raw values.
- After D22: lint, typecheck, unit tests, e2e, build and one live run were re-run. `test:live` and `qloo:check` were not (the Qloo client itself did not change). The changed screens were rendered by the e2e test without errors but not inspected by hand.
- Thrift has thin Qloo data in Bengaluru (one comparable place, no competitors within 2 km), shown as Medium confidence.
- Some Qloo evidence names are long listing titles (for example a shop name followed by keywords). They are shown as returned.
- All costs, footfall, venue types and permit notes are illustrative estimates, not verified.
- README screenshots show sample data (venues marked "(sample)") on purpose, to avoid publishing Qloo response data.
- The fallback for a public repository is hand-written sample data, not recorded Qloo fixtures (DECISIONS D2).
- `filter.tag.types` with several types returned only `genre:place` tags; cross-domain taste tags are not used yet.
- Live results can change between runs as Qloo data changes; scores in the docs are from 13 Oct.
- Node is 20.11.1; npm prints EBADENGINE warnings for some dev packages that prefer 20.19+. Everything runs.
- The parent folder `C:\Users\vaish` is itself a git repository (untouched); the project has its own.
- The project is inside OneDrive; no problems so far.
- Git Bash on this machine mangles here-documents containing apostrophes; write files with the editor.
- The in-memory rate limit and run storage reset on each serverless cold start on Vercel.

## Next steps

1. Phase 13: deploy to Vercel Hobby after the user confirms; add `QLOO_API_KEY` in the dashboard; verify the live URL.
2. Before submission: make the repository public, record the video, fill the links in `docs/DEVPOST_DESCRIPTION.md`.
