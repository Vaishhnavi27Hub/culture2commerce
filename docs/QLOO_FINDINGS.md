# Qloo API findings (India / Bengaluru reality check)

Date: 13 Oct 2026. Base URL: `https://hackathon.api.qloo.com`. Auth: `X-Api-Key` header.
All findings below come from **29 real probe calls** made in this session (monthly counter went 10,000 → 9,971).

> Excerpts here are deliberately tiny (a few names and scores). Qloo's hackathon guide says
> response data must not be stored in a public repository, so no raw responses are committed.

## 1. Quota and limits (from response headers)

| Header | Value |
|---|---|
| `x-month-ratelimit-limit` | 10,000 calls / month |
| `x-second-ratelimit-limit` | 5 calls / second |
| `take` maximum | 50 (a request with `take=300` returned HTTP 400) |

Responses are large: 8 places is roughly 190 KB because each place carries hundreds of tags.
We therefore trim immediately after validation and cache in memory.

## 2. Endpoints verified

| Endpoint | Works | Notes |
|---|---|---|
| `GET /search?query=&types=&take=` | Yes | Returns `results[]` with `entity_id`, `types`, `location`, `popularity`. Locality names are ambiguous (five "Indiranagar"s across India), so we always append the city. |
| `GET /v2/tags?filter.query=&take=` | Yes | Returns `results.tags[]` with `id`, `name`, `type`. One word maps to many tag families (`genre:place`, `category:place`, `offerings:place`, ...). |
| `GET /v2/insights` | Yes | Shape depends on `filter.type`: `results.entities[]`, `results.tags[]` or `results.demographics[]`. `query.localities` echoes how a location string was resolved. |

Invalid parameters are silently ignored and yield `200` with an empty list, exactly as the guide warns.

## 3. Reality check by locality

`filter.type=urn:entity:place` with `filter.location.query="<locality>, Bengaluru"`:

| Locality | Resolved to | Place results | Flavour of the top results |
|---|---|---|---|
| Indiranagar | Indiranagar 2nd Stage | Yes | brewpub, cocktail bars, nightlife |
| Koramangala | Koramangala | Yes | cocktail bar, cafe, brewpub |
| Jayanagar | Jayanagar 4th Block | Yes | Hyderabadi and South Indian food, book store, shopping complex |
| HSR Layout | HSR Layout | Yes | Indian restaurants, bar and grill, cinema |
| Malleshwaram | Malleswaram | Yes | temple, malls, palace museum, heritage hotel |

**Places exist for all five localities, and they clearly differ.** Each place carries rating,
neighbourhood, coordinates, a primary genre and rich tags (ambience, audience, visit intent).

## 4. What works and what does not

| Question | Call | Result |
|---|---|---|
| Brands / artists / tags a **city** over-indexes on | `signal.location.query=Bengaluru` with `filter.type` brand, artist or tag | Works, but every top affinity is `1.000` (saturated, little ranking value). |
| The same at **locality** level | `signal.location.query="Indiranagar, Bengaluru"` | **Empty.** Location-as-signal has no locality-level data here. |
| Places ranked by a tag interest | `signal.interests.tags=<tag>` + locality filter | Returns a flat `0.765` affinity for unrelated places. **Not useful.** |
| Taste of a locality's audience | `filter.type=urn:tag` + `signal.interests.entities=<top local places>` | **Works well.** Graded affinities across food, music, fashion, style and audience tags. |
| Brand affinity of that audience | `filter.type=urn:entity:brand` + the same anchors | **Works well.** Indiranagar anchors returned indie fashion and design brands at 0.97 to 0.99. |
| Demographics of that audience | `filter.type=urn:demographics` + the same anchors | **Works.** Age-band and gender skews per anchor place. |
| Concept fit for an audience | `filter.type=urn:entity:place` + anchors as signal + `filter.tags=<concept tag>` + city filter | **Works.** Graded and locality-dependent: art-gallery places scored 0.83 to 0.95 for Indiranagar anchors and 0.85 to 0.94 for Jayanagar anchors, in a different order. |
| Competitor density | `filter.tags=<concept tag>` + `filter.location=POINT(lon lat)` + radius | Works. Coffee near Indiranagar returned many cafes; `thrift_store` within 2 km returned **none**. |
| Asking for specific tags' affinity | `filter.type=urn:tag` + `filter.tags=...` | Empty. Not supported. |

## 5. How the design adapted

1. **"Anchor venue" method replaces location-as-signal.** Because locality-level location
   signals are empty, the Local Researcher first fetches a locality's top places, then uses
   those places as the taste signal for every later call. This is locality-level and real.
2. **Cultural fit uses place affinity, not tag affinity.** For each concept and locality we ask
   Qloo how strongly places of that concept type resonate with the locality's anchor audience.
3. **Differences between localities are real but modest** (a few hundredths of affinity).
   Scoring normalises across the localities being compared and the UI shows raw values, so
   nothing is exaggerated.
4. **Empty competitor results lower confidence.** Zero thrift stores may mean an open gap or
   missing data; the app says so rather than calling it an opportunity outright.
5. **One concept maps to several tags** (for example thrift: thrift store, vintage clothing).
   A curated concept catalogue holds the tag IDs, verified through `/v2/tags`.
6. **Call budget per run:** about 4 calls per locality plus 2 per concept per locality.
   Nisha's scenario (3 localities, 3 concepts) is about 30 calls, throttled to 4 per second
   and cached, well inside the quota.

## 6. Open questions to revisit in Phase 4

- Best tag set for thrift, art prints, board games and workshops.
- Whether `filter.location.radius` behaves the same with `filter.location.query`.

## 7. Phase 4 follow-up (live tests, 13 Oct)

- `operator.filter.tags=union` with two tag IDs returns results (coffee shop OR cafe).
- `filter.tag.types` given three comma-separated types returned only `urn:tag:genre:place`
  tags. To get music or brand-genre tags we make one call per tag type.
- `npm run qloo:check` passed 3 of 3; `npm run test:live` passed 5 of 5.

## 8. First full live run of Nisha's scenario (13 Oct)

Command: `npm run nisha`. Result: completed in about 9 seconds with **30 live Qloo calls**
(12 by the Local Researcher, 18 by the Cultural Opportunity Finder) and no fallbacks.

- Anchor venues differed clearly: brewpubs and bars in Indiranagar and Koramangala; food,
  a shopping complex and a book store in Jayanagar.
- Distinctive vibe tags: Indiranagar "Special occasion, Stylish, Industrial, Trendy";
  Koramangala "Modern, Trendy, Bustling"; Jayanagar "Convenience stop, Routine visit, Functional".
- Top art-place affinities were between 0.90 and 0.97 in all three localities.
- Coffee had the highest cultural fit everywhere (affinity about 0.97) but was rejected:
  about 200% of the budget, with 20+ competitors within 2 km.
- Thrift returned only **one** comparable place per locality and **zero** competitors within
  2 km, so its confidence is Medium, not High.
- Winner: art print pop-up in Jayanagar, 73.8/100, High confidence, narrowly ahead of
  Indiranagar (72.2). The gap comes mostly from the lower estimated stall fee, not from taste.
- The same run from the private snapshot (`QLOO_MODE=recorded`) gave identical scores with
  confidence capped at Medium.

## 9. Does Qloo change the answer? (ablation, 13 Oct)

**Before the fix.** Re-running Nisha with cultural fit forced to neutral gave the *same* winner
(art prints in Jayanagar) at low risk. Qloo only changed the winner at "bold" risk. The locality
was being decided by estimated stall fees.

**After the fix (DECISIONS D22), live run, 30 calls:**

| Rank | With Qloo signals | Score | Locality lift |
|---|---|---|---|
| 1 | Art print pop-up in Koramangala | 78.1 | +0.021 |
| 2 | Art print pop-up in Indiranagar | 76.0 | +0.009 |
| 3 | Thrift clothing stall in Jayanagar | 71.1 | +0.052 (one place only, so shrunk) |
| 4 | Art print pop-up in Jayanagar | 69.7 | -0.029 |

Without Qloo signals the same scoring picks art prints in Jayanagar (68.5), and 4 of 9 rankings
differ. So Qloo now decides *where*: art places resonate more with the Koramangala and
Indiranagar audiences than with the Jayanagar one.

**Honest limits.** The lifts are small in absolute terms (hundredths of an affinity point), the
lead over the runner-up is about 2 points, and thrift still rests on a single comparable place.
The app shows the raw lift values and its confidence reasons rather than hiding this.

## 10. Phase 2 verification: partners, neighbourhoods, prices (15 Oct)

About 20 controlled calls (monthly counter 9,393 → 9,377). Results:

| Capability needed | Call | Result |
|---|---|---|
| Product words to tags | `GET /v2/tags?filter.query=brownie` | **Supported.** `urn:tag:specialty_dish:place:brownie`, `urn:tag:menu_highlight:qloo:brownie`. "vegan" gives genre, cuisine and offerings tags. |
| Host venue types | `/v2/tags` for co-working, food court, shopping mall, community center, book store, jewelry, juice | **Supported.** IDs follow `urn:tag:genre:place:<name>` (food venues use `...:restaurant:<name>`). |
| Neighbourhood ranking for an idea | `filter.type=urn:heatmap`, `filter.location.query=<city>`, `signal.interests.tags=<idea tag>`, `output.heatmap.boundary=urn:entity:locality` | **Supported**, and the ranking changes with the idea. Bakeries: Hoysala Nagar, Aramane Nagara, Hudi, Konena Agrahara, Mahadevapura. Art galleries: Shanthi Nagar, Adugodi, Pulikeshinagar, Koramangala. The list also contains administrative areas (city, "East Zone", "Bengaluru Urban") that must be filtered. Responses are large (about 5 MB, 9 to 12 s) because each area includes its boundary polygon, so results are cached. `output.heatmap.boundary` only accepts `urn:geohash` or `urn:entity:locality`. |
| Business you admire | `GET /search?query=Lamara Patisserie&types=urn:entity:place` | **Supported**, but search is global: the 2nd and 3rd results were in France and Egypt, so results are filtered by city. |
| Places similar to an admired business | insights, `signal.interests.entities=<admired>`, bakery and dessert tags, city filter | **Supported.** Returned AvocadoandBrownies, Brownie Magix, Krumb Kraft (affinity 0.97 to 0.98). |
| Cross-category partners | insights, `signal.interests.entities=<local bakeries>`, `filter.location.query=<locality>`, no tag filter | **Supported.** Cafés, juice shops, food courts and restaurants at 0.97 affinity. Also irrelevant types (a butcher shop), so results are classified and filtered by venue type. |
| High-visibility hosts | same, with `filter.tags` = mall, food court, co-working, community center (union) | **Supported.** Returned food courts and a shopping mall with affinity 0.95 to 0.97. |
| Price signals | place `properties.price_level` and `properties.cost_description` | **Supported.** Nest Bakery: level 1, "₹1 to ₹200". Lamara Patisserie: level 4, "₹600 to ₹1600". These describe typical spend at the venue, not the price of any one product. |
| Footfall | none | **Not available.** Qloo popularity is a relative popularity percentile and tags such as "High pedestrian traffic" are descriptive. Neither is a visitor count, so hosts are labelled "potential high-visibility location". |

Meaning of the scores used:
- **affinity** (0 to 1): how strongly an entity is associated with the signal (for example, with the
  people who like the given bakeries). It is not a probability of purchase and does not mean two
  businesses share actual customers.
- **popularity** (0 to 1): a relative popularity percentile within Qloo's data, not footfall.

## 11. First live partner-mode run (15 Oct)

Input: homemade eggless brownies, vegan cupcakes and plum cakes; Bengaluru; ₹10,000; 2
weekends; "Show me both"; admired business "Lamara Patisserie". 30 live calls, about 16 s.

- Neighbourhoods (heatmap): Hoysala Nagar, Aramane Nagara, Hudi analysed; Konena Agrahara,
  Shivaji Nagar, Domlur, Pulikeshinagar, White Field also ranked.
- Admired business resolved to Lamara Patisserie in Marathahalli; similar-crowd places
  included Liliyum Patisserie, Chaska Box and Brownie Magix, with product-tag overlaps such as
  "Egg free" and "Brownies".
- Complementary partners included Third Wave Coffee, Waffle Magic and Chai Point; hosts included
  Park Square Mall and Nexus Shantiniketan.
- No solo stall fitted ₹10,000 (all three about ₹16,000), so the comparison recommended a
  partnership. The best option at that time was wholesale supply, which only breaks even at the
  default assumptions; consignment did not break even in the pilot because of the one-time
  food registration. Both facts are shown to the user.
- One issue found and fixed: chain branches ranked high; they now carry a risk note and penalty.
