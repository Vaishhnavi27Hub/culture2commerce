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
