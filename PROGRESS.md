# Progress

To resume in a new session, say: **"continue from PROGRESS.md"**.

## Current state

- **Date:** 15 Oct 2026
- **Last completed work:** Phase 2 enhancement (partner discovery, launch modes, neighbourhood
  heatmap, collaboration models, pricing, comparison, outreach). Pushed to
  https://github.com/Vaishhnavi27Hub/culture2commerce (`main`).
- **Next:** team review, then Vercel deployment (needs the user's confirmation and login).
- **Waiting on the user:** team review; repo description and topics; make the repo public before submission; record the video.

## Features by status

See `docs/features.json` (single source of truth; `node scripts/progress.mjs list` prints it).

- **Tested (automated tests passed):** scaffold, Qloo live client and fallback, all four agents,
  orchestrator, scoring and confidence, LLM layer, run API, all original UI features (e2e),
  launch modes, neighbourhood discovery, product description, admired business, partner
  discovery, collaboration models, solo vs partner comparison, price positioning, outreach,
  per-run call budget.
- **Implemented (checked by hand or by running):** environment setup, Qloo discovery, Qloo
  scripts, branding, /dev page, docs, GitHub.
- **UI upgrade (17 Oct):** new design system, CSS 3D landing hero, idea search and category
  filters, locality map and comparison chart, cultural affinity and budget charts, simplified
  Pitch & Pilot with progressive disclosure, pilot results dashboard. See DECISIONS D35.
- **Pending:** deployment.

## Checks run (latest results)

| Date | Command | Result |
|---|---|---|
| 15 Oct | `npm run lint` | Pass (exit 0, no warnings) |
| 15 Oct | `npm run typecheck` | Pass (exit 0) |
| 15 Oct | `npm test` | Pass: 13 files, 201 of 201 tests, no network |
| 15 Oct | `npm run test:e2e` | Pass: 2 of 2 (Nisha flow; partner example with outreach) |
| 15 Oct | `npm run test:live` | Pass: 5 of 5 |
| 15 Oct | `npm run qloo:check` | Pass: 3 of 3 live calls |
| 15 Oct | `npm run build` with no Qloo key and LLM off | Pass |
| 15 Oct | `npm run qloo:record` | 110 calls into the private snapshot, now including the partner example |
| 15 Oct | Partner example from the recorded snapshot | Completed; 30 of 30 calls served from the snapshot |
| 15 Oct | Partner example, live, in the browser (by hand) | Completed in about 30 s; comparison, partners, calculator, pricing, neighbourhoods and partner plan rendered; no console errors |
| 15 Oct | Phone width 375 px (by hand) | No horizontal overflow on input, recommendation or plan screens |
| 15 Oct | About 20 controlled Qloo probe calls | Recorded in `docs/QLOO_FINDINGS.md` section 10 |

## Live Qloo status

Working. Limits: 10,000 calls per month, 5 per second, `take` max 50. **9,173 calls left** this
month (counter read on 15 Oct). A full run costs about 30 calls; runs are capped by
`QLOO_RUN_CALL_BUDGET` (default 70) and repeats within 30 minutes are cached. Neighbourhood
heatmap responses are about 5 MB and take about 12 s.

## LLM status

On in `.env.local` (Gemini free tier, `gemini-3.5-flash-lite` with fallback to
`gemini-3.1-flash-lite`). One real call succeeded on 13 Oct. Outreach messages deliberately do
not use the LLM (templates only, DECISIONS D33).

## Known issues and honest caveats

- **Not done:** Vercel deployment (deferred by the user until the team review), making the repository public.
- Collaboration terms (commission, fees, wholesale discount) are example assumptions; the user can change them in the app.
- For food ideas, the one-time food registration (about ₹2,000, an estimate) dominates small pilots, so consignment often does not break even within a 2-weekend pilot. This is shown, not hidden.
- In the live brownie run the recommended partnership (wholesale) only breaks even at the default assumptions.
- Partner discovery runs for one idea per run (the one matching the product description, else the first selected idea).
- Chain detection is a name heuristic ("Brand - Area"); it can flag small multi-branch businesses too.
- "Similar" businesses are found through the competitor search and the admired business; Qloo affinity is not measured for the competitor-search ones (shown as "not measured").
- Qloo search for the admired business is global; results are filtered by city, and other-city matches are listed rather than used.
- The live top options are close; lifts and affinities are small in absolute terms. The app shows raw values.
- All costs, footfall and permit notes are illustrative estimates, not verified.
- Node is 20.11.1; npm prints EBADENGINE warnings for some dev packages. Everything runs.
- Git Bash on this machine mangles here-documents with apostrophes; write files with the editor.
- The in-memory rate limit and run storage reset on each serverless cold start on Vercel.

## Next steps

1. Team review of the new partner features.
2. Deploy to Vercel Hobby after the user confirms; add `QLOO_API_KEY` (and optional `LLM_*`, `QLOO_RUN_CALL_BUDGET`) in the dashboard.
3. Before submission: make the repo public, record the video (scripts in `docs/`), fill the links in `docs/DEVPOST_DESCRIPTION.md`.
