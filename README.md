<p align="center">
  <img src="public/brand/logo-vky.svg" alt="Culture2Commerce logo" width="96" height="96">
</p>

<h1 align="center">Culture2Commerce</h1>

<p align="center"><strong>Find one small business bet worth testing.</strong><br>
An AI agent that uses Qloo's taste graph to tell first-time founders what to sell, where, and how to test it cheaply.</p>

<p align="center">Built by <strong>Team VKY</strong> (Vaishhnavi, Khushi, Yashi) for the Qloo Agentic Hackathon</p>

---

## Why we built this

Lots of students and first-time founders have a small budget (₹10,000–₹20,000) and a few ideas: a weekend stall, a pop-up, a workshop. They don't know which idea to pick, which neighbourhood to try, or whether they can even afford it.

Ask a chatbot and you get pros and cons for everything, ending in "it depends". We wanted a real answer instead.

## What it does

You tell Culture2Commerce your city, budget, time and ideas. It comes back with **one specific bet**:

> **what to sell + where + for whom + a small pilot to test it**

To get there, it checks three things:

- **Cultural fit:** Qloo shows which ideas the people in each neighbourhood are likely to love.
- **Feasibility:** costs, competition and logistics are checked against your budget. Ideas that don't fit are rejected, and you see why.
- **Validation:** the winning idea becomes a low-cost pilot with a clear rule: continue, pivot or stop.

### Can't afford a stall? Partner with a business

The first question is **"How do you want to start?"**

- **On my own:** a stall, pop-up or workshop.
- **With an existing business:** the app finds bakeries, cafés, food courts and other places worth approaching. It compares partnership formats (consignment shelf, weekend counter, co-hosted workshop, wholesale supply) and writes an email and a WhatsApp message for you to send.
- **Show me both:** a side-by-side comparison, and the numbers decide.

You can also describe your product ("eggless brownies") and name a business you admire. Qloo uses both to find better matches.

## Try it in one click

- **Try Nisha's example:** a student in Bengaluru with ₹15,000 and two weekends, choosing between a thrift stall, art prints and a coffee pop-up.
- **Try the partner example:** homemade eggless brownies, ₹10,000, no stall. See the solo-vs-partner comparison, the partners Qloo finds, and ready-to-send outreach drafts.

## Screenshots

| Landing | Your idea |
|---|---|
| ![Landing page](docs/screenshots/0-landing.png) | ![Input screen](docs/screenshots/1-input.png) |

| Agents at work | Recommendation |
|---|---|
| ![Agent workflow](docs/screenshots/2-agents.png) | ![Recommendation](docs/screenshots/3-recommendation.png) |

| Partners | Launch plan |
|---|---|
| ![Partners](docs/screenshots/5-partners.png) | ![Partner plan](docs/screenshots/6-partner-plan.png) |

_Screenshots use the bundled sample data. With a Qloo key, you see real Qloo places and scores._

## Four agents, one hand-off chain

| Agent | Job | Uses Qloo |
|---|---|---|
| **Local Researcher** | Ranks neighbourhoods for your idea, then profiles each one's popular places, competitors, stall fees and possible partners. | ✅ |
| **Cultural Opportunity Finder** | Scores how well each idea fits each area's audience, and how well each partner fits your product. | ✅ |
| **Feasibility Critic** | Costs every option against your budget and rejects what doesn't fit or break even. | — |
| **Pilot Planner** | Turns the winner into a step-by-step pilot: budget, timeline, success rule and outreach drafts. | — |

Each agent hands its findings to the next, and you can watch every step live in the app.

## How we use Qloo

Qloo is where every cultural signal comes from. Our key idea: **the most popular places in a neighbourhood represent the people who spend time there.** We send those places back to Qloo as the taste signal and ask how much that crowd would like each idea.

We use Qloo to:

- rank a city's neighbourhoods for an idea (heatmap)
- find the popular places and existing competitors in each area
- measure how well an idea fits the local crowd, plus the tastes, brands and age groups they lean towards
- turn product words like "eggless brownies" into Qloo tags (*Brownie*, *Egg free*)
- find businesses with a crowd similar to one you admire

A typical run makes about 30 Qloo calls. What worked, what didn't, and how we adapted: [docs/QLOO_FINDINGS.md](docs/QLOO_FINDINGS.md).

## Does Qloo actually change the answer?

We built the app to prove it.

- **Transparent scoring:** `final = w1 · cultural_fit + w2 · feasibility + w3 · risk_adjustment`. The weights depend on how much risk you're comfortable with, and every sub-score is shown. The same inputs and data always give the same score.
- **No AI guesswork in the numbers:** no language model touches any score, ranking or decision.
- **A with-vs-without-Qloo check on every run:** each result is re-scored with Qloo's signals removed, and the app tells you whether the pick changed. In our live run of Nisha's example (13 Oct 2026), Qloo moved the pick from Jayanagar (cheapest stall) to Koramangala (strongest pull for art). Live data changes, so your run may differ.
- **A test that keeps us honest:** `tests/integration/qloo-matters.test.ts` fails if the recommendation stops following Qloo's signals.
- **No fake accuracy:** you can't measure success before a pilot runs. Instead, the app shows a **confidence level** (High / Medium / Low) based on data quality, with the reasons listed.

More on our design choices: [docs/DECISIONS.md](docs/DECISIONS.md)

## Run it locally

You'll need Node.js 20 or later.

```bash
npm install
cp .env.example .env.local   # then paste your Qloo key after QLOO_API_KEY=
npm run dev
```

Open http://localhost:3000 and click **Try Nisha's example**.

**No key?** The app still runs on bundled sample data and clearly says so.

### Honest data labels

Every Qloo-based value is labelled:

- **Live Qloo data:** fetched during this run.
- **Recorded Qloo snapshot:** real Qloo data saved earlier on your machine (`npm run qloo:record`), used if the live API fails.
- **Sample data, not Qloo:** hand-written demo data, used with no key.

Qloo's hackathon rules don't allow storing their data in a public repo. So snapshots stay in a git-ignored folder, and the repo only ships invented sample venues marked "(sample)". Rent, stall fees and footfall are illustrative estimates and are always labelled as such.

### Optional: nicer explanations with Gemini

The app works fully without an LLM, and it's off by default. To turn it on, add a free Google Gemini key to `.env.local`:

```bash
LLM_PROVIDER=gemini
LLM_API_KEY=your-key-here
```

Gemini only rewrites the explanation text. Any reply containing a number that wasn't in the computed facts is thrown away, and the app falls back to templates if Gemini is unavailable. Outreach messages always use templates.

## Tests

```bash
npm test            # unit, contract and integration tests (202)
npm run test:e2e    # full user journeys in Playwright
```

## Architecture

![Architecture diagram](docs/architecture.svg)

Details and agent contracts: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Built with

Next.js · TypeScript · Tailwind CSS · Qloo Insights API · Zod · Recharts · Leaflet / OpenStreetMap · Vitest · Playwright · Google Gemini (optional)

## Team VKY

**Vaishhnavi · Khushi · Yashi**

---

_Estimates are for planning only and are not financial or legal advice. Please verify costs and permits locally._

Licensed under [MIT](LICENSE).
