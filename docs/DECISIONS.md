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

## D21. LLM model failover (added after the first real Gemini call)
On 13 Oct the default model returned HTTP 503 ("high demand") and took 34 s before falling back
to templates. The client now tries `gemini-3.1-flash-lite` immediately when the default model is
overloaded, missing or slower than 10 s. A 429 is still retried with backoff on the same model;
a rejected key (401/403) stops at once. A model set explicitly in `LLM_MODEL` gets no fallback.

## D22. Scoring reworked so Qloo decides the answer (supersedes the cultural-fit and budget parts of D10)
**Why.** An ablation on 13 Oct showed that with Nisha's default inputs the top pick was the
same with or without Qloo's cultural signals: estimated stall fees decided the locality. That
fails the hackathon's own test ("if your submission would work the same without Qloo, you're
building the wrong thing").

**What changed.**
- `cultural_fit = 0.45·affinity + 0.35·locality lift + 0.20·resonance`.
  - **Locality lift** is new: the concept's mean affinity with this locality's audience minus its
    mean in the other localities compared. ±0.04 maps to 100 / 0, with 0 at 50. It answers
    "where", and only Qloo can supply it. With a single locality it is neutral (50).
  - The old "taste match" term is gone. It looked for the concept among the audience's top 50
    place genres, which are almost all food, so it penalised every non-food idea equally.
    Matching taste tags now count towards resonance and are still shown as evidence.
  - **Evidence shrinkage:** affinity and lift are pulled towards 50 when fewer than 5 comparable
    places support them (`50 + (raw − 50) × places/5`), so one lucky match cannot dominate.
- **Budget score** is 100 up to 85% of budget (was 60%). A cheaper plan is not a better plan, and
  this stops small differences between cost estimates from deciding the ranking.
- **Demand:** cultural fit now shifts expected sales by ±35% (was ±20%). This is an assumption.
- **Counterfactual:** every run re-scores the options with neutral cultural fit and no competitor
  data, and the app states whether Qloo changed the pick. It says so honestly when it did not.

**Result (live, Nisha).** With Qloo: art print pop-up in Koramangala, 78.1. Without Qloo's
signals: art print pop-up in Jayanagar. 4 of 9 rankings differ.

**Guard.** `tests/integration/qloo-matters.test.ts` fails if the recommendation stops following
the cultural signals.

## D23. Form controls ignore attributes added by browser extensions
Password managers add attributes such as `fdprocessedid` before React loads, which triggered a
hydration warning in development. Inputs, selects and buttons on the first screen now carry
`suppressHydrationWarning`. It affects attributes on those elements only.

## D24. The e2e test builds into `.next-e2e`
So `npm run test:e2e` works while `npm run dev` is open (both used to lock `.next`).

## D25. Launch modes reuse the same four agents
Solo, partner and both are one pipeline with mode-dependent steps, not three apps. Solo-mode
output is unchanged (guarded by tests); the partner work only runs when asked for.

## D26. Neighbourhoods come from Qloo's heatmap
"Suggest for me" used to return a fixed list (always Indiranagar, Koramangala, Jayanagar for
Bengaluru, and the whole city elsewhere). It now asks Qloo's `urn:heatmap` output for the
localities most associated with the idea's audience, drops administrative areas (city, zones,
districts), and analyses the top three. The fixed list is only a labelled fallback when Qloo
returns nothing. Heatmap affinity is shown as cultural affinity, never as demand or footfall.

## D27. One idea drives partner discovery
With several ideas selected, partner search uses the idea that best matches the product
description (or the first idea). Searching partners for every idea would triple Qloo calls.

## D28. Partner discovery uses three searches per locality, two of them new
1. Similar businesses: the existing competitor search (no extra call).
2. Complementary businesses: places in the locality ranked by affinity with the crowd of the
   area's similar businesses (`signal.interests.entities`), classified by venue type.
3. Hosts: the same signal restricted to mall, food court, co-working and community tags.
Venue types are classified per idea (`collab-profiles.ts`); clearly unsuitable types
(butchers, pharmacies, hotels, banks and so on) are dropped. Chain branches ("Brand - Area")
get a risk note and a small fit penalty because decisions are usually central.

## D29. Partner fit
- Similar: 0.45 audience affinity + 0.35 product similarity + 0.20 reputation.
- Complementary: 0.55 audience + 0.25 reputation + 0.20 category fit (lower if it already sells the product).
- Host: 0.45 audience + 0.35 potential visibility (popularity percentile and descriptive tags) + 0.20 reputation.
Up to six of each type are shown, plus the best two found through the admired business.

## D30. Collaboration costs are example assumptions the user can change
Consignment commission 25%, wholesale discount 40%, workshop venue share 30%, counter fee 60% of
the local stall estimate. The same pure function computes them on the server and in the browser
calculator. An option is rejected above 125% of budget or when each sale loses money, and
downgraded above 100% of budget or when it cannot break even within the pilot. Food ideas
always include the user's own registration, because a partner's licence does not cover them.

## D31. Price positioning
Qloo venue price levels (1 to 4) of the relevant local venues set a tier (budget, mid,
premium) that scales the idea's reference price, never below a cost floor with a 50% margin.
Venue price levels are described as typical spend at those venues, not product prices.

## D32. Solo vs partnership recommendation
Compares the solo winner's final score with the best collaboration option's score; within 3
points the cheaper start wins. Whichever side is unavailable loses. Reasons are shown.

## D33. Outreach messages are templates
Deterministic email and short-message templates with placeholders for the user's name and
contact. They never invent a contact person or claim interest, and the app never sends them.
The optional LLM is not used for them, to keep partner-facing text predictable.

## D34. Per-run Qloo call budget
`QLOO_RUN_CALL_BUDGET` (default 70) caps calls per run; refused calls are reported as a warning
and agents continue with what they have.

## D35. Premium UI pass: what was added and what was deliberately not
Palette (ivory, forest green, coral, lavender for AI-written text, sage), Fraunces for headlines
and Inter for body. Dependencies added: `motion` (transitions, reveals; `MotionConfig
reducedMotion="user"`) and `recharts` (bar charts, loaded with `next/dynamic` so the landing page
does not pay for it; first load of `/` is about 215 kB). The hero city is pure CSS 3D rather than
three.js or Spline: no WebGL, no extra download, no external scene. The locality "map" places
areas by their Qloo coordinates on a plain grid; it is labelled as not a street map, because the
app has no map provider. Every chart uses existing run data only and shows an empty state when a
value is missing; there is no chart of page views or sign-ups because the app does not record
them, and actual spend is not shown because it is not collected. Details on the recommendation
and Pitch & Pilot screens are collapsed by default and open automatically for printing.

## D36. Multi-page journey and dark mode
The single-screen app became five routes (landing, `/discover`, `/agents`, `/recommendation`,
`/plan`) so the landing page is not a form and browser back/refresh behave as expected. Run state
lives in one client `RunProvider` in the root layout (no state library); the finished run and the
form draft are kept in `sessionStorage`, so navigation never starts a second run or spends extra
Qloo calls. Pages without a run show an empty state that links to `/discover`. The recommendation
page leads with one summary card; the evidence sits in five collapsed sections. Agent cards are
plain language first; Qloo parameters and call logs sit behind "View technical details".
Dark mode uses a `data-theme` attribute on `<html>` set by a tiny inline head script (stored
choice, else the system preference), so there is no flash of the wrong theme; colours are CSS
variables overridden under `[data-theme="dark"]`. Brand-coloured surfaces that carry white text
use a `hero` token that stays dark in both themes. Charts read the theme for their SVG text colours.

## D37. Pastel palette and cursor effects
The forest-green and coral palette was replaced by pastels (lavender, peach, mint, sky, pink)
at the team's request. Pastels are too light to carry text, so a deep violet (#5b4bc4, 6.3:1 on
white) is used for text, buttons and links, and a darker pink (#b8365f) for small highlight
text; token names did not change, so components follow automatically. Pages sit on a slowly
drifting pastel mesh (one CSS pseudo-element). Pointer effects live in one client component
(`cursor-effects.tsx`): a colour-shifting glow behind the content, a light sparkle trail, a ring
that grows over clickable things, magnetic buttons that wiggle on arrival, confetti on clicks,
and cards that tilt toward the pointer. They run only for a mouse or trackpad and never with
prefers-reduced-motion; the native cursor is never hidden, the layers ignore pointer events,
and one animation frame loop runs only while something is moving. Logos and icons were
recoloured to match. e2e screenshots are written after the tests finish, because writing into
the project during a `next dev` run triggered a Fast Refresh rebuild that stalled a reload.

## D38. Aurora theme, professional pointer effects and a real map
Replaces D37's pastel look at the team's request, matching a reference design: a near-black
canvas lit by teal and violet glows, white headings in Plus Jakarta Sans, a lavender-to-sky
gradient highlight, white pill buttons and violet glass cards. Dark is the default on first
visit (the storage key moved to `c2c:theme-v2` so old choices do not carry over); light mode
stays available through the toggle. The landing hero is now a centred headline with a product
preview (an example report and floating stat cards, labelled illustrative) instead of the CSS
city. Pointer effects were reduced to what B2B product sites use: a spotlight revealing a faint
dot grid around the cursor, card edges and surfaces that light up under the pointer, and buttons
that lean a few pixels toward it; sparkles, confetti, the cursor ring, wiggles and tilts were
removed. The locality "map" is now a real Leaflet street map: standard OpenStreetMap tiles (free,
no key, attribution shown; CARTO tiles were tried but now require a key), recoloured by a CSS
filter in dark mode. Pins sit at Qloo's coordinates with the 2 km competitor radius drawn around
each; clicking a pin selects the area. No Qloo calls were added. Logos and icons were redrawn
as a gradient tile with a dark market-stall glyph.
