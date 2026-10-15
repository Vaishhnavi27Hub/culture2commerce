# Devpost submission text

**Project name:** Culture2Commerce

**Tagline:** Find one small business bet worth testing, grounded in Qloo's taste graph.

**Team VKY:** Vaishhnavi, Khushi, Yashi

---

## Inspiration

Many students and first-time entrepreneurs have a small budget, a free weekend and several
half-formed ideas: a thrift stall, art prints, a coffee pop-up. Asking a general AI assistant
which one to try returns a tidy list of pros and cons and the conclusion "it depends on your
audience and location". That is exactly the part they cannot answer alone. Enterprise tools
that do answer it are built for retail chains, not for someone with ₹15,000.

## What it does

Culture2Commerce is a micro-business opportunity discovery agent. You give it a city, a
budget, a duration, your interests and a few candidate ideas. It returns one specific bet:

**a concept + a locality + a target audience + a pilot experiment.**

Four agents do the work, and you watch them live:

1. **Local Researcher** finds candidate areas, their most popular venues, existing competitors,
   stall fees and permit notes.
2. **Cultural Opportunity Finder** uses Qloo affinities to test how well each idea fits the
   people who spend time in each area.
3. **Feasibility Critic** costs every option against the budget and downgrades or rejects the
   ones that do not fit, with reasons.
4. **Pilot Planner** turns the winner into quantities, prices, a schedule, a budget and a
   measurable continue / pivot / stop rule.

It can also start **with an existing business** instead of a stall. Qloo finds similar
businesses, complementary ones (cafés whose crowd likes the local bakeries but which don't bake)
and potential high-visibility hosts, plus places with a crowd like a business the user admires.
The agents cost consignment, counter, workshop and wholesale formats, compare going solo with
partnering, and draft an outreach email and WhatsApp message.

The app also shows a "Without Qloo vs With Qloo" comparison, a locality comparison, a full
evidence trail, a transparent score, a confidence level with reasons, exports, and a form to
report pilot results and see predicted versus actual.

## How we used Qloo

Qloo supplies every cultural signal. We found that location-as-signal returns nothing at
neighbourhood level in Bengaluru, so we designed an **anchor-venue method**: fetch a
locality's most popular places from the Insights API, then send those places back as
`signal.interests.entities`. From that one idea we get, per locality:

- affinity of concept-type places (art galleries, thrift stores, coffee shops) to the local audience,
- the place genres that audience over-indexes on,
- cross-domain brand affinities,
- demographic skews for the target audience,
- existing competitors within 2 km, from tag and location filters,
- a **locality lift**: how much more one area's audience likes a concept than the others compared.

One run of the demo scenario makes 30 live Qloo calls across `/v2/insights` (places, tags,
brands, demographics), with `/v2/tags` and `/search` used to verify tag and entity IDs.
Every signal shown in the app is labelled with its source and raw affinity value.

## How we built it

Next.js (App Router), TypeScript and Tailwind CSS in one repository. Each agent is a typed
function validated with Zod. An orchestrator runs them in order, streams events to the
browser as newline-delimited JSON, and isolates failures so one agent cannot crash a run.

The Qloo layer is a single interface with three implementations: the live API (timeout,
retries, a 4-calls-per-second throttle, caching), a private recorded snapshot and a bundled
sample dataset. Fallback is per call and always labelled.

Scoring is deterministic: `final = w1·cultural_fit + w2·feasibility + w3·risk_adjustment`.
An optional free LLM (Gemini) may polish wording only; its output is rejected if it contains
any number that the scoring did not produce.

## Challenges

- **Data reality.** Locality-level location signals were empty and tag-interest signals were
  flat, so our first design did not work. Small probe calls led us to the anchor-venue method.
- **Honesty about uncertainty.** There is no ground truth before a pilot runs, so we show a
  confidence level built from data quality instead of an accuracy number.
- **Qloo's data terms.** Response data may not be published, so real snapshots stay in a
  git-ignored folder and the repository ships hand-written sample data instead.
- **Generic vibe tags.** Raw tag counts said every area was "central" and "walkable". Ranking
  tags by how distinctive they are to each locality fixed that.

## Accomplishments

- A complete product, from input to a tested verdict, that always runs: live, recorded or sample.
- A recommendation that Qloo actually decides. Every run is re-scored with Qloo's signals
  removed; in our live demo that changes the pick from the cheapest locality to the one where
  art places resonate most. Coffee had the highest cultural fit and was still rejected on cost.
- 201 automated tests plus two end-to-end browser tests, none of which spend API quota.

## What we learned

Taste data becomes far more useful when you pick the right entities to use as the signal.
And an agent earns trust by showing its evidence, its formula and its doubts.

## What's next

- More cities with locality-level cost estimates, ideally verified with real organisers.
- Feeding reported pilot results back in to calibrate the predictions.
- Cross-domain taste tags (music, fashion, media) to shape product mix and stall styling.

## Built with

Qloo Insights API, Next.js, TypeScript, Tailwind CSS, Zod, Vitest, Playwright, Vercel,
and optionally the Google Gemini API free tier.

## Links

- Demo: _add the deployed URL_
- Code: _add the public GitHub URL_
- Video: _add the video URL_
