# LOGIC.md

JavaScript ranks group flights using a saved OAG snapshot. **Flight fares are simulated.**

The Python planner researches venues, estimates transfers and drafts a shared itinerary. JavaScript renders the saved plan and checks manual edits.

---

## 1. Group flight combination and ranking engine

### 1.1 Inputs and who is "fixed"

`suggestionsFor()` in `src/api/shared/flightData.js` builds one entry per group member for one direction (outbound or return) and hands them to `rankCombinations()`:

| Member state | Flights tried for them | Price used |
|---|---|---|
| Has saved a choice in this direction | Exactly one: their chosen flight (`fixedFlightId`) | `chosen.price`, the fare they selected, in the cabin they selected |
| Has not chosen | Every flight from **their own home airport** on the group date, in the cabin selected on screen | `priceFrom`, the lowest fare of that cabin |

- A fixed member's flight is built straight from their saved selection, so it still counts even if it is on a different date from the one searched, or in a different cabin from the one selected.
- `extra` (what a person pays above their own cheapest flight) is 0 for a fixed member: the choice is theirs.
- The suggestions never change anyone's choice. Each person still picks their own flight.
- Date searched: the group's start date for outbound, end date for return. Economy/premium/business applies only to the unpicked.

### 1.2 Time is compared as full timestamps

Every flight reduces to one **instant** (milliseconds since 1970, UTC) by `meetingInstant(leg, direction)` in `arrivalWindow.js`:

- outbound: the **landing** instant (`arriveAt`)
- return: the **take-off** instant (`departAt`)

`legInstants()` uses the stored ISO `departAt` and `arriveAt`. Only for old data without them does it rebuild the instants from a date, a clock time and the airport's UTC offset (`UTC_OFFSET_HOURS`; none of the listed airports changes its clocks), moving the landing forward by 24 hours until it is after take-off.

Why never clock times:

- Different origins sit in different time zones: 13:00 in Hong Kong is 14:00 in Tokyo, which is the same moment.
- Landings cross midnight: 23:55 and 00:25 the next day are **30 minutes** apart, not 23 h 30 m.
- Connections (for example Singapore via Hong Kong) can land on the next calendar day.

### 1.3 Generating the combinations

`rankCombinations({ members, othersLimit = 30 })` builds the Cartesian product of every member's candidate list (`pick()` recursion). With 3 members and 5 flights each that is 5 × 5 × 5 = 125. With one member fixed it is 1 × 5 × 5 = 25. Five members at five flights each is 3,125, still instant. Nothing is pruned, so the answers are exact, not approximate.

For each combination:

```
total          = sum of each member's price
spreadMinutes  = round((max instant - min instant) / 60000)     // 0 for one member
```

If the group is empty or any member has no flights, the result is `{ cheapest: null, closest: null, balanced: null, featured: [], others: [], count: 0 }`.

### 1.4 The three modes

**Cheapest**: sort by `total` ascending; ties go to the smaller `spreadMinutes`.

**Closest**: sort by `spreadMinutes` ascending; ties go to the lower `total`.

**Best of both** (called `balanced` in code), in two steps. There is deliberately no time window to set: closer is always treated as better.

1. **Pareto filter.** `beats(a, b)` is true when `a.total <= b.total` and `a.spreadMinutes <= b.spreadMinutes` and `a` is strictly better on at least one. Any combination that another combination beats is thrown away. What remains (`tradeOffs`) is the frontier: each step along it costs more money to bring the group closer together.
2. **Normalised score.** The two extreme winners set the ranges:

   ```
   priceShare = (total - cheapest.total) / (closest.total - cheapest.total)
   timeShare  = (spread - closest.spread) / (cheapest.spread - closest.spread)
   score      = priceShare + timeShare          // lower is better; 0 is perfect on both
   ```

   A range of 0 makes that share 0 (`share()` guards the division). The lowest score wins. Scores within `EPSILON = 1e-9` count as tied, and a tie goes to the **smaller spread**, then the lower total.

Final tie-break for everything, so output is deterministic: the combination's flight ids joined by `|` (`key()`), compared with `localeCompare`.

### 1.5 Worked example

Three travellers, two flights each, landing in Tokyo (prices in HKD). Gaudi: G1 13:45 / 5,500, G2 16:50 / 4,900. Clara: C1 14:10 / 4,200, C2 20:30 / 3,600. Kabe: K1 15:00 / 6,800, K2 17:05 / 6,100. All eight combinations:

| Combination | Total | Spread | Survives Pareto? |
|---|---|---|---|
| G1 C1 K1 | 16,500 | 1h15 | yes (closest) |
| G2 C1 K1 | 15,900 | 2h40 | yes |
| G1 C1 K2 | 15,800 | 3h20 | no (beaten by G2 C1 K2) |
| G2 C1 K2 | 15,200 | 2h55 | yes |
| G1 C2 K1 | 15,900 | 6h45 | no |
| G2 C2 K1 | 15,300 | 5h30 | no |
| G1 C2 K2 | 15,200 | 6h45 | no |
| G2 C2 K2 | 14,600 | 3h40 | yes (cheapest) |

Ranges: price 14,600 to 16,500 (1,900); spread 75 to 220 minutes (145).

| Frontier combination | priceShare | timeShare | Score |
|---|---|---|---|
| G1 C1 K1 | 1.000 | 0.000 | 1.000 |
| G2 C1 K1 | 0.684 | 0.586 | 1.270 |
| G2 C1 K2 | 0.316 | 0.690 | 1.006 |
| G2 C2 K2 | 0.000 | 1.000 | 1.000 |

G1 C1 K1 and G2 C2 K2 tie at 1.000, so the **smaller spread wins**: Best of both is G1 C1 K1, the same combination as Closest. Here no in-between option beats the two ends, so the cards merge (below).

### 1.6 Output

- `featured`: Cheapest, Closest, Best of both, in that order, **merged** when one combination wins several rules (labels such as `['closest', 'balanced']`). With a single member, or when everyone is fixed, one card carries all three labels.
- `others`: every other combination, ordered by the same score and tie-breaks, capped at `othersLimit` (30).
- `count`: how many combinations were tried.

### 1.7 Limits

- One cabin for everyone who has not picked; mixed cabins are not offered.
- Prices are fictional, so "cheapest" and "best of both" only demonstrate the method.
- The score treats a minute of spread and a share of price as equally important. That is a choice, not a law; changing the weights would change `balanced`.

---

## 2. Shared AI itinerary planner

### 2.1 Research and readiness

1. **Search.** `explorer_agent()` uses Tavily, with a dedicated query for named restaurants and cafés. `curator_agent()` builds cards from cited evidence, matches photos by their descriptions and supplies exact venue names where possible.
2. **Geocode.** `enrich_coordinates()` looks for a name match near the destination and checks the provider’s confidence. It keeps the accepted point and its source. Existing shared groups with legacy votes use the bundled `server/legacy_places.json`.
3. **Save votes.** A member saves one choice per deck card. The planner uses every current member’s saved votes. `split_cards()` prioritizes `likes × 2 ≥ total`, then allows lower-ranked liked places. For example, two likes out of four qualify. If no place qualifies, it works from all places with a like. With zero likes across the deck, the planner returns `nothing_to_plan`.

### 2.2 Draft, geocode meals and review

| Step | Current rule |
| --- | --- |
| Availability | `flight_limits()` and `day_window()` intersect 08:00–21:30 local time with the latest arrival plus 90 minutes and the earliest departure minus 180 minutes. A day can have an empty window. |
| Draft | `scheduler_agent()` gives Poe the daily windows, liked cards, research, budget and pairwise travel estimates. Pace limits are two activities for relaxed, three for moderate and four for packed. |
| Meals | Full middle days require lunch and dinner. `adopt_liked_food()` can replace a generic lunch or dinner with an unscheduled food card liked by at least half the group if its known hours and closure days allow the slot. `locate_areas()` geocodes the named district for remaining generic meals. |
| Transfers | `distance_km()` computes Haversine distance. Let `d = 1.3 × distance_km`. For `d ≤ 1.2 km`, use `60 × d / 5`. Otherwise use `10 + 60 × d / 25`. Round to `max(5, ceil(minutes / 5) × 5)`. If either point is unavailable, use 30 minutes. |
| Rule checks | `deterministic_checks()` checks overlaps, airport buffers, opening hours, closures, pace, meals and the JPY budget. An insufficient transfer is a warning. After a free-time block, the previous physical stop remains the origin and the transfer gap starts at the end of the block. |
| Model review | When the rule checks find no errors, `quality_check_agent()` asks the model to review feasibility and evidence. A warning alone does not require a revision. |
| Revision and selection | On rejection, `run_plan()` can request one simpler draft with feedback. It saves the reviewed draft with the fewest reported errors, choosing the later one on a tie. A draft can be saved with review errors. A provider failure or lack of a usable draft can surface **Try again**. |

**Worked transfer.** A 1.42 km straight-line leg becomes 1.85 km of estimated street distance. That takes about 14.4 minutes with the transit formula, rounded up to **15 minutes**. The label reads “15 min estimated transfer” with the same icon used for walking estimates.

### 2.3 Save, read and edit

- **Save one group plan.** `finish_trip_planner_job()` verifies the original input snapshot before saving. The plan includes `review`, `sources`, `transfers` and the input `fingerprint`. A rebuild can replace the saved plan and its manual edits.
- **Reuse the saved transfer table.** `savedTransferMinutes()` uses the card ID, or the stop ID for a generic meal. The displayed totals and `retimeResearchedPlan()` use this same table.
- **Open the plan.** The build endpoint checks the input fingerprint. The current itinerary screen can open an existing plan before calling that endpoint.

- **Edit an older shared plan.** [`retimePlan()`](src/api/shared/itineraryData.js) uses the stored earliest start, the place opening time, and coordinate-based estimates where known. [`retimeDay()`](src/algorithms/itinerary.js) preserves the requested order, uses a 20-minute fallback and rounds starts up to 15 minutes. A legacy plan without `free` retains its times.
- **Read a legacy transfer.** When an older non-AI plan has no saved transfer table, [`travelTable()`](src/algorithms/travel.js) precomputes pairs among the 11 original places. Tokyo Tower to Zōjō-ji is 5 minutes. Sensō-ji to Shinjuku Gyoen is 40 minutes. Airport connectors show 60 minutes.

Sources include [`pipeline.py`](server/itinerary/pipeline.py), [`geocoding.py`](server/itinerary/geocoding.py), [`travel.py`](server/itinerary/travel.py), [`checks.py`](server/itinerary/checks.py), and [`app.py`](server/app.py).
