# Cathay Together: technical guide

Mentor notes for the Cathay Hackathon, 14–15 November 2026. Written 10 November 2026.

- [plan.md](../plan.md) says **what to do and in what order**. This guide explains **why, and how each part works**.
- Where this guide and `plan.md` disagree, `plan.md` wins. Differences are listed as open decisions in `plan.md` section 0.
- Technical terms are explained when first used and again in the [glossary](#9-glossary).

Three labels are used throughout:

| Label | Meaning |
| --- | --- |
| **Built** | Working code in the repository today |
| **Mocked** | A pretend version that runs inside one browser |
| **Proposed** | Not started; a recommendation |

## How far to trust this guide

| Topic | How it was checked | Still unverified |
| --- | --- | --- |
| Current code | Read directly from `src/api/mock/` on 10 November | Nothing |
| OAG flight data | The organisers' quick start guide and OAG's field reference page | No real request has been made, so exact field names and formats may differ |
| Supabase | The documentation pages linked in `plan.md` | Free-plan limits and whether the organisers allow it |
| Opening hours in the examples | Illustrative values only | All of them. Check each official site |
| Cathay's routes | General knowledge | Whether Shanghai and Singapore members must connect through Hong Kong |
| Hackathon rules | The on-day email | Whether any work before 11:00 on 14 November is allowed |

## 1. The short version

The app has every screen, but nothing behind the screens is shared or real. Three things are needed:

1. **A shared backend.** A backend is the server and database that every phone talks to. Today each browser keeps its own private copy of the data, so two phones can never see the same group.
2. **Flight data with complete timestamps.** A timestamp is a date, a time and a time zone together. Today the code compares clock times only, which gives wrong answers for overnight flights and different days.
3. **Three small rule-based algorithms:** compare flight times, turn votes into picks, and schedule the picks into days.

No machine learning is needed. Prices, payment and tickets stay simulated and must be labelled as simulated.

## 2. What exists today

| Feature | Built | Mocked or missing |
| --- | --- | --- |
| Groups and invitations | All screens; create, join and decline logic | Stored per browser. Other people are simulated by the "Demo only" panel |
| Members from different airports | Three fixed people: Gaudi (HKG), Clara (SHA), Kabe (SIN) | No real sign-in; no way to add a new person |
| Flight search | Result and fare screens | Flights are fictional: five templates per airport, generated in `flightData.js` |
| Flight timing | Real logic: spread compared with a 1 to 6 hour window | Uses clock times only (two bugs, see 3A) |
| Flight board | Real logic, list and timeline views | Same two bugs |
| Booking and payment | Screens and a 20-minute countdown | Fully simulated; no card data is taken |
| Like or pass | Works for four fixed Tokyo places | Stored per browser |
| Itinerary | Builds a plan from votes; reorder and remove | No clock times, no opening hours, fixed travel times, ignores when other members land |

## 3. Algorithms

### 3A. Flight coordination

**The problem.** Friends fly from different cities. They want to land close together so nobody waits alone at the airport, and leave close together at the end.

**Inputs.** The flight one member is considering, the flights the other members already chose, and the "group timing window" (1 to 6 hours, from the slider).

**Output.** For each flight: whether the group fits inside the window, and if not, by how many minutes it misses.

**What the code does today (Built).** `withTiming` in `src/api/mock/flightData.js` (line 219) takes the candidate's landing time plus every other member's landing time. It computes the **spread**, which is the latest time minus the earliest. If the spread is no larger than the window, the flight is "within". Members who have not chosen are left out. The return direction does the same with take-off times.

**Worked example.** Gaudi (Hong Kong), Clara (Shanghai) and Kabe (Singapore) fly to Tokyo Haneda on 21 November. Landing times in Tokyo time, from the current demo catalogue:

| Departs | Gaudi lands | Clara lands | Kabe lands |
| --- | --- | --- | --- |
| 08:55 | 13:45 | 12:50 | 16:50 |
| 11:20 | 16:10 | 15:15 | 19:15 |
| 15:35 | 20:25 | 19:30 | 23:30 |
| 16:30 | 21:20 | 20:25 | 00:25 next day |
| 19:05 | 23:55 | 23:00 | 03:00 next day |

Gaudi has chosen 16:10 and Kabe 16:50. Clara searches with a 1-hour window:

| Clara's option | Earliest | Latest | Spread | Result |
| --- | --- | --- | --- | --- |
| Lands 15:15 | 15:15 | 16:50 | 95 min | 35 min over the window |
| Lands 19:30 | 16:10 | 19:30 | 200 min | 140 min over the window |
| Lands 15:15, window set to 2 hours | 15:15 | 16:50 | 95 min | Within |

`plan.md` (DEV-03) uses a simpler fictional fixture for tests: Gaudi 15:00, Kabe 15:40, and Clara's options giving 40, 70 and 120 minutes.

**Is "latest minus earliest" enough?** Yes, as the main measure. It answers the question people care about: how long the first person waits for the last. Show beside it how many members it covers, for example "based on 2 of 3 members".

**Two bugs in today's code.** It compares clock times such as "16:10" and ignores the date.

| Case | Real gap | What the code says |
| --- | --- | --- |
| Gaudi lands 23:55; Kabe lands 00:25 the next day | 30 min | 23 h 30 min |
| Kabe picks a 20 November flight; Gaudi a 21 November flight, 40 minutes later on the clock | 24 h 40 min | 40 min |

The board's timeline (`column` in `boardHandlers.js`) has the same problem.

**The fix (Proposed).** Store every time as a full timestamp with its time zone, such as `2026-11-21T16:10:00+09:00`. Turn each into an **instant**, which is one number that means the same moment everywhere in the world. Then subtract.

```js
// times are strings such as "2026-11-21T16:10:00+09:00"
function spreadMinutes(times) {
  const instants = times.map((t) => Date.parse(t)); // milliseconds
  return (Math.max(...instants) - Math.min(...instants)) / 60000;
}
```

This also handles time zones correctly. Today the code hard-codes "Tokyo is one hour ahead", which only happens to be right for Hong Kong, Shanghai and Singapore.

**Ranking the results (from `plan.md` DEV-03).** Flights within the window are ordered by price, then by spread. Flights outside it are ordered by how far they miss, then by price. A stable ID breaks any final tie, so every phone shows the same order.

**Two possible scopes.**

| Scope | What it does | Verdict |
| --- | --- | --- |
| A. Rank one member's options | Compares each of my flights with what others already chose | Build this. It is what exists today, minus the bugs |
| B. Recommend a combination for the whole group | Tries one flight per person in every combination and keeps the best | After the hackathon |

Scope B shows why spread alone is not enough. On the table above, the tightest combination lands 23:00 to 23:55 (55 minutes apart), which is almost midnight. The next is 19:15 to 20:25 (70 minutes), then 15:15 to 16:50 (95 minutes). A real recommender needs a score that also weighs price and a sensible arrival hour.

**Edge cases.**

| Case | How to handle it |
| --- | --- |
| A member has not chosen | Leave them out and show how many members are covered |
| Nobody else has chosen | Show no timing at all. The first picker anchors everyone else |
| Other members are already further apart than the window | Say so. No single choice can fix it |
| Different destination airports (Haneda and Narita) | Add each airport's transfer time into the city and compare those. Deferred: the demo uses Haneda only |
| Connecting flights | Compare the landing time of the last flight only (outbound) and the take-off of the first flight (return) |
| Return leaves before the outbound lands | Reject it on the server, not only in the screen |

### 3B. Group preferences

**The problem.** Each member likes or passes on each place. The group needs one fair list of places to visit.

**Inputs.** One like or pass per member per place, counted only after the member has saved.

**Output.** Places to schedule, a "Maybe" list, and places to drop.

**What the code does today (Built).** `buildPlan` in `src/api/mock/itineraryData.js` (line 74) schedules a place when more than half the group liked it (`likes * 2 > members`). A place with at least one like that misses that bar goes to "Maybe". A place nobody liked is dropped. Building is blocked until every member has saved.

**Worked example,** using the sample votes in `placeData.js`:

| Place | Gaudi | Clara | Kabe | Likes | Result today |
| --- | --- | --- | --- | --- | --- |
| Sensō-ji & Asakusa | like | like | like | 3 of 3 | Scheduled |
| Tsukiji Outer Market | like | like | pass | 2 of 3 | Scheduled |
| Shinjuku Gyoen | pass | pass | like | 1 of 3 | Maybe |
| Omotesando stroll | pass | pass | like | 1 of 3 | Maybe |

**Is majority voting enough?** It is enough for the demo, and `plan.md` (DEV-04) keeps it. It has two known weaknesses:

- **Minorities always lose.** Gaudi and Clara vote the same way and get 2 of their 2 likes. Kabe gets 1 of his 3.
- **Even groups get stuck.** With two members, one like and one pass is not "more than half", so nothing they disagree on is scheduled.

The plan's answer is to keep minority picks visible in "Maybe" so the group can discuss them. A pass is treated as a soft "no", never as a veto.

**Optional upgrade (Proposed, open decision).** Three steps, about 20 lines of code:

1. Score each place as likes minus half the passes.
2. Schedule places with a score above zero, highest first. One like and one pass scores 0.5, so two-person groups are no longer stuck.
3. Give one "minority pick": find the member with the smallest share of their likes in the plan, and add their best remaining like if time allows. Label it, for example "Kabe's pick".

In the example, step 3 adds Shinjuku Gyoen for Kabe. It ties with Omotesando on score, and the cheaper one wins.

**Ties** always need a fixed order: more likes, then less added travel, then lower cost, then a stable ID.

**Edge cases.**

| Case | How to handle it |
| --- | --- |
| Everyone passes on everything | Show no voted picks. Offer clearly labelled optional ideas |
| A member changes a saved vote | Mark them "not ready" and mark the itinerary as out of date |
| A member has not voted | Draft votes do not count. Building stays blocked (per `plan.md`) |
| Only four places | Nearly everything fits in a four-day trip, so votes decide little. See the open decision on adding places |
| Real restrictions (allergies, mobility) | Not a "pass". Out of scope; do not collect this data |

### 3C. Itinerary scheduling

**The problem.** Put the chosen places into days and times so that everyone is in Tokyo, every place is open, and there is time to travel between stops.

**Inputs.**

- Each member's arrival and departure timestamps.
- The ranked places from 3B.
- Facts about each place: coordinates, opening times for each trip date, visit length, cost.
- Travel times between places.
- Settings from `plan.md` (DEV-05): days run 09:00 to 21:00; 90 minutes to leave the airport; 60 minutes between Haneda and the city hub; be at the airport 180 minutes before departure; budget JPY 15,000 per person.

**Output.** Each day's stops with exact start and end times, the travel minutes before each stop, the cost, and a list of places that did not fit with the reason.

**What the code does today (Built).** `buildPlan` puts one voted place on each middle day and fills the rest with fixed "suggested" stops. It stores only "Morning", "Afternoon" or "Evening". It has no opening hours. Travel is always 20 minutes (60 for the airport). The flights shown are the viewer's own, so the plan ignores when the rest of the group lands.

**The algorithm (Proposed).** A **greedy** scheduler: it places one item at a time in the first spot that works and never goes back. It will not always find the perfect plan, but every decision is easy to explain.

```
shared start = latest arrival + 90 min + 60 min to the hub
shared end   = earliest departure − 180 min − 60 min from the hub

for each day:
    free time = 09:00–21:00, cut down to the shared start and end

for each place, in vote order:
    for each day, earliest first:
        start = end of the previous stop + travel time
        if the place is not open yet: wait until it opens
        if the whole visit fits before the place closes,
           and there is still time to get back to the hub,
           and the budget is not used up:
               schedule it here and move to the next place
    if it fits on no day: add it to "unscheduled" with the reason

fill what is left with optional stops, labelled as suggestions
run the checker
```

Higher-voted places choose first. That is how changing a vote visibly changes the plan.

**The checker.** One function that walks through a finished plan and reports problems: overlapping stops, a stop while the place is closed, a stop before the shared start or after the shared end, or a day over budget. Run it after generating and again after any member edits the plan. An empty problem list is the proof that the itinerary has no obvious conflicts.

**Worked example** for 21–24 November. Arrivals are Clara 15:15, Gaudi 16:10 and Kabe 16:50. Gaudi and Clara leave first, at 15:35 on the last day. For this example only, assume Tsukiji is closed on Sunday.

| Day | Shared time | Plan | Why |
| --- | --- | --- | --- |
| Sat 21 | 19:20–21:00 | Dinner near the hub | Kabe lands last at 16:50; add 90 and 60 minutes |
| Sun 22 | 09:00–21:00 | Sensō-ji 09:25–11:25 | Top vote, so it chooses first |
| Mon 23 | 09:00–21:00 | Tsukiji 09:20–10:50 | Closed on Sunday in this example, so it moves a day |
| Tue 24 | 09:00–11:35 | One short stop near the hub | 15:35 departure, minus 180 and 60 minutes |

23 November 2026 is a public holiday in Japan. Holidays change opening times, which is why each place needs its opening times listed per trip date, not per weekday.

**Travel time.** No routing service is needed. Use a small hand-made table of minutes between the hub and each place. If a pair is missing, estimate from the map coordinates (for example, 10 minutes plus 3 minutes per kilometre) and label it "approx."

**Limitations.**

| Limitation | Effect |
| --- | --- |
| Greedy, not optimal | It can miss a better arrangement. Acceptable for about 12 places |
| Everyone attends every stop | A member who lands a day late needs separate handling |
| Flight delays | The plan is not rebuilt automatically. A later idea, since OAG reports delays |
| Manual edits | Must go through the same checker, or they can break the plan |

### 3D. Do we need machine learning or an LLM?

No, not for the core.

- The three algorithms are **deterministic**: the same inputs always give the same result. That makes them testable and easy to explain to judges.
- An LLM (a text-generating AI model) can invent opening hours or times. Fairness and timing must be exact.

One honest optional job exists: writing the friendly day titles (such as "Old Tokyo & lively lanes"), which are fixed text today. The model would receive the finished plan and return text only, so it cannot change a place or a time. If it fails, the fixed titles are used. This is not needed for the demo.

If a judge asks "where is the AI?", the answer is that fairness and timing must be exact, so rules were chosen there on purpose.

## 4. Data checklist

Four kinds of data, which must stay distinguishable through a `source` label:

| Kind | Meaning | Examples |
| --- | --- | --- |
| User-entered | Typed or tapped by a member | Name, home airport, votes, chosen flight |
| Provider | Facts from an outside service | OAG flight times |
| Calculated | Worked out by our code | Spread, vote counts, itinerary |
| Fictional | Invented for the demo | Prices, fares, payment, tickets |

Never collect passport numbers, dates of birth, card numbers or anything else the demo does not use.

### Profiles (user-entered)

- **Why:** to know who is acting and where they fly from.
- **Fields:** user ID, display name, home airport code.
- **Refresh:** only when the person edits it.

```json
{ "id": "u_clara", "name": "Clara", "homeAirport": "SHA" }
```

### Airports (reference data, typed by hand)

- **Why:** to convert local times and show city names.
- **Fields:** code, city, time zone name.
- **Source:** four rows typed by hand. OAG's Master Data API also has this, but its quota is 100 requests with one result each.

```json
{ "code": "HND", "city": "Tokyo", "timeZone": "Asia/Tokyo" }
```

### Groups, members and invitations (user-entered)

- **Why:** the shared trip everyone joins.
- **Fields:** group ID, name, destination airport, start and end dates as real dates, creator, invite code; one member row per person with a join time.
- **Refresh:** changes when someone joins or edits.

```json
{ "id": "g_7f3k", "name": "Tokyo together", "destinationAirport": "HND",
  "startDate": "2026-11-21", "endDate": "2026-11-24",
  "creatorId": "u_gaudi", "inviteCode": "VFX37K", "budgetPerPersonJpy": 15000 }
```

Today the code stores only the label "Nov 21–24, 2026" and reads the dates back out of it. Store the dates themselves.

### Flight offers (provider times, fictional prices)

- **Why:** the options a member can choose.
- **Fields:** stable ID, airline and flight number, airports, departure and arrival as full timestamps, price, currency, a `source` label for the times and one for the price.
- **Source:** fictional fixtures at first; OAG times if access is confirmed (section 5).
- **Refresh:** a saved snapshot does not need refreshing for a demo. Live offers would.

```json
{ "id": "CX548-2026-11-21", "carrier": "CX", "flightNumber": 548,
  "from": "HKG", "to": "HND",
  "departUtc": "2026-11-21T00:55:00Z", "arriveUtc": "2026-11-21T04:45:00Z",
  "departLocal": "2026-11-21T08:55:00+08:00", "arriveLocal": "2026-11-21T13:45:00+09:00",
  "timeSource": "fictional", "price": 669100, "currency": "HKD", "priceSource": "fictional" }
```

Money is stored as a whole number of the smallest unit (cents), with the currency beside it. Flights are in HKD and activities in JPY, so never add them together.

### Flight selections (user-entered)

- **Why:** the input to the timing comparison and the board.
- **Fields:** group, user, direction, offer ID, cabin, fare, and a copy of the price at the time of choosing.
- **Rule:** one row per group, user and direction.

```json
{ "groupId": "g_7f3k", "userId": "u_gaudi", "direction": "outbound",
  "offerId": "CX500-2026-11-21", "cabin": "economy", "fare": "essential",
  "price": 779000, "currency": "HKD" }
```

### Votes (user-entered)

- **Why:** the input to the group picks.
- **Fields:** group, user, place, `like` or `pass`; plus a saved flag per member.

```json
{ "groupId": "g_7f3k", "userId": "u_kabe", "placeId": "scenery", "choice": "like" }
```

### Places (curated)

- **Why:** the things to vote on and schedule.
- **Fields:** ID, name, category, coordinates, opening times for each trip date, visit minutes, estimated cost, source.
- **Source:** a hand-made file. Check each official site for hours.
- **Refresh:** no, for a fixed demo trip.

```json
{ "id": "culture", "name": "Sensō-ji & Asakusa", "category": "Culture",
  "lat": 35.7148, "lng": 139.7967, "visitMinutes": 120, "costJpy": 1000,
  "open": { "2026-11-22": [["06:30", "17:00"]], "2026-11-23": [["06:30", "17:00"]] },
  "source": "curated" }
```

The coordinates and hours above are approximate placeholders.

### Travel times (curated estimates)

- **Why:** to leave realistic gaps between stops.
- **Fields:** from, to, mode, minutes, source. Include the airport to the hub and back.

```json
{ "from": "hub", "to": "culture", "mode": "train", "minutes": 25, "source": "estimate" }
```

### Itinerary (calculated)

- **Why:** the shared result everyone sees.
- **Fields:** group, revision number, built time, days, stops with start and end timestamps, travel minutes, cost, reason, and the unscheduled list.
- **Refresh:** rebuild or re-check when flights, members or saved votes change.

```json
{ "groupId": "g_7f3k", "revision": 3,
  "days": [{ "date": "2026-11-22", "stops": [{
    "placeId": "culture", "start": "2026-11-22T09:25:00+09:00", "end": "2026-11-22T11:25:00+09:00",
    "travelBeforeMinutes": 25, "costJpy": 1000, "reason": "3 of 3 liked" }] }],
  "unscheduled": [{ "placeId": "food", "reason": "Closed on the only free morning" }] }
```

The revision number lets the server reject an edit made on an old copy, so two people cannot silently overwrite each other.

### Demo bookings (fictional)

- **Why:** to show the journey from "picked" to "booked".
- **Fields:** group, user, status, hold expiry, made-up reference. No card data.

```json
{ "groupId": "g_7f3k", "userId": "u_gaudi", "status": "booked",
  "reference": "K3F9QZ", "simulated": true }
```

## 5. APIs and services

An **API** is a set of web addresses that one program calls to ask another for data. There are two kinds here:

- **APIs we build:** `/groups`, `/flights`, `/preferences`, `/itinerary` and the rest of `docs/api-contract.md`. Our React app calls these.
- **APIs we consume:** outside services our server calls, such as OAG. They never replace our own group backend.

| Need | External service needed for the demo? | Recommended | Fallback |
| --- | --- | --- | --- |
| Flight search | No | Fictional fixtures, or a saved OAG snapshot | The current generated catalogue |
| Place information | No | Hand-made place file | Same |
| Routing | No | Hand-made travel-time table | Estimate from coordinates |
| Sign-in | Yes | Supabase Auth with three pre-made demo accounts | The organisers' cloud, if Supabase is not allowed |
| Shared storage | Yes | Supabase Postgres database | The organisers' cloud |
| Live group updates | No | **Polling**: each open screen asks again every 5 seconds | Supabase Realtime, only if polling already works |

### OAG, the flight data offered by the organisers

From the organisers' quick start guide:

| Item | Detail |
| --- | --- |
| Access | Free and self-service for hackathon participants at developers.oag.com. Click "Try it" on an API to get a key |
| Flight Info API | Schedules, seat capacity, status and delays. 1,000 requests per 30 days, 10 results per request |
| Connections API | Connecting trips across airlines. Shares the Flight Info quota |
| Master Data API | Airports, airlines, aircraft. 100 requests per 30 days, 1 result per request |
| Required in every query | A departure or arrival date, plus an airline code or an airport pair |
| Recommended settings | `CodeType: IATA`; `Codeshare: OPERATING` (removes duplicate listings of the same flight) |
| `Content` setting | Blank gives schedules only; `STATUS` adds the latest status; `SEATS` adds seat capacity |

What OAG can and cannot do for this project:

| Capability | OAG | Notes |
| --- | --- | --- |
| Real flight times | Yes | Each departure and arrival comes in local time and UTC. This fixes the timestamp bugs directly |
| Cathay flights | Expected, not yet tested | The guide's own example queries airline `CX` |
| Prices and fares | No | Stay fictional and labelled |
| Seats left to buy | No | `SEATS` is the aircraft's capacity, not availability |
| Reservations, tickets, seat holds | No | Stay simulated |

How to use it safely:

- **Fetch once, save, reuse.** With 10 results per request and 1,000 requests in total, never call OAG each time someone searches. Three origins, two directions and three dates is about 18 requests. Save the results as fixtures with `timeSource: "oag"`.
- **Narrow each query** with the airline code and the airport pair, so the 10 results are the ones you need.
- **Keep the key secret.** The GitHub repository is public. The key belongs in a server setting or a local file that is never committed, not in the React code.
- **Timebox it.** `plan.md` (DEV-07) allows 60 minutes and treats OAG as optional. The fictional fixtures remain the default.

One thing to check with real data: the demo shows direct Cathay flights from Shanghai and Singapore to Tokyo. Cathay's flights normally run through Hong Kong, so Clara and Kabe would probably connect there. This is unverified. If true, the Connections API covers it and the timing algorithm does not change, because it only compares the last landing time. It also suggests a feature: put everyone on the same Hong Kong to Tokyo flight, which makes the spread zero.

### Supabase

Supabase is one service that provides a database, sign-in and small server functions. It is the stack chosen in `plan.md` section 3. Check before relying on it: that the organisers allow a service outside the provided AWS and GCP resources, the free-plan limits, and that it is reachable on the venue network.

## 6. Backend

### Who does what

```
Phone A ─┐
Phone B ─┼─► React app ─► our API (one Supabase Edge Function) ─► Supabase database
Phone C ─┘                     │
                               ├─ algorithm code (timing, votes, scheduler)
                               └─ OAG (optional, called once to save a snapshot)
```

| Part | Responsibility |
| --- | --- |
| React frontend | Shows screens and calls the functions in `src/api`. Holds no secrets and makes no decisions about access |
| Our API | Checks who is calling and whether they are a member, validates input, runs the algorithms, reads and writes the database |
| Database | The one shared copy of groups, selections, votes and itineraries |
| External providers | Supply facts only (flight times). Called from the server, never from the browser |
| Algorithm code | Plain JavaScript functions with no database or network calls, so they can be tested with fixed inputs |

### How two phones see the same group

Today `request()` in `src/api/http.js` answers every call from a mock stored in the browser's `localStorage`, which is private to that browser. The change is small in shape: `request()` sends the same path and JSON to our API over the internet, with the signed-in person's **token** (a temporary proof of identity). Both phones then read and write the same database. Each open screen asks again every 5 seconds, so a change on one phone appears on the other within about 10 seconds.

The pages do not change, because they only ever call `src/api`.

### Minimum tables

The full list is in `plan.md` (DATA-01). In short: profiles, groups, group members, invitations, flight offers, flight selections, preferences, places, travel times, itineraries and demo bookings. Section 4 of this guide has an example record for each.

### Access rules

| Rule | Why |
| --- | --- |
| The server works out who is calling from the verified token, never from a `userId` sent in the request | Otherwise anyone could pretend to be someone else |
| Only members can read a group's board, votes and itinerary | Trip details are private |
| An invitation preview shows only enough to decide whether to join | The link may be forwarded |
| A member can change only their own flight choice, votes and demo booking | Nobody edits for someone else |
| Only the creator edits the shared itinerary (per `plan.md`) | Avoids edit conflicts |
| Joining needs a valid invite code, and joining twice creates one membership | Stops duplicates and uninvited joins |

These rules are enforced twice: in the API code and in the database itself through **row-level security**, which is a database rule saying which rows each signed-in person may read or change.

### Secrets

| Value | Where it may live |
| --- | --- |
| Supabase public key and project address | In the browser. They are designed to be public |
| Supabase administrative key | Server only |
| OAG key | Server only, or a local file that is never committed |

Add a `.env.example` file that lists the setting names without their values.

### One thing to test early

The algorithm files must be usable from the Edge Function. Confirm this in the first hour. If it is awkward, the fallback is to host the same API as Vercel functions beside the existing Vercel site.

## 7. Realistic hackathon MVP

An MVP (minimum viable product) is the smallest version that proves the idea.

| Must work for real | Simulated, and labelled so | After the hackathon |
| --- | --- | --- |
| Two people on separate devices in the same group | Prices and fare types | Real booking, payment and ticketing |
| Flight choices saved and shared | Payment hold and e-ticket | Recommending flights for the whole group |
| Timing comparison on full timestamps | Flight times, unless an OAG snapshot is used | Several destination airports |
| Board identical on both devices | Travel times between places | Live delay handling |
| Votes that change the itinerary | Opening hours, until each is verified | Visa and entry checks for mixed passports |
| Itinerary that passes the checker | | LLM-written day titles |

### Success checks

| Check | How to prove it |
| --- | --- |
| Two users, two devices | Phone A creates a group. Phone B opens the invite link, signs in as another person and joins. Phone A shows the new member within 10 seconds without a reload. Both still agree after a reload |
| A non-member is kept out | A third account that never joined cannot read the board, votes or itinerary |
| Timing is correct | Automated tests give 95 minutes for the worked example, 30 minutes for the overnight case, and 24 hours 40 minutes for the different-day case |
| Boundary is correct | A spread of exactly 60 minutes is within a 1-hour window; 61 minutes is not |
| Votes change the plan | With 2 of 3 likes a place is scheduled. Change one like to a pass, rebuild, and it moves to "Maybe" |
| No timing conflicts | The checker returns no problems. No stop starts before the shared start (19:20 on day 1 in the example) or ends after the shared end (11:35 on the last day) |

## 8. Before the hackathon

The ordered to-do list is in [plan.md](../plan.md) section 0, with detail in its section 2. Whether any of it may be done before 11:00 on 14 November depends on the hackathon rules, which the on-day email does not state.

Questions to bring to the help desks (the expert desk closes at 17:30 on Saturday):

1. May we reuse our existing prototype, and what must be built during the 24 hours?
2. May we use Supabase and Vercel, or only the provided AWS and GCP resources?
3. Does Cathay provide any flight, fare or schedule data beyond OAG?
4. Is it acceptable to show simulated fares, payment and tickets if they are labelled?
5. Do Shanghai and Singapore travellers reach Tokyo on Cathay through Hong Kong? Would "meet at the hub" fit how Cathay sells group travel?
6. Does Cathay have group-booking rules today that our flow should respect?

## 9. Glossary

| Term | Meaning |
| --- | --- |
| API | A set of web addresses one program calls to get data from another |
| Backend | The server and database that all devices share |
| Database | Organised storage that keeps data after the app closes |
| Deterministic | The same inputs always give the same result |
| Endpoint | One address in an API, such as `GET /groups` |
| Fixture | A small, fixed set of sample data used for demos and tests |
| Greedy algorithm | One that takes the best available step each time and never goes back |
| Instant | One moment in time, the same everywhere in the world |
| Polling | Asking the server again at a regular interval to see if anything changed |
| Row-level security | A database rule about which rows each signed-in person may read or change |
| Spread | The latest time minus the earliest time |
| Timestamp | A date, a time and a time zone together |
| Token | A temporary proof of identity sent with each request |
| UTC | The world's reference clock. Hong Kong is UTC+8 and Tokyo is UTC+9 |

## Sources

- OAG Developer Portal Quick Start Guide for Cathay Hackathon 2026 (the PDF in the project folder, not tracked in the repository)
- [OAG Flight Info API response layout](https://knowledge.oag.com/docs/flight-info-api-response-layout-descriptions)
- [Supabase architecture](https://supabase.com/docs/guides/getting-started/architecture)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Cathay Hackathon 2026 on-day guide email, 9 November 2026
