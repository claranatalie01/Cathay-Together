# Cathay Together data dictionary

This describes the schema after all seven migrations, the records assembled by the app, and the fixture data bundled with it. See [Architecture](ARCHITECTURE.md) for the flows and algorithms.

## Schema sources

| Migration | Effect |
| --- | --- |
| [`20261111000000_initial_schema.sql`](supabase/migrations/20261111000000_initial_schema.sql) | Creates airports, profiles, groups, memberships, flight selections, votes, and their access rules. |
| [`20261111010000_group_functions.sql`](supabase/migrations/20261111010000_group_functions.sql) | Adds the six group and invitation RPCs. |
| [`20261111020000_more_airports.sql`](supabase/migrations/20261111020000_more_airports.sql) | Adds airport coordinates and seven home airports. |
| [`20261112000000_booking_preferences_itinerary.sql`](supabase/migrations/20261112000000_booking_preferences_itinerary.sql) | Adds bookings, itineraries, five RPCs, the vote trigger, and the current group JSON. |
| [`20261112010000_remove_groups.sql`](supabase/migrations/20261112010000_remove_groups.sql) | Adds creator deletion and member leave RPCs. |
| [`20261112020000_researched_itineraries.sql`](supabase/migrations/20261112020000_researched_itineraries.sql) | Adds researched decks and planner RPCs, preserves legacy votes, validates saved preferences against the stored deck and moves generated itinerary inserts to the service role. |
| [`20261112030000_rebuild_itineraries.sql`](supabase/migrations/20261112030000_rebuild_itineraries.sql) | Allows the planner to replace a stale saved itinerary. |

The nine tables below are in `public`. Supabase manages `auth.users`. The app references `auth.users.id` and the optional [demo seed](supabase/seed/demo_profiles.sql) matches accounts using `auth.users.email`. Column nullability below is explicit. A primary key is required and unique, including when it spans multiple columns.

## Tables and relationships

### `airports`

One reference row per airport. The migrations seed HKG, SHA, SIN, HND, PVG, TPE, ICN, MNL, BKK, KUL and CAN. Welcome offers the home-airport list without HND, the demo destination.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `code` | `text` | No | Primary key. Three uppercase letters. |
| `city` | `text` | No | Display city. |
| `time_zone` | `text` | No | IANA time zone name, such as `Asia/Tokyo`. |
| `latitude` | `numeric(8,5)` | No | Degrees in [−90, 90]. |
| `longitude` | `numeric(8,5)` | No | Degrees in [−180, 180]. |

### `profiles`

One display profile per Supabase account. Welcome creates the row on first sign-in if needed.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `id` | `uuid` | No | Primary key and foreign key to `auth.users(id)`, cascading on deletion. |
| `display_name` | `text` | No | 1–40 characters. |
| `home_airport` | `text` | No | Foreign key to `airports(code)`. |
| `created_at` | `timestamptz` | No | Defaults to `now()`. |

### `groups`

One row per trip. The app's demo date restriction is implemented in the handler. The table checks only that the end is on or after the start.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `id` | `uuid` | No | Primary key. Defaults to `gen_random_uuid()`. |
| `name` | `text` | No | 1–30 characters. |
| `destination_airport` | `text` | No | Foreign key to `airports(code)`. Defaults to `HND`. |
| `start_date` | `date` | No | First calendar date of the trip. |
| `end_date` | `date` | No | Last calendar date of the trip. Must be on or after `start_date`. |
| `creator_id` | `uuid` | No | Foreign key to `profiles(id)`. |
| `invite_code` | `text` | No | Unique. Six uppercase alphanumeric characters. |
| `invite_copied` | `boolean` | No | Defaults to `false`. Records whether a member copied the link. |
| `budget_per_person_jpy` | `integer` | No | Defaults to `15000`. Nonnegative. The shared planner checks estimated activities and meals against it. |
| `created_at` | `timestamptz` | No | Defaults to `now()`. |

### `group_members`

Joins profiles to groups. The primary key is `(group_id, user_id)`, and `group_members_user_id_idx` supports lookups by user. Booking and selection rows determine member status. There is no stored status column.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `group_id` | `uuid` | No | Foreign key to `groups(id)`, cascading on deletion. |
| `user_id` | `uuid` | No | Foreign key to `profiles(id)`, cascading on deletion. |
| `joined_at` | `timestamptz` | No | Defaults to `now()`. |
| `preferences_saved_at` | `timestamptz` | Yes | Timestamp of the last save. Null means the member is awaiting completion or has changed a vote since saving. |

### `flight_selections`

One choice per member and direction. Primary key `(group_id, user_id, direction)`. The pair `(group_id, user_id)` references `group_members(group_id, user_id)` with cascading deletion. The handler stores the chosen fields and rebuilds the displayed leg from the current snapshot on read.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `group_id` | `uuid` | No | Membership key component. |
| `user_id` | `uuid` | No | Membership key component. |
| `direction` | `text` | No | `outbound` or `return`. |
| `offer_id` | `text` | No | ID generated by the flight builder. No catalogue foreign key. |
| `flight_no` | `text` | No | Flight number or two joined with ` + ` for a connection. |
| `cabin` | `text` | No | `economy`, `premium` or `business`. |
| `fare` | `text` | No | `light`, `essential` or `flex`. |
| `depart_at` | `timestamptz` | No | First segment's departure instant. |
| `arrive_at` | `timestamptz` | No | Last segment's arrival instant. Must be later than `depart_at`. |
| `price_minor` | `integer` | No | Nonnegative fare in currency minor units. App writes whole HKD × 100. |
| `currency` | `text` | No | Three uppercase letters. Defaults to `HKD`. |
| `selected_at` | `timestamptz` | No | Defaults to `now()`. The app upsert omits this column. |

### `votes`

One swipe per member and place. Primary key `(group_id, user_id, place_id)`. The pair `(group_id, user_id)` references the membership with cascading deletion. The trigger `votes_unsave_preferences` calls `private.unsave_preferences()` after insert, update or delete to clear the affected member's saved timestamp.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `group_id` | `uuid` | No | Membership key component. |
| `user_id` | `uuid` | No | Membership key component. |
| `place_id` | `text` | No | 1–40 characters. The app checks the ID against its curated catalogue. |
| `choice` | `text` | No | `like` or `pass`. |
| `updated_at` | `timestamptz` | No | Defaults to `now()`. The shared handler supplies an ISO timestamp on upsert. |

### `bookings`

At most one booking row per group member. Primary key `(group_id, user_id)`, also a foreign key to the membership with cascading deletion. The table requires `paid_at`, `reference`, `ticket_number` and `total_minor` to be either all null or all present.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `group_id` | `uuid` | No | Membership key component. |
| `user_id` | `uuid` | No | Membership key component. |
| `hold_expires_at` | `timestamptz` | Yes | Database-clock expiration. Null indicates no hold. |
| `paid_at` | `timestamptz` | Yes | Simulated payment time. |
| `reference` | `text` | Yes | Generated six-character uppercase alphanumeric reference. |
| `ticket_number` | `text` | Yes | Simulated ticket number. Shared RPC generates `160 ` followed by ten digits. |
| `total_minor` | `integer` | Yes | Nonnegative paid total. The RPC sums stored selection prices. |
| `currency` | `text` | No | Three uppercase letters. Defaults to `HKD`. |

### `itineraries`

One saved plan per group. The planner inserts or replaces the full plan. A browser edit updates the existing row. The schema checks the top-level JSON type.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `group_id` | `uuid` | No | Primary key and foreign key to `groups(id)`, cascading on deletion. |
| `plan` | `jsonb` | No | Must be a JSON object. See [stored plan](#stored-plan-and-rendered-itinerary). |
| `updated_by` | `uuid` | No | Foreign key to `profiles(id)`. For browser edits, RLS requires the caller’s user ID. |
| `updated_at` | `timestamptz` | No | Defaults to `now()`. The browser edit supplies an ISO timestamp. The planner uses the database clock. |

### `group_place_decks`

One stable deck per group. The migration marks trips with existing votes, saved preferences or itineraries as legacy so their original card IDs stay valid.

| Column | Type | Null | Default, relationship or constraint |
| --- | --- | --- | --- |
| `group_id` | `uuid` | No | Primary key and foreign key to `groups(id)`, cascading on deletion. |
| `legacy` | `boolean` | No | Defaults to false. Legacy decks use the bundled place IDs. |
| `places` | `jsonb` | Yes | A nonempty array when set. Shared cards include stable IDs, display fields, citations, photo metadata and optional `coordinates: { lat, lon }` and `coordinateSource`. |
| `sources` | `jsonb` | No | Array of research evidence. Defaults to `[]`. |
| `job_token` | `uuid` | Yes | Current planner lease token. |
| `job_until` | `timestamptz` | Yes | Lease expiry. The claim RPC allows 310 seconds. |

## Direct table access

All nine tables have RLS enabled. The migrations revoke app table privileges from `anon` and grant table privileges to `service_role`. The signed-in browser uses `authenticated` and its access is as follows.

| Table | Direct reads | Direct writes |
| --- | --- | --- |
| `airports` | Any signed-in user | None |
| `profiles` | Own profile and profiles of users who share a group | Insert and update own profile |
| `groups` | Group members | None. Creation and invite-copy changes use RPCs. |
| `group_members` | Group members | None. Group creation, joins, preference saves and the vote trigger maintain memberships and readiness. |
| `flight_selections` | Group members | Insert and update own rows with valid membership. Delete own rows. The app upserts selections. The DB does not check against the OAG catalogue or lock rows after payment. |
| `votes` | Group members | Insert and update own rows with valid membership. Delete own rows. The app upserts swipes. |
| `bookings` | None | None. Booking access is exclusively through RPCs in the app. |
| `itineraries` | Group members | Update an existing group row with `updated_by = auth.uid()`. The planner service inserts generated plans. |
| `group_place_decks` | Group members can read `group_id`, `legacy` and `places`. | Service role only. |

[`private.is_member()` and `private.shares_group()`](supabase/migrations/20261111000000_initial_schema.sql) implement the membership checks used by RLS. Invitations are represented by the group code and membership in shared mode. There is no invitations table.

## Public RPCs

Each browser-callable function below uses `SECURITY DEFINER` with an empty search path. Execute is granted to `authenticated` and `service_role` and revoked from `PUBLIC` and `anon`. The functions use `private.caller_id()` to resolve the signed-in account and require a profile. The booking and preference functions additionally call `private.member_id()` to require membership.

| RPC signature | Return | Reads, writes and checks |
| --- | --- | --- |
| `list_my_groups()` | `jsonb` array | Caller's memberships only. Newest groups first, with group ID as a tie-break. |
| `get_group(target_group uuid)` | Group `jsonb` | Requires membership. Otherwise raises `group_not_found`. |
| `preview_invitation(code text)` | Group `jsonb` | Trims and uppercases the code. A signed-in caller with a profile and a valid code can see group and member summaries before joining. Invalid code raises `invite_not_found`. |
| `create_group(group_name text, trip_start date, trip_end date)` | Group `jsonb` | Validates trimmed name and date order, generates a code, and inserts the group and creator membership atomically. |
| `join_group(target_group uuid, code text)` | Group `jsonb` | Checks that the group exists, then checks the normalized code and inserts a membership for a new member. An existing member gets the group back unchanged. |
| `mark_invite_copied(target_group uuid)` | Group `jsonb` | A member sets the group's `invite_copied` flag to true. |
| `delete_group(target_group uuid)` | `void` | Creator only. Deletes the trip and its dependent records. |
| `leave_group(target_group uuid)` | `void` | Joined member only. Removes that member’s membership and its dependent rows. The creator uses deletion. |
| `get_booking(target_group uuid)` | Booking `jsonb` | Returns the caller's record and database time. A member without a booking gets null booking fields. |
| `start_booking(target_group uuid)` | Booking `jsonb` | Requires both selections and an unpaid trip. Starts a 20-minute hold or keeps an existing live hold. |
| `release_booking(target_group uuid)` | Booking `jsonb` | Clears the caller's hold for an unpaid booking. |
| `pay_booking(target_group uuid)` | Booking `jsonb` | Requires both selections, an unpaid trip and a live hold. Sums stored prices, writes simulated payment fields and clears the hold. |
| `save_preferences(target_group uuid, place_ids text[])` | `void` | Requires a vote for every researched deck ID, then updates `preferences_saved_at`. For a legacy deck it uses the supplied list and requires at least one ID. |

### Planner RPCs

These functions grant execute only to `service_role`. The Python endpoint authenticates the caller and verifies group membership before using them.

| RPC | Return | Role in planning |
| --- | --- | --- |
| `trip_planner_inputs(target_group uuid)` | `jsonb` | Reads destination, timezone, dates, budget, members, votes and flight selections. Arrays have stable ordering. |
| `claim_trip_planner_job(target_group uuid, viewer uuid, token uuid)` | `boolean` | Checks membership and claims an unoccupied or expired group lease. |
| `finish_trip_planner_job(target_group uuid, viewer uuid, token uuid, operation text, result jsonb, expected_inputs jsonb default null)` | `boolean` | Checks lease and membership. Discovery fills an empty researched deck. Planning compares the input snapshot, then inserts or replaces the group itinerary. |

## JSON payloads

The shapes below come from the current handlers. Dates use `YYYY-MM-DD`, display times use `HH:MM`, and flight instants are ISO timestamp strings. Booking times and `builtAt` use Unix epoch milliseconds. The app uses whole HKD for displayed flight prices and integer JPY for activity estimates. SQL flight and booking prices use minor units.

### Profiles and groups

- **Current user** from `GET /me` or `PUT /me` is `{ id, name, initial, airport: { code, city } }`. The profile write takes `{ name, airport }` with an airport code string. The shared airport endpoint returns `{ airports: [{ code, city, lat, lon }] }`.
- **Group RPC JSON** from `private.group_json()` is `{ id, name, destinationAirport, startDate, endDate, code, creatorId, inviteCopied, createdAt, isMember, members }`. A member is `{ userId, name, airport: { code, city }, status, preferencesSaved }`. SQL derives `booked` from payment, `picked` from both flight rows, and `browsing` otherwise. `list_my_groups()` returns an array of these objects.
- **App group** is `{ id, name, destination, datesLabel, code, inviteUrl, creatorId, inviteCopied, members, viewerId, viewerRole, invitation }`. Members add `initial`. Shared members also include `preferencesSaved`. `viewerRole` can be `creator`, `member` or `invitee`, and mock can return null. The invitation is `pending`, `declined` or null. The create request is `{ name, destination, dates }` with `dates` as a window ID. Join and decline requests take `{ inviteCode }`. Sources include [shared `toGroup()`](src/api/shared/handlers.js) and [mock `serialize()`](src/api/mock/handlers.js).
- **Trip date options** from `GET /date-windows` are `{ origin, destination, currency, windows: [{ id, label, start, end, fares: [{ date, priceFrom }] }] }`. Origin and destination are airport codes and currency is `HKD`. A date's price is the lowest generated outbound Economy fare or null if unavailable. The only window ID is `nov-21-24`.

### Flights and suggestions

| Payload | Fields and meaning |
| --- | --- |
| Flight search form | `{ origin, destination, departDate, returnDate, departLabel, returnLabel, cabins, passengers }`. Airports are `{ code, city }`, cabins are `[{ id, label }]` and the passenger label is `1 Adult`. |
| Flight results | `{ direction, route: { from, to }, tripLabel, rangeLabel, date, cabin, cabins, dates, groupWindow, flights }`. Route endpoints are airport objects. `cabins[]` holds `{ id, label, delta }` and `dates[]` holds `{ date, label, priceFrom }` with a nullable price. `groupWindow` carries `others: [{ name, time }]`. |
| Flight offer | `{ id, flightNo, from, to, date, departTime, arriveTime, arriveDate, departAt, arriveAt, duration, operatedBy, seatsLeft, lowest, economyPrice, priceFrom, carriers, via, segments }`. `from` and `to` are airport codes. `via` is null for direct journeys or `{ airport, layoverMinutes, layoverLabel }`. Each segment is `{ flightNo, from, to, departTime, arriveTime, arriveDate }`. Results also add nullable `timing: { spreadMinutes, closest, deltaMinutes }`. `deltaMinutes` is signed and is available with exactly one other pick. |
| Fare details | `{ direction, flight, cabin, cabins, fares, comparison, upgrade }`. Each fare is `{ id, name, tagline, recommended, price, rows: { seat, baggage, changeFee, cancelFee } }`. The comparison groups labeled rows with values keyed by fare ID. The upgrade uses `{ from: 'light', to: 'essential' }`. |
| Saved selection | The app writes `{ flightId, cabin, fare }`. `makeSelection()` expands it to `{ flightId, cabin, cabinLabel, fare, fareName, price, from, to, date, departTime, arriveTime, arriveDate, departAt, arriveAt, flightNo }`. Reads and writes return the member's `{ outbound?, return? }` map. |
| Group suggestions | `{ direction, date, cabin, combinations, featured, others, viewerId }`. Entries have `{ total, spreadMinutes, picks }`. Featured entries add `labels` containing `cheapest`, `closest` and/or `balanced`. Each pick is `{ userId, name, airport, flightId, flightNo, time, nextDay, stops, price, extra, fixed, cabinLabel }`. `cabinLabel` is nullable for unpicked members. |

Sources include [`flightData.js`](src/api/mock/flightData.js), [`realFlights.js`](src/api/mock/realFlights.js), and the [shared flight handlers](src/api/shared/handlers.js).

### Board, booking and swipes

- **Board** from `boardFor()` is `{ group, destination, summary, members, timeline, viewerAction }`. Here and in the preference and itinerary payloads, the compact group is `{ id, name, destination, datesLabel }`. The summary counts `members`, `joined`, `picked` and `booked`. A board member has `{ userId, name, initial, airport, status, isViewer, hasFlights, arrive, leave }`. Each leg summary is null or `{ dateLabel, time, airport, flightNo }`. `timeline.arrivals` and `timeline.departures` each contain `{ dateLabel, points: [{ time, minutes, names, includesViewer }], spanMinutes }`. Point `minutes` uses the epoch-minute position shifted to Tokyo time. `viewerAction` is `pick`, `book` or `booked`.
- **Booking RPC JSON** is `{ holdExpiresAt, paidAt, reference, ticketNumber, totalMinor, serverNow }`. The first five fields are nullable. **App booking** from `bookingFor()` is `{ status, outbound, return, total, hold, holdExpired, ticket, serverNow }`. `hold` is null or `{ expiresAt }`, and `ticket` is null or `{ reference, ticketNumber, paidAt, total }`. The displayed booking `total` sums rebuilt leg prices. The shared ticket `total` converts the stored `totalMinor` to HKD.
- **Preferences** from `responseFor()` is `{ group, places, choices, saved, counts, readiness, readyCount, itineraryBuilt }`. The swipe write takes `{ placeId, choice }`. `choices` maps the viewer's place IDs to `like` or `pass`. `counts` has `total`, `chosen`, `liked` and `passed`. Each readiness row is `{ userId, name, initial, airport, isViewer, isCreator, ready }`. `votesFor()` builds `{ [placeId]: { votes, liked, passed, total } }`, where votes contain `{ userId, name, choice }` and a null choice indicates no saved answer. The denominator includes every group member.

Sources include [`boardHandlers.js`](src/api/mock/boardHandlers.js), [`preferenceHandlers.js`](src/api/mock/preferenceHandlers.js), and [`itineraryData.js`](src/api/mock/itineraryData.js).

### Stored plan and rendered itinerary

| Plan field | Shape |
| --- | --- |
| `days` | `[{ date, title, stopIds }]`. Stop IDs reference keys in `stops`. |
| `stops` | Object keyed by stop ID. Each record has `{ id, kind: 'place', source, slot, name, area, description, minutes, cost, costLabel, photo, thumb, alt, start, end, startTime, endTime }`. Voted stops add `placeId`, `durationLabel`, `liked` and `total` and use `place-<id>`. Suggested stops add `suggestedId`. Mock fillers use `suggested-<id>`. Shared generic meals use `meal-<date>-<meal>` with an `x` suffix on collisions, and free time uses `free-<date>-<minute>`. `start` and `end` are trip minutes since midnight Tokyo time on day one. |
| `maybe`, `didNotFit` | Arrays of place IDs. Shared `maybe` includes any liked place left out. Mock `maybe` includes minority picks with a like and winners that did not fit. Mock `didNotFit` contains those unplaced winners. |
| `free` (mock) | `{ freeFrom, freeUntil }` in trip minutes. Either value can be null for an open boundary. |
| `problems` (mock) | Array of strings from `checkPlan()` at generation time. |
| `builtAt` | Build timestamp in epoch milliseconds, from the browser in mock and the server in shared mode. |
| `builtBy`, `fingerprint` (shared AI) | `builtBy: 'ai'` and a fingerprint of current member IDs, vote choices and selected flight instants. |
| `transfers` (shared AI) | `{ between, fallbackMinutes, usesOpenStreetMap, usesGeoapify }`. The symmetric table is keyed by place IDs or generic meal stop IDs. Missing pairs use 30 minutes. |
| `sources`, `review` (shared AI) | Cited source summaries `[{ id, title, url }]` and `{ approved, summary, issues, suggestions, attempts }`. An issue includes `severity`, `day`, `message` and `suggested_fix`. |

The edit request is `{ days: [{ date, stopIds }] }`. It references existing stops and supplies every trip day. On read, `bodyFor()` and `assemble()` return `{ group, members, builtAt, days, maybe, summary }`, with optional `builtBy`, `usesOpenStreetMap` and `usesGeoapify` for shared AI plans. Rendered days have `{ index, date, weekday, label, longLabel, title, items, totals }`. Items are place stops or viewer-specific flight cards or placeholders, with a nullable `travelBefore: { minutes, text }`. Day totals are `{ cost, allowance, minutes, travelMinutes }`. The summary has `{ places, voted, days, costPerPerson, avgTravelMinutes, firstDate, lastDate }`. Maybe entries add display data and vote counts. A stop-detail response adds a day label and vote rows with viewer flags and initials. Sources include [`itineraryHandlers.js`](src/api/mock/itineraryHandlers.js) and [`itineraryData.js`](src/api/mock/itineraryData.js).

## Bundled data and mock storage

| Source | Record or builder |
| --- | --- |
| [`oagSnapshot.json`](src/data/oagSnapshot.json) | `{ source, fetchedAt, carriers, note, flights }`. Each OAG segment is `{ flightNo, carrier, from, to, departLocal, arriveLocal, departAt, arriveAt, minutes }`. Local date-time strings lack an offset and the paired instants are UTC ISO strings. [`fetch-oag.mjs`](scripts/fetch-oag.mjs) keeps scheduled nonstop passenger segments and deduplicates by flight number and departure instant. |
| [`connections.js`](src/algorithms/connections.js) and [`realFlights.js`](src/api/mock/realFlights.js) | `buildJourneys()` joins schedule segments. `realJourneys()` creates offers with IDs in the form `<direction>-<date>-<flightNo>[_<flightNo>]`. It sets synthetic seat counts and sums deterministic segment prices. A segment price is `round((380 + 19 × minutes) × carrierFactor × wobble × dayFactor)`. The carrier factor is 1 for CX and 0.55 for UO. Wobble is `0.92 + (hash(flightNo) % 17) / 100`. |
| [`flightData.js`](src/api/mock/flightData.js) | `flightsFor()` adds cabin deltas based on the traveller's airport. `faresFor()` uses that price for Light, adds HKD 450 for Essential and adds HKD 1,600 to Light for Flex. The generated catalogue is bundled in both modes. Supabase persists each member's choices. |
| [`placeData.js`](src/api/mock/placeData.js) | `PLACES` contains 11 records with `id`, `category`, `name`, `area`, `description`, `visitMinutes`, `open`, `close`, `cost`, `budget`, `savedNote`, `duration`, `bestTime`, `tip`, `photo`, `thumb` and `alt`. Costs and scheduling hours are curated estimates. `PLACE_IDS` derives from this list and `SEED_CHOICES` supplies mock votes. |
| [`placeGeo.js`](src/data/placeGeo.js) | `PLACE_GEO[placeId]` contains `lat`, `lon`, an OpenStreetMap object ID in `osm`, nullable `osmHours`, and optional `closedWeekdays` and `note`. The itinerary uses the coordinates and encoded closures. © OpenStreetMap contributors. |
| [`db.js`](src/api/mock/db.js) | Local storage key `cathay-mock-db-v4` holds `{ session: { currentUserId }, groups }`. Mock groups store slug IDs, trip labels, a code, member status and invitation entries, and can carry `selections`, `bookings`, `preferences` and `itinerary`. Preferences map user IDs to `{ choices, saved }`, and mock bookings map user IDs to hold and ticket records. The seed starts with Gaudi (HKG), and the demo controls also offer Clara (PVG) and Kabe (SIN). |
