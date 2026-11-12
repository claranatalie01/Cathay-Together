# LOGIC.md

How the two algorithms in Cathay Together work. Both are pure functions: no browser, storage, network or randomness, so the same inputs always give the same output. Sources: `src/algorithms/combinations.js`, `arrivalWindow.js`, `travel.js`, `itinerary.js`, and the data in `src/data/placeGeo.js`. Tests sit beside them (`npm test`).

Data status: flight times and numbers come from a saved OAG schedule snapshot; **all prices are fictional**. Place coordinates are real (OpenStreetMap); most opening hours are our own estimates (see 2.5).

---

## 1. Group flight combination and ranking engine

### 1.1 Inputs and who is "fixed"

`suggestionsFor()` in `src/api/mock/flightData.js` builds one entry per group member for one direction (outbound or return) and hands them to `rankCombinations()`:

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

## 2. Rule-based itinerary generation engine

No machine learning and no language model. The same votes always give the same plan, and `checkPlan()` can prove a plan valid.

### 2.1 Travel time between places (`travel.js`, `placeGeo.js`)

`PLACE_GEO` holds real `lat`/`lon` for the 11 voted places (OpenStreetMap, looked up 11 Nov 2026; credit "© OpenStreetMap contributors"). `travelMinutes(a, b)` is an **estimate**, not a timetable (no train data):

1. `distanceKm`: the haversine great-circle distance, `R = 6371 km`.
2. Multiply by `DETOUR = 1.3` (streets are not straight).
3. If the result is at most `WALK_LIMIT_KM = 1.2`: walk at `5 km/h`.
   Otherwise: `10 min` for waiting and reaching the station, plus the distance at `25 km/h` (`TRANSIT_OVERHEAD_MIN`, `TRANSIT_KMH`).
4. Round **up** to a whole 5 minutes, minimum 5: `max(5, ceil(minutes / 5) * 5)`.

`travelTable(geo)` precomputes every pair. Examples from the real table: Tokyo Tower to Zōjō-ji is 5 minutes (about 300 m); Sensō-ji to Shinjuku Gyoen is 40.

### 2.2 Votes

`hasMajority(vote)` is `liked * 2 > total`: a **strict** majority.

| Group | Liked by | Result |
|---|---|---|
| 3 people | 2 | in |
| 4 people | 2 | not in (exactly half) |
| 4 people | 3 | in |
| any | at least 1 but no majority | "maybe" (listed, never scheduled) |
| any | 0 | dropped |

`rankVotes(places, votes)` returns `winners` (most liked first; place order breaks ties) and `maybe`.

### 2.3 The scheduler, step by step (`schedule()` in `itinerary.js`)

Times are **trip minutes**: minutes since 00:00 Tokyo time on day 1. 09:30 on day 2 is 1,440 + 570 = 2,010.

1. **Votes.** `rankVotes` splits winners from maybes (2.2).
2. **Free time** (`groupFreeTime` in `src/api/mock/itineraryData.js`, from everyone's saved flights, using full instants):
   - `freeFrom` = latest landing + `afterLanding` (90 minutes)
   - `freeUntil` = earliest take-off − `beforeTakeoff` (180 minutes)
   - every day is further limited to `dayStart` 08:00 to `dayEnd` 21:30
   - members without flights are left out; with no flights there is no limit.
   `allowedWindow(day, item, free, rules)` is the intersection of the day band, the place's opening hours and the free time.
3. **Greedy placement of winners**, most-liked first, never moving anything already placed. Days are tried in this order: fewest voted stops first, then middle days before the first and last (`isEdge`, when the trip has more than 2 days), then earliest. On each day `findStart()` returns the earliest start that satisfies all of:
   - inside the group's free time and the day band;
   - inside the place's open and close times (preferred start, `prefer`, is tried first: afternoon places from 13:00, evening from 17:30);
   - not on a day listed in `closedOn`;
   - no clash with a stop already there, leaving the travel gap on both sides (below);
   - start times rounded up to `step` = 15 minutes.
   Candidate starts are only the window opening, the preferred time, and just after each existing stop, which are the only moments that can be the earliest valid one.
   A winner that fits on no day goes into `unplaced` ("did not fit"). It is reported, never squeezed in.
4. **Fillers** (suggested stops nobody voted on) are placed on their own day only. A filler is skipped (`skippedFillers`) if a voted place already starts in its part of the day (morning, afternoon or evening: `SLOT_HOURS`) or if nothing fits.
5. **Verification.** `checkPlan(plan, inputs)` re-reads the finished timetable and returns a list of every rule broken. An empty list is the proof of validity. It checks: day count, duplicates, duration, closed days, start/end inside the allowed window, voted stops having a majority, the travel gap before each stop, and that every winner is either scheduled or listed as `unplaced`.

**Travel gap.** `gapBetween(travel, rules)` returns the minutes needed between two stops: the `travel(fromId, toId)` estimate for two voted places, otherwise the flat `rules.travelGap` = 20 minutes (fillers have no coordinates; the airport legs are not scheduled).

**Closed days.** `closedOn` is built per place from `PLACE_GEO[id].closedWeekdays` and the trip dates (`closedDays()` in `itineraryData.js`). Shinjuku Gyoen is closed on Mondays; with a Sat 21 Nov start, Monday 23 Nov is trip day index 2, so the garden is never placed there.

**Editing.** After a person removes or reorders stops, `retimeDay()` keeps their order and repacks the day (start at the later of the window opening and the previous stop's end plus its gap, rounded to 15 minutes). It respects opening times where the order allows; whatever the order makes impossible is left for `checkPlan` to report.

### 2.4 Example

Everyone likes all 11 places, trip Sat 21 to Tue 24 Nov, no flight limits. One result of the real builder: Shinjuku Gyoen 13:00 on day 1 (the only open day it fits besides day 2, never Monday), Shibuya 17:30 day 1; Tsukiji 08:00, Ameyoko 13:00, Azabudai 15:00, Roppongi 17:30 on day 2; `checkPlan` returns `[]`.

### 2.5 Known trade-offs and boundaries

- **Greedy, no backtracking.** Winners are placed once, best first, and never moved. A different order could sometimes fit one more place; the method guarantees valid and repeatable, not optimal.
- **Flat buffers.** A fixed 20 minutes applies wherever coordinates are missing (all fillers). The airport legs shown on the itinerary are a flat 60 minutes, for display only; the 90-minute and 180-minute rules are what constrain scheduling.
- **Travel time is an estimate.** Straight line times 1.3, one average train speed, no timetables or waiting at specific stations.
- **Opening hours are mostly estimates.** `placeData.js` supplies `open`/`close` for all places. OpenStreetMap's hours text exists for only Shinjuku Gyoen, Sensō-ji, Tokyo Tower and Zōjō-ji, and it is **not parsed**: only the structured `closedWeekdays` is used. Where the map and the estimate differ, `note` in `PLACE_GEO` records it; no hours are overwritten automatically.
- **Single day length.** Everything is limited to 08:00 to 21:30, including places that open earlier or close later.
- **Validation lives in the app.** The database stores the plan; `checkPlan` runs in the browser and the database does not re-check it.
