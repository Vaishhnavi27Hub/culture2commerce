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
