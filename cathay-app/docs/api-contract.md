# API contract

Screens call functions in `src/api`. [`request()`](../src/api/http.js) dispatches the method and path to the [Supabase-backed handlers](../src/api/shared/handlers.js) and throws [`ApiError`](../src/api/errors.js) on failure.

The paths below are in-browser API routes. The Python planner has a separate HTTP endpoint at `/api/planner`.

- JSON in, JSON out. Trip and flight date fields use ISO formats, and labels are formatted for display.
- Supabase identifies the signed-in caller. The browser sends the Supabase access token to the Python planner.
- Group mutations resolve with the full updated `Group`. The delete and leave endpoints return JSON `null`.

## Error format

Every non-2xx response has this body:

```json
{ "code": "invite_not_found", "message": "This invitation link is not valid.", "fields": null }
```

`fields` is only set for `422` and maps a field name to a message:

```json
{ "code": "validation_failed", "message": "Some fields need attention.", "fields": { "name": "Enter a group name." } }
```

| HTTP | `code` | When |
|---|---|---|
| 401 | `unauthenticated` | No signed-in person |
| 403 | `invalid_invite_code` | The invite code belongs to a different group or a new member supplied the wrong code |
| 403 | `creator_required` | A member tried to delete a group they did not create |
| 404 | `group_not_found` | The group ID is unknown or the route requires membership the caller lacks |
| 404 | `invite_not_found` | Unknown invite code |
| 409 | `already_member` | Declining while already a member |
| 409 | `creator_cannot_leave` | A group creator tried to leave their own group |
| 422 | `validation_failed` | Invalid request body |
| 503 | `service_unavailable` | Temporary outage (the UI shows "Retry") |

The UI treats `invite_not_found` from `GET /invitations/:code`
as "This invitation isn't available".

## Shared types

### User

```json
{ "id": "33333333-3333-4333-8333-333333333333", "name": "Clara", "initial": "C", "airport": { "code": "PVG", "city": "Shanghai" } }
```

### Group (as seen by the signed-in person)

```json
{
  "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "name": "Tokyo together",
  "destination": "Tokyo, Japan",
  "datesLabel": "Nov 21–24, 2026",
  "code": "VFX37K",
  "inviteUrl": "https://cathay-together.vercel.app/invite/VFX37K",
  "creatorId": "11111111-1111-4111-8111-111111111111",
  "inviteCopied": false,
  "members": [
    { "userId": "11111111-1111-4111-8111-111111111111", "name": "Gaudi", "initial": "G", "airport": { "code": "HKG", "city": "Hong Kong" }, "status": "booked", "preferencesSaved": false }
  ],
  "viewerId": null,
  "viewerRole": "invitee",
  "invitation": "pending"
}
```

| Field | Notes |
|---|---|
| `members[].status` | `browsing`, `picked` or `booked` |
| `viewerId` | The signed-in user's id if they are a member, otherwise `null` |
| `members[].preferencesSaved` | Whether the member has saved their swipe choices |
| `viewerRole` | `creator`, `member` or `invitee` when a non-member previews the link |
| `invitation` | `pending` or `declined` for an invite preview. Members receive `null`. |
| `code` | Short invite code used in `/invite/:code` |
| `inviteUrl` | The current app origin followed by `/invite/:code` |

The UI never assumes who the viewer is: it reads `viewerId`, `viewerRole` and `creatorId`.

## Endpoints

### `GET /me`

Response `200`: a **User**.

### `GET /groups`

Groups the signed-in person has joined, newest first. Open an invitation link to preview a group before joining.

Response `200`:

```json
{ "groups": [ { "...": "Group" } ] }
```

### `POST /groups`

Creates a group; the caller becomes its creator and first member (`browsing`).

Request:

```json
{ "name": "Weekend in Tokyo", "destination": "Tokyo, Japan", "dates": "nov-21-24" }
```

Validation: `name` 1–30 characters; `destination` required (the demo accepts Tokyo only);
`dates` one of the available window ids (`nov-21-24`). Response `201`: a **Group**.
Errors: `422 validation_failed` with `fields`.

### `GET /date-windows`

Date windows a new group can use, with the lowest economy fare per day from the signed-in person's
airport. Feeds the "Select travel dates" sheet on Create group. The demo offers one window.

```json
{
  "origin": "HKG", "destination": "HND", "currency": "HKD",
  "windows": [{
    "id": "nov-21-24", "label": "Nov 21–24, 2026", "start": "2026-11-21", "end": "2026-11-24",
    "fares": [{ "date": "2026-11-21", "priceFrom": 5531 }, { "date": "2026-11-22", "priceFrom": 5863 }]
  }]
}
```

### `GET /groups/:id`

Returns a **Group** with status `200` for joined members. An unknown group or a caller outside the group receives `404 group_not_found`.

### `GET /invitations/:code`

A signed-in caller with a valid code receives a **Group** with status `200`, including when they have already joined. An unknown code returns `404 invite_not_found`.

### `POST /groups/:id/join`

Request: `{ "inviteCode": "VFX37K" }`. Adds the caller as `browsing`, clears their invitation.
Idempotent for existing members. Response `200`: a **Group**.
Errors: `403 invalid_invite_code`.

### `POST /groups/:id/decline`

Send `{ "inviteCode": "VFX37K" }`. The app remembers the decline in the current tab until reload or sign-out. The caller can still join. The response is a **Group** with status `200`.

An unknown code returns `404 invite_not_found`. A valid code for a different group returns `403 invalid_invite_code`. A member who tries to decline receives `409 already_member`.

### `POST /groups/:id/invite-copied`

No body. Marks that a member copied the invite link (`inviteCopied: true`). Response `200`: a **Group**.
An unknown group or a caller outside the group receives `404 group_not_found`.

### `DELETE /groups/:id`

The creator permanently deletes the group. Memberships, flight picks, votes, simulated bookings and the itinerary are deleted with it. The invite link becomes invalid. Response `200` with JSON `null`.

A non-member or missing group returns `404 group_not_found`. A member who is not the creator receives `403 creator_required`.

### `DELETE /groups/:id/membership`

A member leaves the group. Their membership, flight picks, votes and simulated booking are deleted. The group, saved itinerary and other members' records stay available. The member can rejoin using a valid invite link. Response `200` with JSON `null`.

A non-member or missing group returns `404 group_not_found`. The creator receives `409 creator_cannot_leave`.

## Flight booking (Flow B)

Every endpoint requires sign-in and group membership. A caller outside the group receives `404 group_not_found`. The caller's
home airport comes from their profile; flights run between that airport and the group's destination,
on the group's dates. `GET` endpoints accept query strings. Prices are whole HKD.

Extra error codes:

| HTTP | `code` | When |
|---|---|---|
| 404 | `flight_not_found` | Unknown flight id, or a date with no flights |
| 422 | `date_unavailable` | `date` is not an available day for that direction |

### `GET /groups/:id/flights/search-form`

Prefilled "Book a trip" form. Response `200`:

```json
{
  "origin": { "code": "HKG", "city": "Hong Kong" },
  "destination": { "code": "HND", "city": "Tokyo" },
  "departDate": "2026-11-21", "returnDate": "2026-11-24",
  "departLabel": "Sat 21 Nov 2026", "returnLabel": "Tue 24 Nov 2026",
  "cabins": [{ "id": "economy", "label": "Economy" }],
  "passengers": "1 Adult"
}
```

### `GET /groups/:id/flights?direction=outbound|return&date=YYYY-MM-DD&cabin=economy|premium|business`

All parameters are optional. The defaults are `outbound`, the group’s first or last day for the direction, and `economy`.
Response `200`:

```json
{
  "direction": "outbound",
  "route": { "from": { "code": "HKG", "city": "Hong Kong" }, "to": { "code": "HND", "city": "Tokyo" } },
  "tripLabel": "Return", "rangeLabel": "(Sat) 21 Nov - (Tue) 24 Nov",
  "date": "2026-11-21", "cabin": "economy",
  "cabins": [{ "id": "economy", "label": "Economy", "delta": 0 }, { "id": "premium", "label": "Premium Economy", "delta": 8931 }],
  "dates": [{ "date": "2026-11-19", "label": "Thu, 19 Nov", "priceFrom": null }, { "date": "2026-11-21", "label": "Sat, 21 Nov", "priceFrom": 2482 }],
  "groupWindow": { "others": [{ "name": "Clara", "time": "16:15" }] },
  "flights": [{
    "id": "outbound-2026-11-21-CX548", "flightNo": "CX548", "from": "HKG", "to": "HND", "date": "2026-11-21",
    "departTime": "08:55", "arriveTime": "13:45", "arriveDate": "2026-11-21",
    "departAt": "2026-11-21T00:55:00Z", "arriveAt": "2026-11-21T04:45:00Z",
    "duration": "3h 50m", "operatedBy": null, "seatsLeft": null, "lowest": false,
    "economyPrice": 4845, "priceFrom": 4845, "carriers": ["CX"], "via": null,
    "segments": [{ "flightNo": "CX548", "from": "HKG", "to": "HND", "departTime": "08:55", "arriveTime": "13:45", "arriveDate": "2026-11-21" }],
    "timing": {
      "spreadMinutes": 150, "closest": true, "deltaMinutes": -150
    }
  }]
}
```

**Group timing.** `groupWindow.others` lists other members’ names and chosen arrival times for outbound or departure times for return. `timing.spreadMinutes` measures the group spread including the candidate flight. `closest` marks all candidates tied for the smallest spread. With exactly one other pick, `deltaMinutes` is the signed time difference. With no other picks, `timing` is null.

`dates[].priceFrom` is the lowest Economy fare that day, or `null` when the day is not available.
`priceFrom` on a flight already includes the cabin's `delta`. Errors: `422 date_unavailable`.

### `GET /groups/:id/flights/:flightId/fares?cabin=`

Fare types for one flight. Response `200`:

```json
{
  "direction": "outbound",
  "flight": { "id": "outbound-2026-11-21-548", "priceFrom": 6691 },
  "cabin": "economy",
  "cabins": [{ "id": "economy", "label": "Economy", "delta": 0 }],
  "fares": [{
    "id": "light", "name": "Light", "tagline": "Good value", "recommended": false, "price": 6691,
    "rows": { "seat": "For a fee", "baggage": "1x23kg", "changeFee": 1200, "cancelFee": 1400 }
  }],
  "comparison": [{ "group": "Baggage", "rows": [{ "label": "Check-in", "values": { "light": "1x23kg", "essential": "2x23kg", "flex": "2x23kg" } }] }],
  "upgrade": { "from": "light", "to": "essential" }
}
```

Fare ids are `light`, `essential`, `flex`. In `comparison`, a value is `true`/`false` (tick or cross), a number, or text.
Errors: `404 flight_not_found`.

### `GET /groups/:id/flights/selection`

The caller's chosen flights so far: `{ "outbound"?: Selection, "return"?: Selection }`.

### `PUT /groups/:id/flights/selection`

Send `{ "flightId": "outbound-2026-11-21-CX548", "cabin": "economy", "fare": "essential" }`.
Saves the choice for that flight's direction and returns the caller's outbound and return selection map with status `200`. When both
directions are chosen the caller's member status changes from `browsing` to `picked` (never from `booked`).
A **Selection** is `{ flightId, cabin, cabinLabel, fare, fareName, price, from, to, date, departTime, arriveTime, arriveDate, departAt, arriveAt, flightNo }`.
Errors include `404 flight_not_found`, `409 already_booked` and `422 validation_failed` (`fields.fare`).

## Group board and booking (Flow C)

Every endpoint requires sign-in and group membership. A caller outside the group receives `404 group_not_found`.
The handlers rebuild each selection from its stored offer ID, cabin, fare and member airport.

Extra error codes: `409 no_flights`, `409 already_booked`, `410 hold_expired`.

### `GET /groups/:id/board`

```json
{
  "group": { "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "name": "Tokyo together", "destination": "Tokyo, Japan", "datesLabel": "Nov 21–24, 2026" },
  "destination": { "code": "HND", "city": "Tokyo" },
  "summary": { "members": 1, "joined": 1, "picked": 0, "booked": 1 },
  "members": [{
    "userId": "11111111-1111-4111-8111-111111111111", "name": "Gaudi", "initial": "G", "airport": { "code": "HKG", "city": "Hong Kong" },
    "status": "booked", "isViewer": true, "hasFlights": true,
    "arrive": { "dateLabel": "Sat 21 Nov", "time": "13:45", "airport": "HND", "flightNo": "CX548" },
    "leave": { "dateLabel": "Tue 24 Nov", "time": "10:10", "airport": "HND", "flightNo": "CX543" }
  }],
  "timeline": {
    "arrivals": { "dateLabel": "Sat 21 Nov", "points": [{ "time": "13:45", "minutes": 29921145, "names": ["You"], "includesViewer": true }], "spanMinutes": 0 },
    "departures": { "dateLabel": "Tue 24 Nov", "points": [{ "time": "10:10", "minutes": 29925250, "names": ["You"], "includesViewer": true }], "spanMinutes": 0 }
  },
  "viewerAction": "booked"
}
```

The board lists joined members only. It puts the viewer first, then orders the remaining members by `booked`, `picked` and `browsing`. Both `summary.members` and `summary.joined` count joined members.

Timeline points group equal instants. Point `minutes` is the epoch minute shifted to Tokyo time. `spanMinutes` is the latest point minus the earliest, or zero with fewer than two points. `viewerAction` is `pick` until both directions are selected, then `book` until payment, then `booked`.

### `GET /groups/:id/booking`

The caller's trip: `{ status, outbound, return, total, hold, holdExpired, ticket, serverNow }`.
`outbound` and `return` are Selections (see flights). `total` is the sum of both prices.
`hold` is `{ expiresAt }` (epoch ms) or `null`.
`ticket` is `{ reference, ticketNumber, paidAt, total }` once paid.

### `POST /groups/:id/booking/start`

"Confirm and pay". Starts a 20-minute payment hold and returns the booking. Errors: `409 no_flights`, `409 already_booked`.

### `POST /groups/:id/booking/release`

"Change flight": gives up the hold. Returns the booking.

### `POST /groups/:id/booking/pay`

Simulated payment, no card data. Requires a live hold (`410 hold_expired` otherwise). Sets the caller's status to `booked`
and returns the booking with a `ticket`.

## Itinerary preferences (Flow D)

These routes require group membership. A caller outside the group receives `404 group_not_found`.

### `GET /groups/:id/preferences`

Response `200` contains the suggestions, the caller's choices and everyone's readiness. The app uses the trip's saved research deck. Trips already in progress at migration time keep the original deck. `?prepare=0` reads status and available cards without waiting for research, so booking screens stay accessible.

This legacy example shows one of the 11 place cards.

```json
{
  "group": { "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "name": "Tokyo together", "destination": "Tokyo, Japan", "datesLabel": "Nov 21–24, 2026" },
  "places": [{ "id": "food", "category": "Food", "name": "Tsukiji Outer Market", "area": "Tsukiji · Chuo City", "description": "…", "budget": "¥2,000–3,500", "savedNote": "¥2,000–3,500 est.", "duration": "1–1.5 hrs", "bestTime": "Morning", "tip": "…", "photo": "/assets/ab624.png", "thumb": "/assets/2c161.png", "alt": "…" }],
  "choices": { "food": "like", "scenery": "pass" },
  "saved": false,
  "counts": { "total": 11, "chosen": 2, "liked": 1, "passed": 1 },
  "readiness": [{ "userId": "11111111-1111-4111-8111-111111111111", "name": "Gaudi", "initial": "G", "airport": { "code": "HKG", "city": "Hong Kong" }, "isViewer": true, "isCreator": true, "ready": false }],
  "readyCount": 0,
  "itineraryBuilt": false
}
```

Legacy decks keep their existing IDs, including `food`, `scenery`, `culture` and `shopping`. Researched decks use stable `card_…` IDs for the life of the trip. A member is `ready` once they have saved. `itineraryBuilt` is `true` once the group's itinerary exists (Group details then shows "View itinerary").

Researched cards use a Tavily image when its description matches the place. `photoSource` and `photoSourceUrl` record the source when available. Bundled category photos cover unmatched or broken links. Older researched decks can refresh their photo fields in place, preserving their IDs and saved choices.

Researched cards can also carry `coordinates` as `{ lat, lon }` and a `coordinateSource` link. The server looks up each venue name with Geoapify's geocoding API (`GEOAPIFY_API_KEY`), keeps a result only when it lies near the destination and its name matches the venue, and otherwise leaves the point empty (the planner then assumes 30 minutes for that transfer). `coordinateSource` is `https://www.geoapify.com/` for these points, and the itinerary response's `usesGeoapify` and `usesOpenStreetMap` flags say which credits to show.

### `PUT /groups/:id/preferences/choices`

Request: `{ "placeId": "food", "choice": "like" }` (`like` or `pass`). Saves one choice and responds with the same body as the `GET`. Changing a choice after saving sets `saved` back to `false` until the member saves again. Errors: `422 validation_failed`.

### `POST /groups/:id/preferences/save`

No body. Needs every suggestion chosen, then marks the caller ready. Responds with the same body as the `GET`. Errors: `422 choices_incomplete`.

After commit, Supabase Realtime publishes a change to the trip's notification row. The row carries only an opaque ID, a trip ID and a revision. Row-level security limits delivery to signed-in trip members. The client quietly reloads readiness after an event or a reconnect. Visible pages still poll every five seconds to cover outages and shared changes other than a preference save.

## Itinerary (Flow E)

These routes require group membership. A caller outside the group receives `404 group_not_found`.

### `POST /groups/:id/itinerary/build`

No body. The planner builds a plan from the saved deck and every member’s saved swipes, or returns the existing plan when its fingerprint matches current members, votes and flight times. The screen can open a saved plan directly before calling this build route. It returns `422 not_ready` when anyone has yet to save, `422 nothing_to_plan` when nobody liked an activity, `409 planner_busy` when a job is already running and `409 planner_changed` if the inputs changed during generation. Provider failures can be retried. Responds with the same body as `GET`, with `builtBy: "ai"` for plans built by the shared planner.

The shared planner prioritizes activities liked by at least half the group and can schedule other liked activities when time permits. Unscheduled liked activities go to Maybe. The model proposes meals and free time. The itinerary displays the viewer’s own selected flights.

### `POST /api/planner` (shared transport)

The same-origin Python endpoint accepts `{ "groupId": "<uuid>", "action": "discover" | "plan" }` and a Supabase bearer token. It checks membership and reads trip inputs itself. `discover` persists one deck and its evidence. `plan` reads that deck, saved swipes, flight timestamps and budget, reviews the result and inserts or replaces the itinerary if the original trip inputs still match. Success returns `{ "ready": true }`.

### `GET /groups/:id/itinerary`

Example of a saved legacy plan.

```json
{
  "group": { "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "name": "Tokyo together", "destination": "Tokyo, Japan", "datesLabel": "Nov 21–24, 2026" },
  "members": 2,
  "days": [{
    "index": 1, "date": "2026-11-21", "weekday": "Sat", "label": "21 Nov", "longLabel": "21 November", "title": "Arrive & settle in",
    "items": [
      { "id": "flight-arrival", "kind": "flight-arrival", "slot": "Afternoon", "title": "Arrival", "from": "HKG", "to": "HND", "date": "2026-11-21", "departTime": "11:20", "arriveTime": "16:10", "flightNo": "CX500", "travelBefore": null },
      { "id": "suggested-ramen", "kind": "place", "source": "suggested", "slot": "Evening", "name": "Neighbourhood ramen", "area": "Near your hotel", "description": "…", "minutes": 60, "cost": 1500, "costLabel": "¥1,500", "thumb": "…", "photo": "…", "alt": "…", "travelBefore": { "minutes": 60, "text": "by train · airport to city" } },
      { "id": "place-culture", "kind": "place", "source": "voted", "placeId": "culture", "liked": 2, "total": 2, "…": "…" }
    ],
    "totals": { "cost": 2500, "allowance": 1000, "minutes": 120, "travelMinutes": 60 }
  }],
  "maybe": [{ "placeId": "food", "name": "Tsukiji Outer Market", "liked": 1, "passed": 1, "duration": "1–1.5 hrs", "savedNote": "¥2,000–3,500 est." }],
  "summary": { "places": 7, "voted": 1, "days": 4, "costPerPerson": 12000, "avgTravelMinutes": 45, "firstDate": "2026-11-21", "lastDate": "2026-11-24" },
  "builtAt": 1731100000000
}
```

`kind` is `flight-arrival`, `flight-departure`, `flight-missing` (the caller has not chosen that flight) or `place`. Costs and travel times are estimates. Legacy non-AI `cost` totals per day include a transport allowance (¥1,000 on the first and last day, ¥500 on others). Errors: `404 itinerary_not_built`.

New shared plans store `transfers` with a symmetric `between` matrix keyed by place ID or by a generic meal’s stop ID, with `fallbackMinutes` set to 30. The server gives venue estimates to the AI and resolves generic meals to district centres with Geoapify before reviewing the draft. The itinerary reads the same estimates into `travelBefore` and the daily travel total.

| Shared transfer | Estimated time |
| --- | --- |
| Both coordinates known, estimated street distance up to 1.2 km | Haversine distance × 1.3, at 5 km/h |
| Both known, estimated street distance over 1.2 km | Haversine distance × 1.3, at 25 km/h plus 10 min |
| One or both coordinates missing | 30 min |

Round up to the next five minutes, with a five-minute minimum. Check transfers between physical stops on the same day, after any intervening free-time block. Airport buffers are 90 minutes after the last arrival and three hours before the earliest departure. New AI plans have zero transport allowance. Transfer shortfalls appear as review warnings. The planner can try one revision and save the reviewed draft with the fewest errors. If no usable draft is available, the app offers **Try again**.

### `PUT /groups/:id/itinerary`

Request: `{ "days": [{ "date": "2026-11-22", "stopIds": ["place-culture", "suggested-ueno"] }] }`. Every day must be sent with its stops in the new order; leaving a stop out removes it. Flights cannot be moved. Responds with the same body as the `GET`, with totals recalculated. Errors: `422 validation_failed`.

### `GET /groups/:id/itinerary/stops/:stopId`

One place stop: `{ group, day: { index, label }, stop, votes }`. `votes` is `[{ userId, name, initial, isViewer, choice: "like" | "pass" | null }]` for a voted place, and `null` for a suggested one. Errors: `404 stop_not_found`.

## Notes for the backend

- `datesLabel` is a display string. Shared trip inputs also include the stored dates and flight instants.
- There is no decision deadline and no member limit.
- Cover photos are chosen in the UI by destination; add an `imageUrl` field if you want the server to own them.
- Flight numbers and scheduled times come from the bundled OAG snapshot. Fares, availability, holds and payments are simulated.
- Group timing no longer uses fixed demo times: members without a chosen flight are left out of the comparison.
