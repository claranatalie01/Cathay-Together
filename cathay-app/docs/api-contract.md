# API contract (Flow A: travel groups and invitations; Flow B: flight booking)

The front end talks to the backend only through `src/api/groups.js`, `src/api/flights.js` and `src/api/users.js`.
Those call `request(method, path, body)` in `src/api/http.js`. Today `request` is answered by an
in-browser mock (`src/api/mock/`, saved in `localStorage`). To use a real server, change only
`request()` to `fetch()` the endpoints below, with the same JSON, and throw an `ApiError`
(`src/api/errors.js`) for any non-2xx response.

- Base path: `/api` (prefix it in `request()`).
- JSON in, JSON out. Dates are display strings for now (see "Notes").
- The caller is identified by the session (cookie or bearer token). It is the "signed-in person".
- Mutations resolve with the full updated `Group`.

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
| 403 | `invalid_invite_code` | `inviteCode` does not match the group and the user was not invited |
| 403 | `not_a_member` | Action needs group membership |
| 404 | `group_not_found` | Unknown group id |
| 404 | `invite_not_found` | Unknown invite code |
| 409 | `already_member` | Declining while already a member |
| 422 | `validation_failed` | Invalid request body |
| 503 | `service_unavailable` | Temporary outage (the UI shows "Retry") |

The UI treats `invite_not_found` from `GET /invitations/:code`
as "This invitation isn't available".

## Shared types

### User

```json
{ "id": "clara", "name": "Clara", "initial": "C", "airport": { "code": "SHA", "city": "Shanghai" } }
```

### Group (as seen by the signed-in person)

```json
{
  "id": "tokyo-together",
  "name": "Tokyo together",
  "destination": "Tokyo, Japan",
  "datesLabel": "Nov 21–24, 2026",
  "code": "VFX37K",
  "inviteUrl": "https://flights.cathaypacific.com/share/VFX37K",
  "creatorId": "gaudi",
  "inviteCopied": false,
  "members": [
    { "userId": "gaudi", "name": "Gaudi", "initial": "G", "airport": { "code": "HKG", "city": "Hong Kong" }, "status": "booked" },
    { "userId": "kabe", "name": "Kabe", "initial": "K", "airport": { "code": "SIN", "city": "Singapore" }, "status": "picked" }
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
| `viewerRole` | `creator`, `member`, `invitee` (invited or opened the link, not a member) or `null` |
| `invitation` | For non-members: `pending`, `declined` or `null`. Always `null` for members |
| `code` | Short invite code used in `/invite/:code` |
| `inviteUrl` | The link shown and copied in the app |

The UI never assumes who the viewer is: it reads `viewerId`, `viewerRole` and `creatorId`.

## Endpoints

### `GET /me`

Response `200`: a **User**.

### `GET /groups`

Groups the person belongs to or has been invited to (members first, newest first).

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

Response `200`: a **Group**. Errors: `404 group_not_found`.
(A real server may return `403` unless the caller is a member or invitee; the UI treats
`viewerId: null` as "go to the invitation".)

### `GET /invitations/:code`

Preview of the group behind an invite link. Response `200`: a **Group**.
Errors: `404 invite_not_found`.
Already-members always get `200`.

### `POST /groups/:id/join`

Request: `{ "inviteCode": "VFX37K" }`. Adds the caller as `browsing`, clears their invitation.
Idempotent for existing members. Response `200`: a **Group**.
Errors: `403 invalid_invite_code`.

### `POST /groups/:id/decline`

Request: `{ "inviteCode": "VFX37K" }`. Records `invitation: "declined"` for the caller. The
caller can still join afterwards. Response `200`: a **Group**.
Errors: `403 invalid_invite_code`, `409 already_member`.

### `POST /groups/:id/invite-copied`

No body. Marks that a member copied the invite link (`inviteCopied: true`). Response `200`: a **Group**.
Errors: `403 not_a_member`.

## Flight booking (Flow B)

Every endpoint needs a signed-in **member** of the group (`403 not_a_member` otherwise). The caller's
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
  "passengers": "1 Adult",
  "groupWindow": { "hours": 1, "min": 1, "max": 6, "step": 1 }
}
```

`groupWindow` is the range of the "Group timing window" slider (hours).

### `GET /groups/:id/flights?direction=outbound|return&date=YYYY-MM-DD&cabin=economy|premium|business`

All parameters are optional (defaults: `outbound`, the group's first or last day, `economy`, `window=1`). `window` is the group timing window in hours (1 to 6).
Response `200`:

```json
{
  "direction": "outbound",
  "route": { "from": { "code": "HKG", "city": "Hong Kong" }, "to": { "code": "HND", "city": "Tokyo" } },
  "tripLabel": "Return", "rangeLabel": "(Sat) 21 Nov - (Tue) 24 Nov",
  "date": "2026-11-21", "cabin": "economy",
  "cabins": [{ "id": "economy", "label": "Economy", "delta": 0 }, { "id": "premium", "label": "Premium Economy", "delta": 8931 }],
  "dates": [{ "date": "2026-11-19", "label": "Thu, 19 Nov", "priceFrom": null }, { "date": "2026-11-21", "label": "Sat, 21 Nov", "priceFrom": 5531 }],
  "groupWindow": { "hours": 1, "others": [{ "time": "16:15" }] },
  "flights": [{
    "id": "outbound-2026-11-21-548", "flightNo": "CX548", "from": "HKG", "to": "HND", "date": "2026-11-21",
    "departTime": "08:55", "arriveTime": "13:45", "duration": "3h 50m", "operatedBy": null,
    "seatsLeft": 9, "lowest": false, "economyPrice": 6691, "priceFrom": 6691,
    "timing": {
      "within": false, "bucket": "2h", "overshootMinutes": 90
    }
  }]
}
```

**Group timing.** `groupWindow.others` are the other members' times for this direction: where they landed (outbound, `arriveTime` of their chosen outbound flight) or leave (return, `departTime` of their chosen return flight). Until a member has chosen, the mock uses a fixed demo time. Each flight's `timing` measures the whole group: the spread from the earliest to the latest time among the other members and this flight (landing for outbound, take-off for return). `within` is true when the spread is no more than the window; otherwise `overshootMinutes` is the spread minus the window and `bucket` is `15m`, `30m`, `1h`, `2h` or `more` (rounded up). No names are returned. `timing` is `null` when the caller is the only member.

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

Request: `{ "flightId": "outbound-2026-11-21-548", "cabin": "economy", "fare": "essential" }`.
Saves the choice for that flight's direction and responds `200` with the full selection object. When both
directions are chosen the caller's member status changes from `browsing` to `picked` (never from `booked`).
A **Selection** is `{ flightId, cabin, cabinLabel, fare, fareName, price, from, to, date, departTime, arriveTime, flightNo }`.
Errors: `404 flight_not_found`, `422 validation_failed` (`fields.fare`).

## Group board and booking (Flow C)

Every endpoint needs a signed-in member of the group (`403 not_a_member`). All values come from the flights
each member has chosen (`PUT /groups/:id/flights/selection`), so the board, Members page, flight results and
payment screens always agree. In the mock, members who are `picked` or `booked` in the seed data get real
choices generated from the same flight data (and older saved data is filled in on load).

Extra error codes: `409 no_flights`, `409 already_booked`, `410 hold_expired`.

### `GET /groups/:id/board`

```json
{
  "group": { "id": "tokyo-together", "name": "Tokyo together", "destination": "Tokyo, Japan", "datesLabel": "Nov 21–24, 2026" },
  "destination": { "code": "HND", "city": "Tokyo" },
  "summary": { "members": 3, "joined": 2, "picked": 1, "booked": 1 },
  "members": [{
    "userId": "gaudi", "name": "Gaudi", "initial": "G", "airport": { "code": "HKG", "city": "Hong Kong" },
    "status": "booked", "isViewer": true, "hasFlights": true,
    "arrive": { "dateLabel": "Sat 21 Nov", "time": "16:10", "airport": "HND", "flightNo": "CX500" },
    "leave": { "dateLabel": "Tue 24 Nov", "time": "15:35", "airport": "HND", "flightNo": "CX6321" }
  }],
  "timeline": {
    "arrivals": { "dateLabel": "Sat 21 Nov", "points": [{ "time": "16:10", "minutes": 970, "names": ["You"], "includesViewer": true }], "spanMinutes": 40 },
    "departures": { "dateLabel": "Tue 24 Nov", "points": [], "spanMinutes": 55 }
  },
  "viewerAction": "book"
}
```

`members` lists the viewer first, then booked, picked, browsing. People invited but not yet joined are listed with
`status: "invited"` and no flights, and count in `summary.members` (the group is everyone invited, not only those who joined).
`spanMinutes` is the latest minus the earliest time (0 with one point). `viewerAction` is `pick` (no flights yet), `book`, or `booked`.

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

Members only (`403 not_a_member`). Only Tokyo groups have suggestions (`404 no_suggestions` otherwise).

### `GET /groups/:id/preferences`

Response `200`: the four suggestions, the caller's choices and everyone's readiness.

```json
{
  "group": { "id": "tokyo-together", "name": "Tokyo together", "destination": "Tokyo, Japan", "datesLabel": "Nov 21–24, 2026" },
  "places": [{ "id": "food", "category": "Food", "name": "Tsukiji Outer Market", "area": "Tsukiji · Chuo City", "description": "…", "budget": "¥2,000–3,500", "savedNote": "¥2,000–3,500 est.", "duration": "1–1.5 hrs", "bestTime": "Morning", "tip": "…", "photo": "/assets/ab624.png", "thumb": "/assets/2c161.png", "alt": "…" }],
  "choices": { "food": "like", "scenery": "pass" },
  "saved": false,
  "counts": { "total": 4, "chosen": 2, "liked": 1, "passed": 1 },
  "readiness": [{ "userId": "gaudi", "name": "Gaudi", "initial": "G", "airport": { "code": "HKG", "city": "Hong Kong" }, "isViewer": true, "isCreator": true, "ready": true }],
  "readyCount": 1,
  "itineraryBuilt": false
}
```

Place ids are `food`, `scenery`, `culture`, `shopping`. A member is `ready` once they have saved. `itineraryBuilt` is `true` once the group's itinerary exists (Group details then shows "View itinerary").

### `PUT /groups/:id/preferences/choices`

Request: `{ "placeId": "food", "choice": "like" }` (`like` or `pass`). Saves one choice and responds with the same body as the `GET`. Changing a choice after saving sets `saved` back to `false` until the member saves again. Errors: `422 validation_failed`.

### `POST /groups/:id/preferences/save`

No body. Needs all four suggestions chosen, then marks the caller ready. Responds with the same body as the `GET`. Errors: `422 choices_incomplete`.

## Itinerary (Flow E)

Members only (`403 not_a_member`). Tokyo groups only (`404 no_suggestions` otherwise).

### `POST /groups/:id/itinerary/build`

No body. Builds (or rebuilds) the plan from every member's saved preferences. Errors: `422 not_ready` (`fields.waiting` lists who has not saved). Responds with the same body as the `GET`.

How it is built: a voted place is scheduled when more than half the group liked it; places with at least one like that miss that bar go to the Maybe list. The scheduled places fill the middle days' mornings. Stops tagged `source: "suggested"` only fill the days and carry no vote count. Day 1 starts with the caller's arrival flight and the last day ends with their departure flight (from their chosen flights).

### `GET /groups/:id/itinerary`

```json
{
  "group": { "id": "tokyo-together", "name": "Tokyo together", "destination": "Tokyo, Japan", "datesLabel": "Nov 21–24, 2026" },
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

`kind` is `flight-arrival`, `flight-departure`, `flight-missing` (the caller has not chosen that flight) or `place`. Costs are rough yen estimates (midpoints) and travel times are approximate. `cost` totals per day include a transport allowance (¥1,000 on the first and last day, ¥500 on others). Errors: `404 itinerary_not_built`.

### `PUT /groups/:id/itinerary`

Request: `{ "days": [{ "date": "2026-11-22", "stopIds": ["place-culture", "suggested-ueno"] }] }`. Every day must be sent with its stops in the new order; leaving a stop out removes it. Flights cannot be moved. Responds with the same body as the `GET`, with totals recalculated. Errors: `422 validation_failed`.

### `GET /groups/:id/itinerary/stops/:stopId`

One place stop: `{ group, day: { index, label }, stop, votes }`. `votes` is `[{ userId, name, initial, isViewer, choice: "like" | "pass" | null }]` for a voted place, and `null` for a suggested one. Errors: `404 stop_not_found`.

## Notes for the backend

- `datesLabel` is a display string today. Send ISO 8601 dates later and format them in the UI.
- There is no decision deadline and no member limit.
- Cover photos are chosen in the UI by destination; add an `imageUrl` field if you want the server to own them.
- Flights and fares are fictional demo data generated from the traveller's airport and the group's window. A real server owns schedules and fares.
- Later flows (preferences, itinerary) will extend this contract.
- Group timing no longer uses fixed demo times: members without a chosen flight are left out of the comparison.
- `src/demo` calls the mock database directly (switch person, add members, force errors). None of it
  maps to a real endpoint.
