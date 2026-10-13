# Decisions

Routine and architectural choices, newest last. Each entry: what, why.

## D1. Project gets its own git repository
The user folder `C:\Users\vaish` is itself a git repository. We ran `git init` inside
`culture2commerce` so nothing outside the project can be committed. The outer repository was not touched.

## D2. No real Qloo responses in the repository (changes the original brief)
The brief asked for recorded Qloo fixtures to be committed. Qloo's hackathon guide says:
do not store Qloo response data in a public repository. Private server-side caching is allowed.

- `npm run qloo:record` writes real snapshots to `.qloo-cache/` (git-ignored, private).
- The repository ships `src/server/qloo/sample/`: a small **hand-written illustrative dataset**
  in the same internal shape, clearly labelled as not Qloo data.
- Data source labels are therefore `live`, `recorded` (private local snapshot) and `sample`
  (bundled illustrative data), alongside `estimate`, `llm` and `template`.
- Fallback order per call: live, then recorded snapshot if present, then sample.
- Neither `recorded` nor `sample` can produce High confidence.

## D3. `qloo-docs/` is git-ignored
The PDF is Qloo's own documentation. The README links to the official page instead.

## D4. Anchor-venue method for locality taste
Locality-level `signal.location.query` returns nothing for Bengaluru localities, so the
Local Researcher fetches each locality's top places and later calls use those places as
`signal.interests.entities`. See `QLOO_FINDINGS.md` sections 4 and 5.

## D5. Stack
Next.js App Router, TypeScript, Tailwind CSS, Zod, Vitest, Playwright (one smoke test if
browsers install), ESLint. In-memory run storage. MIT license. Deploy target Vercel Hobby.

## D6. Scoring is deterministic
`final = 0.45·cultural_fit + 0.35·feasibility + 0.20·risk_adjustment`, every sub-score 0 to 100.
Weights shift slightly with the user's risk preference and are shown in the UI. No LLM is involved.

## D7. Client-side throttle
Qloo allows 5 calls per second. The live client limits itself to 4 per second and caches
responses in memory for 30 minutes.

## D8. Project lives in a OneDrive folder
Kept where the user created it. If file locking slows installs, we will document moving it.

## D9. Versions pinned for Node 20.11
Next.js 15, Vitest 3 and Vite 6. Newer Vite/Vitest majors need Node 20.19 or later.

## D10. Scoring formulas (all in `src/server/scoring.ts`)
- `cultural_fit = 0.60·affinity + 0.25·taste + 0.15·resonance`
  - affinity: mean raw Qloo affinity of the top 5 concept-type places for the locality's anchor
    audience, rescaled linearly from 0.70..0.98 to 0..100 (the raw value is always shown).
  - taste: best affinity among the audience's top 50 over-indexed place genres that match the
    concept; 40 if none match.
  - resonance: matching brand, vibe-tag and anchor-venue signals; 4 or more = 100.
- `feasibility = 0.50·budget + 0.20·competition + 0.15·logistics + 0.15·permits`
- `risk_adjustment = 0.40·recoverability + 0.40·break-even + 0.20·skill match`
- `final = w1·cultural_fit + w2·feasibility + w3·risk_adjustment`, weights by risk preference:
  low 0.40/0.35/0.25, medium 0.45/0.35/0.20, high 0.55/0.30/0.15.

## D11. Verdicts
Cost above 100% of budget: downgraded (final × 0.85). Above 125%: rejected (final × 0.5, always
ranked last, never the winner). The reason names the two largest cost lines.

## D12. Confidence is a points system about data quality
Live Qloo data +3 (recorded +1, sample 0), locality-level +2, 5 or more comparable places +1,
a second agreeing signal +1, competitors observed +1, lead of 3 or more points +1, costs are
estimates -1 (generic estimates -2). 7 or more = High, 4 to 6 = Medium, otherwise Low.
Hard caps: any recorded data caps at Medium; any sample or neutral data forces Low.

## D13. Continue rule = running costs recovered
"Continue" when revenue covers the pilot's running cost (total minus reusable equipment);
"pivot" at half of that; otherwise "stop". This matches the reference example in the brief.

## D14. Vibe tags are ranked by distinctiveness
Raw tag counts were dominated by generic tags ("City center", "Walkable") in every locality.
Tags are now ranked by how much more common they are in one locality than in the others compared.

## D15. Fixed concept catalogue
Seven concepts with verified Qloo tag IDs and illustrative cost models
(`src/server/data/concepts.ts`). Free-text concepts are not supported: without verified tags
and a cost model the agents would have to guess.

## D16. Keyword matching is word-start based with excludes
"art" must not match "party" or "Martial arts school"; "design" was removed because it matched
"Designer clothing store".

## D17. LLM: Gemini free tier, wording only
Verified on 13 Oct 2026 from ai.google.dev: OpenAI-compatible base URL
`https://generativelanguage.googleapis.com/v1beta/openai/` (path `chat/completions`, bearer key)
and free-tier model `gemini-3.5-flash-lite`. One call per run, cached. The reply is validated
with Zod and discarded if it contains any number not present in the computed facts or drops the
recommended locality. Only aggregate facts are sent (city, concept, scores); no personal data.

## D18. Streaming format is NDJSON over fetch, not EventSource
The run needs a POST body, which EventSource cannot send. `POST /api/run` returns
newline-delimited JSON: one message per agent event, then the result. `?stream=0` returns plain JSON.

## D19. Per-client rate limit on the run endpoint
12 runs per 10 minutes per IP (in memory), to protect the shared Qloo quota on a public deployment.

## D20. Line endings
`.gitattributes` normalises text files to LF to avoid CRLF warnings on Windows.
