# Cathay Together — Technical Development Plan

Updated: 10 November 2026 · Event: 14–15 November 2026 · All times: Hong Kong (GMT+8).

Build the smallest shared travel-planning demo that proves three friends can coordinate flights and create an itinerary together. Keep the existing React interface and replace browser-only state with a shared backend.

This is the active technical roadmap. The previous frontend plan is preserved unchanged in [docs/frontend-plan-archive.md](docs/frontend-plan-archive.md). Its completed work remains valid; its frontend-only scope describes the previous stage. Future implementation should follow this roadmap, `CLAUDE.md`, and `docs/design-system.md`; confirm stale documentation against the actual code.

**Progress:** `[x]` verified existing capability or completed task; `[ ]` outstanding. **P0** = required for the core demo; **P1** = supporting work after P0; **P2** = defer. Planning a task does not mean it has been implemented or tested.

**Why and how:** the algorithms, data, services and backend are explained in plain language, with worked examples, in [docs/technical-guide.md](docs/technical-guide.md).

## 0. Your to-do summary (start here)

A short, ordered list of everything you need to do. Each item points to the section with the detail. Added 10 November 2026.

### Before Saturday

Do item 1 first. Items 3 to 6 are only allowed if the answer to item 1 permits preparation.

- [ ] 1. Ask the organisers (hackathon@cathaypacific.com) whether the existing prototype may be reused and what preparation is allowed before 11:00 on 14 November. See PRE-01.
- [ ] 2. Ask your teammates whether the AWS, GCP or GitHub Copilot request form was submitted. If not, the team must visit the Tech Help Desk before 14:00 on Saturday.
- [ ] 3. Register at developers.oag.com, click "Try it" on the Flight Info API, and run one test query: Cathay (`CX`) from `HKG` to `HND` on 2026-11-21. Save the response. See PRE-02 and the technical guide, section 5.
- [x] 4. Create a free Supabase account and confirm it is reachable. Whether you may use it is one of the questions in PRE-02. *Done 11 November: organisation and project "Cathay Together" created on the Free plan in Singapore, no GitHub connection. Still open: whether the organisers allow it.*
- [ ] 5. Check that the current demo runs on your laptop without internet (`npm run dev`), and record a short fallback video. See PRE-03.
- [ ] 6. Collect the real opening times of the four Tokyo places for 21–24 November from their official sites. See DATA-01.
- [ ] 7. Settle the open decisions below with your team.
- [ ] 8. Give each workstream an owner: backend, algorithms and data, frontend integration, pitch and submission. See PRE-01.
- [ ] 9. Read the technical guide, sections 1, 3 and 9. Make sure you can explain "timestamp", "backend" and "spread" in your own words. See PRE-03.
- [ ] 10. Pack: HKID or travel document, laptop, chargers, adapters, toiletries, a change of clothes and any medication.

### Open decisions

| # | Decision | Current plan | Mentor's suggestion |
| --- | --- | --- | --- |
| D1 | Flight data | Fictional direct flights for all three travellers | If the OAG test in item 3 works, save a real schedule snapshot once and label it. Keep prices fictional |
| D2 | Shanghai and Singapore routes | Direct to Tokyo | Check in OAG whether Cathay's real routes connect through Hong Kong. If so, decide whether to show connections |
| D3 | Vote rule | Strict majority; minority picks go to "Maybe" (DEV-04) | Optional: add one labelled "minority pick". See the technical guide, section 3B |
| D4 | Number of places | **Decided 11 November: 11 places** (the four originals plus seven) | With four places almost everything fits, so votes decide little. Consider about 12 if time allows |
| D5 | Where our API runs | One Supabase Edge Function | Keep it, but test in the first hour that it can use the algorithm files. Fallback: Vercel functions |

### Saturday 14 November

- [ ] 09:10 check-in at the Cathay City main entrance. Development starts at 11:00.
- [ ] Before 14:00: Tech Help Desk, if cloud resources are not set up.
- [ ] Before 17:30: put the questions in PRE-02 and the technical guide, section 8, to the SME Help Desk. It does not reopen on Sunday.
- [ ] Book the pitching workshop (14:00–15:30) and showers through the hackathon portal if wanted.
- [ ] Build in this order: DEV-01, DATA-01, DEV-02, DEV-03, DEV-04, DEV-05, DEV-06. Prove two devices in one group before anything else.
- [ ] The General and Tech Help Desk closes from 21:00 to 08:00. Ask anything blocking before then.

### Sunday 15 November

- [ ] 06:00 feature freeze. Rehearse the five-minute pitch.
- [ ] By 08:45 email the one-pager. The hard deadline is 09:00.
- [ ] By 10:40 submit the prototype link, the repository link and the slides PDF through the portal. The hard deadline is 11:00.
- [ ] 10:55 be in Room 410 for the First Pitch: 5 minutes to present, 5 minutes of questions.

Missing either deadline removes the team from the First Pitch. The full schedule is in section 6.

## 1. Target demo and scope

### P0: must work for real

- [ ] Two authenticated users on separate devices create/join the same group and see shared changes.
- [ ] Each member selects flights from their own origin; comparisons use complete timestamps.
- [ ] The board shows the same selections and timing results on both devices.
- [ ] Saved likes/passes change the generated group itinerary.
- [ ] Shared activities fit group availability, opening windows, travel time, duration, and the demo budget.
- [ ] Reloading the app preserves shared state; a non-member cannot read or change private trip data.

### Demo defaults

- Destination: Tokyo; destination airport: HND only.
- Three travellers: Gaudi/HKG, Clara/PVG (Shanghai Pudong; changed from SHA on 12 Nov because Cathay has about ten flights a day from PVG and one from SHA), Kabe/SIN, using separate demo accounts.
- Travel window: 21–24 November 2026; round trips and one adult per member.
- Rank one member's flight options against existing selections; no joint flight-combination optimizer.
- Use clearly labelled fictional flight offers and curated activities initially. Live inventory is optional.
- Booking, payment, fare holds, and tickets remain simulations; collect no card or passport data.
- Use deterministic JavaScript rules, meaning the same inputs produce the same result. No LLM or machine learning is required.
- Do not expand into multi-city search, real reservations, ticket issuance, seat holds, or a new visual design.

### Current state confirmed from code

- [x] React/Vite app with group setup, invitations, flight selection, board, simulated booking, preferences, and itinerary screens.
- [x] Async API wrappers and an existing REST-shaped contract in `docs/api-contract.md`.
- [x] Browser mock database in `src/api/mock/`, persisted in localStorage; this is not shared across devices.
- [x] Flight comparison calculates latest minus earliest clock time and excludes members without selections.
- [x] Preferences count saved votes; strict majority places enter the plan and minority picks enter “Maybe”.
- [x] Basic itinerary assembly, editing, estimated costs, and fixed travel durations exist.
- [ ] Full-date flight comparisons, genuine authentication, shared storage, and conflict-aware itinerary scheduling are not implemented.
- [ ] Correct stale documentation: API timing text contradicts itself; older notes describe routes, storage keys, and itinerary behavior that have changed.

## 2. Preparation before the event

**Gate:** confirm the hackathon rules before preparing code, datasets, accounts, or integrations. The on-day email does not establish which pre-event work or reuse of the existing prototype is permitted. Until clarified, use this section as a preparation checklist, not permission to implement early.

### PRE-01 · Rules, access, and team responsibilities · P0

- [ ] Confirm whether the existing React prototype can be reused and what must be developed during the 24-hour stage.
- [ ] Confirm permitted pre-event setup, sample data, libraries, and third-party services.
- [ ] Confirm how to email the one-pager, its required format/template, the portal upload fields, and repository access requirements.
- [ ] Assign owners for backend, algorithms/data, frontend integration, and demo/submission; one person can cover multiple roles.
- [ ] Confirm every teammate can run the repository and knows where the API contract lives.
- [ ] Record organizer answers in the README or team notes.

**Done when:** allowed preparation and submission requirements are written down, and every workstream has an owner.

### PRE-02 · Questions for Cathay technical mentors · P0

- [ ] Ask whether Cathay provides a flight dataset or sandbox and which origins/destinations it covers.
- [ ] Separately verify schedule lookup, price lookup, available inventory, reservations, ticket issuance, and seat holds. Do not infer one capability from another.
- [ ] Ask about authentication, credentials, allowed uses, caching, request limits, access expiry, and demo-data attribution.
- [x] Review the local `../OAG Developer Portal Guide.pdf`. Reviewed 10 November: participants get free self-service access at developers.oag.com. The Flight Info API gives schedules, seat capacity and status (1,000 requests per 30 days, 10 results per request); the Connections API shares that quota; the Master Data API allows 100 requests. OAG's field reference shows local and UTC departure and arrival times and no prices, fares or bookable seats. Detail: `docs/technical-guide.md`, section 5.
- [ ] Register on the OAG portal and run one test query (`CX`, `HKG` to `HND`, 2026-11-21). The team's access and the real response format are still unverified.
- [ ] Check in OAG whether Cathay's Shanghai and Singapore flights to Tokyo connect through Hong Kong (open decision D2).
- [ ] Ask whether using Supabase alongside provided AWS/GCP resources is permitted. A cloud account does not establish airline API access.
- [ ] Note that resource setup details arrive on 14 November; if not already requested, the email directs teams to the Tech Help Desk before 14:00 that day.

### PRE-03 · Learn and prepare fallback materials · P0

- [ ] Understand frontend vs server vs database; HTTP requests; authentication; database access rules; timestamps with time zones; basic sorting and scheduling.
- [ ] Where permitted, prepare the three demo accounts and the flight/place fixtures described below.
- [ ] Preserve the current mock demo and write instructions to start it locally.
- [ ] Prepare a short fallback recording, where permitted, and label it as a recorded demo.
- [ ] Agree on the fallback: local mock mode demonstrates one browser only; it does not prove shared-device functionality.

## 3. Architecture and minimum data

### Chosen starting stack

| Part | Choice and responsibility |
| --- | --- |
| Frontend | Existing React/Vite app on the existing Vercel project; render UI and call `src/api` wrappers |
| Identity | Supabase Auth; email/password sign-in using pre-created demo accounts, without email delivery during the pitch |
| Database | Supabase Postgres; store groups, selections, votes, and itinerary versions |
| Own API | One Supabase Edge Function with routes matching the existing contract; validate identity, membership, inputs, and transitions |
| Algorithms | Pure JavaScript functions called by the server, independently testable with fixed inputs |
| Shared updates | Poll active group screens every 5 seconds; refresh after local writes and when returning to the tab |
| Flight/place/routing providers | None required for the first end-to-end demo; use labelled fixtures and a curated travel-time matrix |

Supabase provides the proposed database, identity, and function capabilities; account availability and limits still need checking. Sources: [architecture](https://supabase.com/docs/guides/getting-started/architecture), [password authentication](https://supabase.com/docs/guides/auth/passwords), [function authentication](https://supabase.com/docs/guides/functions/auth).

**API distinction:** `/groups`, `/flights`, `/preferences`, and `/itinerary` are endpoints we implement. A flight or routing provider would be a third-party service our server calls; it does not replace our group backend.

### DATA-01 · Define the minimum schema and fixtures · P0

- [ ] Store trip `startDate`/`endDate` separately from `datesLabel`; display labels must not be parsed to recover business data.
- [ ] Use airport codes plus named time zones: HKG/Asia_Hong_Kong, SHA/Asia_Shanghai, SIN/Asia_Singapore, HND/Asia_Tokyo.
- [ ] Store departure and arrival as separate complete timestamps; derive duration from absolute instants.
- [ ] Store money as integer minor units with an explicit currency; calculate HKD flights separately from JPY activities.
- [ ] Use stable IDs, foreign keys, and uniqueness constraints so repeated joins/votes/selections do not create duplicates.

| Table / dataset | Minimum contents | Origin and refresh |
| --- | --- | --- |
| Profiles | Auth user ID, display name, origin airport | User-entered/seeded; changes when edited |
| Groups | ID, creator, destination airport, trip dates, shared per-person budget | User-entered; changes when edited |
| Group members | Group ID, user ID, join time | Created by validated joining; unique group/user |
| Invitations + responses | Group, random code/token, optional expiry; per-user decline response | Server-generated; never a substitute for member authorization |
| Flight offers | Stable offer ID, airports, departure/arrival instants, cabin/fare, price/currency, source, optional expiry | Fictional fixtures initially; live offers must be refreshed/revalidated if later integrated |
| Flight selections | Group, user, direction, offer ID, selected fare/price snapshot | User-selected; unique group/user/direction |
| Preferences | Group, user, place, like/pass; explicit saved/readiness state | User-entered; changing a vote clears readiness |
| Places | ID, coordinates, date-specific opening windows/closures, duration, estimated cost/currency, source | Curated demo data; verify real facts before claiming live accuracy |
| Travel-time matrix | From/to place or shared city hub, mode, estimated minutes, source | Curated estimates; refresh if a real routing provider is added |
| Itineraries | Group, revision, input version, generated time, days/stops with start/end instants | Calculated; regenerate/revalidate when inputs change |
| Demo bookings | Group/user, status, selection snapshot, hold expiry, simulated reference | Server-calculated simulation; no payment-card information |

- [ ] Provide at least three fictional outbound and return options per origin, including a coordinated option, a cheaper poor match, and an overnight case.
- [ ] Make fictional flight identifiers and price labels explicit; do not imply the current generated CX schedules are real.
- [ ] Start with the four existing voted activities; add only enough curated optional stops to demonstrate scheduling.
- [ ] Include airport-to-hub and hub-to-airport times plus directional travel estimates between candidate places.
- [ ] Keep user input, provider facts, calculated results, and fictional fixtures distinguishable through a source label and documentation.

**Done when:** seed data can recreate the same three-person scenario and the schema supports every P0 flow.

**Progress note, 11 November 2026.** First migration written: `supabase/migrations/20261111000000_initial_schema.sql` creates `airports`, `profiles`, `groups`, `group_members`, `flight_selections` and `votes`, with real dates, full timestamps, integer money with a currency, and uniqueness rules. Not yet in the schema: invitation responses (decline), flight offers, places, travel times, itineraries and demo bookings. The migration was run on the real project on 11 November, and `npm run check:backend` confirmed all six tables exist and are closed to visitors. Nothing above is ticked because the remaining tables and the fixtures do not exist yet. `supabase/seed/demo_profiles.sql` adds the three demo profiles once their sign-in accounts exist; it is tested locally only.

**Progress note, 11 November 2026 (real places).** `src/data/placeGeo.js` holds real coordinates for all 11 voted places, looked up on OpenStreetMap (no key; credit "© OpenStreetMap contributors" must be shown wherever the data is). OpenStreetMap has opening hours for only three of them (Shinjuku Gyoen, Sensō-ji, Zōjō-ji) plus Tokyo Tower; the other hours in `placeData.js` remain our own estimates and must be labelled as estimates. One real finding: Shinjuku Gyoen is closed on Mondays, and Monday 23 Nov 2026 is in the trip; the scheduler does not know this yet. `src/algorithms/travel.js` estimates travel minutes from coordinates (straight line x 1.3, walk up to 1.2 km, else 10 min + 25 km/h); this is an estimate with no train data. 30 algorithm tests pass. **Update, same day:** the scheduler (`src/algorithms/itinerary.js`) now accepts an optional travel function and closed days. The itinerary builder passes the estimated minutes between voted places and Shinjuku Gyoen's Monday closure; stops with no coordinates (suggested fillers) and airport legs still use the standard gap. The checker enforces both. 37 algorithm tests pass. Checked with a script (everyone likes everything: no problems, Gyoen on Saturday, nothing on Monday); **not looked at on screen**, and the itinerary screen's "estimated" travel label is new. **Not done:** no place data is in Supabase yet; opening hours for 7 places are still our estimates. Google Routes transit coverage of Japan is unconfirmed and needs a key to test.

## 4. Build tasks in dependency order

### DEV-01 · Baseline and API contract · P0 · First

- [x] Run `npm run check:tokens` and `npm run build`; record any existing failures. *11 November: both pass, no failures.*
- [ ] Keep pages calling `src/api`; do not import database/provider code into feature screens.
- [ ] Update `docs/api-contract.md` for authentication, full timestamps, comparison coverage, itinerary times, and input/revision versions.
- [ ] Preserve existing response fields where possible; add canonical timestamps and derive legacy display values during migration.
- [ ] Preserve `{ code, message, fields }` errors and make validation errors visible in the existing UI.
- [ ] Add an explicit mock/shared data-mode setting; keep the mock demo isolated and visibly labelled.
- [x] Add `.env.example` containing variable names only; exclude local credentials from version control. *11 November: `.env.example` added; `.env.local` is ignored by the repository's root `.gitignore`.*

**Done when:** frontend and backend owners agree on request/response examples without redesigning the app.

### DEV-02 · Shared backend, identity, and membership · P0 · After DEV-01/DATA-01

- [ ] Set up Supabase, apply versioned database migrations, and seed the three demo profiles/accounts when event rules permit.
- [x] Add a minimal sign-in/sign-out flow; preserve the intended invite URL through sign-in.
- [ ] Implement `/me`, group creation/list/detail, date windows, invitation preview, join, decline, and invite-copied endpoints.
- [ ] Validate access tokens on the server; derive the caller from the verified session, never a submitted `userId`.
- [ ] Add database row-level security: members read their group; users change only their own selections/votes; only the creator edits the shared itinerary.
- [ ] Implement create/join as controlled atomic operations; validate invite codes before adding members and make repeat joins safe.
- [ ] Limit pre-join invitation preview to the information needed to decide whether to join; do not expose the full flight board or votes.
- [ ] Test both allowed and denied database/API operations, including a user trying to insert their own membership without a valid invitation.
- [ ] Change `src/api/http.js` to fetch the configured backend URL with the session token, handle non-2xx responses, and retain request deduplication.
- [ ] Configure browser cross-origin access for localhost and the actual deployed frontend; verify preflight requests.
- [ ] Use the Edge Function base URL directly so the existing Vercel SPA rewrite does not return HTML for API calls.
- [ ] Build copied invite links from the app's own origin plus `/invite/:code`; remove the Cathay-owned placeholder domain.
- [x] Hide person-switching, force-error, and mock-reset controls in shared mode; clear cached user data on sign-out.

Keep provider secrets and administrative database keys server-side. Browser-visible configuration may contain only the intended public project key, URL, and mode settings. Sources: [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [function authentication](https://supabase.com/docs/guides/functions/auth), [browser CORS](https://supabase.com/docs/guides/functions/cors).

**Done when:** device A creates a group, device B signs in as another user and joins through its link, and both see the same membership after reload. A third non-member is denied private group data.

**Progress note, 11 November 2026.** Started on branch `claude/cathay-together-html-7352d8`, before the event; whether pre-event work may be used is still unconfirmed (PRE-01).

- Done: `@supabase/supabase-js` installed. Row-level security written for the six tables in the first migration: members read their own group, each person changes only their own flight choices and votes, and nobody can create a group or add a membership from the browser.
- Verified locally only: `supabase/tests/access_rules.sql` passes on a throwaway Postgres 15 with stand-ins for Supabase's roles and `auth.uid()`. It covers a visitor, a member, a non-member and a person with no groups.
- Added: `npm run check:backend`, which confirms the URL and publishable key work and that each table exists and is closed to visitors. Tested against a pretend server only, not against the real project.
- Run on the real project (11 November): the migration. `check:backend` passes against it.
- Added, same day: a data-mode setting (`npm run dev` = mock, `npm run dev:shared` = Supabase); `src/api/http.js` now sends requests to `src/api/shared/handlers.js` in shared mode; `GET /me` reads the profile from the database; a sign-in screen at `/sign-in` (a PROPOSAL design built from the Create group form); every other screen redirects a signed-out visitor to it and keeps the intended address in `?next=`; the "Demo only" panel on the invitation page is hidden in shared mode.
- Verified in the browser: in shared mode `/groups` redirects to `/sign-in?next=%2Fgroups`, and an empty form shows both field errors without contacting Supabase. In mock mode `/sign-in` redirects to `/groups` and the demo is unchanged. `check:tokens` and the build pass.
- Verified by Clara (11 November): the three demo accounts exist, the profile seed was run, and signing in as Clara shows "Signed in as Clara" and "Flying from Shanghai (SHA)". Sign-out and the wrong-password message are still untested.
- Added, same day: `supabase/migrations/20261111010000_group_functions.sql`, six database functions (`list_my_groups`, `get_group`, `preview_invitation`, `create_group`, `join_group`, `mark_invite_copied`). They are the only way to create or join a group; each works out the caller from the verified session and checks the invite code itself. **This differs from the plan's Edge Function (D5) for groups: Clara has not yet confirmed the change.** `src/api/shared/handlers.js` now answers the group endpoints by calling them. Signed-in screens re-read their data every 5 seconds in shared mode. In shared mode the invite link is the app's own address plus `/invite/<code>`. `check:backend` also checks the six functions.
- Verified locally only: `supabase/tests/group_functions.sql` passes on the throwaway Postgres (visitor refused, wrong or missing code refused, right code joins, repeat join is harmless, non-member cannot open a group).
- Verified on the real project: Clara ran the migration; `check:backend` shows all six functions exist and are closed to visitors. In the browser, signed in as Clara: the empty list, creating a group ("Tokyo togetherTokyo test", a test row that is still in the database), the Members page, the group list, an unknown invite code, and the creator opening their own invite link.
- **Not verified: a second person joining.** It needs someone to sign in as another account on another device or browser profile and open `/invite/<code>`. The "Done when" line is therefore not met yet.
- Added, same day (flights): shared flight endpoints in `src/api/shared/handlers.js`. A member's choice is one row per direction in `flight_selections`; the catalogue is still the fictional generator. **Verified by Clara:** Gaudi joined her group and his outbound list was sorted against her saved flight. Not yet confirmed: Clara showing "Picked", Gaudi's own save, the return list.
- Added, same day (first sign-in): migration `20261111020000_more_airports.sql` (coordinates on `airports` and seven more airports: PVG, TPE, ICN, MNL, BKK, KUL, CAN; tested on the local Postgres only, **not yet run on the real project**); `GET /airports` and `PUT /me`; a Welcome screen (name and searchable airport list, optional "nearest airport" from the browser's location, compared in the browser and never sent); `RequireProfile` sends an account with no profile to `/welcome`. The flight generator now covers the new airports with rough, fictional times and price factors. **Not verified on screen**: it needs the migration run and a new account with no profile. **Not built:** changing the airport for a single trip (needs a column on `group_members` and the flight functions to use it).
- Added, same day (suggestions): `src/algorithms/combinations.js` tries every combination of one flight per member and ranks them cheapest, closest (smallest gap between landings or take-offs) and best of both (cheapest that fits the window; none if nothing fits). Members who already chose are kept as chosen. `GET /groups/:id/flights/suggestions` answers in both modes, and a "Group suggestions" panel sits above the flight list. 48 algorithm tests pass; the numbers were checked with a script for Clara (SHA), Gaudi (HKG) and Kabe (SIN). **Not looked at on screen.** The window is still the per-person slider (default 1 hour), not a stored group setting: that needs a column on `groups`, creator-only editing and a migration. Economy fares only. In the fictional catalogue every return leaves Tokyo at the same clock times, so the three return tabs are identical; real schedules would differ. Singapore landings after midnight show only the clock time (for example 00:25) with no date label.
- Updated, same day (suggestions v2): the panel is now stacked sections (Cheapest, Closest landing/take-off, Best of both, then "Other combinations" with an "Only within Nh" filter and "Show 5 more"). A combination that wins two rules is shown once with both labels. The cabin control moved above the panel and drives it: members who have **not** chosen are placed in that cabin at its lowest fare; a member who **has** chosen stays exactly as chosen (their own flight, date, cabin and fare price, with 0 "extra"). Everyone still chooses their own flight; the buttons only open the viewer's own flight. 54 algorithm tests pass. Script check with Clara fixed on a Business flex flight: others are suggested around her. **Not looked at on screen.** The window is still the per-person slider, not a stored group setting. Mixed cabins for people who have not chosen are not offered.
- Decision by Clara, 12 November: **the arrival time window is removed.** People always want to land as close together as possible, so there is nothing to set. Removed: the 1–6 hour slider, the "within / outside your window" sections and tags, and the window parameter on the flight endpoints. The flight list now sorts closest-to-the-group first once someone else has chosen, and each flight says how far apart the group would land. "Best of both" no longer needs a window: combinations that another one beats on both price and time are dropped, and of the rest the one with the lowest (price share + time share) wins, a tie going to the closer landing (`src/algorithms/combinations.js`). "Other combinations" are listed best balance first. 54 algorithm tests, `check:tokens` and the build pass. **Not looked at on screen.** `windowTiming` in `arrivalWindow.js` and `Slider` are now unused by the app; `docs/api-contract.md` still describes the window.
- Decision by Clara, 12 November: **flights are real Cathay Pacific and HK Express schedules**, not invented ones. `npm run fetch:oag` (script `scripts/fetch-oag.mjs`; key `OAG_SUBSCRIPTION_KEY` in the git-ignored `.env.local`) saved 486 real direct passenger flights for 20–25 Nov to `src/data/oagSnapshot.json` using 92 of the 1,000 monthly requests; the app never calls OAG itself. Findings: Cathay and HK Express fly direct to Haneda **only from Hong Kong** (5 flights a day, 3 Cathay and 2 HK Express); every other airport connects through Hong Kong. `src/algorithms/connections.js` joins a first flight to the soonest second flight on the **same airline** with a wait of 1h30 to 8h, one journey per first flight. Cards show "Via Hong Kong · 6h 30m wait". Premium economy and business are Cathay only. **Prices and seats-left are still invented**, from flight time and airline (HK Express about 55% of Cathay). Shanghai Hongqiao (SHA) has no valid journey on 21 Nov, so Clara moved to Pudong. Real lists are short: Pudong 3 outbound and 1 return on the trip days, Singapore 3 and 2. 63 algorithm tests pass; checked on screen in the demo mode (cards, fares screen for a connecting flight). **Not yet checked on the shared Supabase version.** Old flight choices saved with the previous invented ids (for example `outbound-2026-11-21-500`) no longer match and are ignored: clear them with `delete from public.flight_selections;` in the SQL Editor. Carriers mixing (Cathay then HK Express) would be two separate tickets, so it is not offered. The OAG key was pasted into a chat: create a fresh one after the event.
- Updated 12 November (suggestions v3, approved by Clara from a sketch): the flight list is the main screen again. Above it sits one "Group combinations" bar; tapping it opens a bottom sheet with the cards in the order Cheapest, Closest landing/take-off, Best of both, then "Other combinations". Flights that are part of a suggestion carry a tag on the card ("Cheapest for group", "Closest landing", "Best of both"). Once someone else has picked, each card says how it sits against them ("Lands 1h 30m after Clara"; with several people "Group lands 1h 30m apart"). Wording: "land together" for a zero gap, "1 stop" for a connection, "+1 day" for a landing after midnight. **Seen on screen in mock mode** with a three-person group (bar, tags, sheet, compact button). **Not seen on screen:** the "after Clara" line (needs a member who has picked), the return direction, and shared mode. With the real OAG schedule every Shanghai option lands at 21:15, so one flight can carry all three tags and the tag wraps to three lines.
- Added 12 November (board, review and pay, swipes, itinerary in shared mode): migration `20261112000000_booking_preferences_itinerary.sql` adds `bookings` (20-minute hold and the pretend payment; no card column exists), the functions `get_booking`, `start_booking`, `release_booking`, `pay_booking` and `save_preferences`, a trigger that un-marks "saved" when a swipe changes, and `itineraries` (one saved plan per group, any member may build or edit). `group_json` now reports `booked` and `preferencesSaved`. `src/api/shared/handlers.js` answers the board, booking, preference and itinerary endpoints by loading the real rows into the mock's group shape and calling the mock's own builders (`boardFor`, `bookingFor`, `responseFor`, `bodyFor`, `buildItinerary`, `applyItineraryEdit`, `stopBody`, now exported), so both modes answer alike. `check:backend` covers the new tables and functions. **Verified locally only:** `supabase/tests/booking_preferences_itinerary.sql` passes on the throwaway Postgres (hold, expiry, pay once, total added up in the database, outsiders refused, save needs every place, itinerary rules). Mock mode re-checked on screen after the refactor (board, itinerary build, saved preferences). **Not run on the real project yet, and nothing in shared mode has been seen on screen.** Limits: the itinerary plan is built in the browser and the database does not validate it; a paid member changing flights is blocked in the app only; every screen load makes 2 to 4 database calls and screens refresh every 5 seconds.
- Added the approved **Remove group** flow on Travel groups. Creators can delete their group for everyone. Members can leave and remove their own picks, votes and simulated booking. The new migration `20261112010000_remove_groups.sql` adds the two checked RPCs. Local SQL tests pass. The configured Supabase project still needs the migration.
- Known gaps: declining an invitation is remembered in the browser tab only. There is no visible label for mock mode. No item above is ticked yet.

### DEV-03 · Correct flight comparison and shared board · P0 · After DEV-02

- [ ] Move flight catalogue lookup and timing calculation behind the shared API; keep the calculation itself a pure function.
- [ ] Compare outbound destination arrival instants and return destination departure instants.
- [ ] Calculate `spreadMinutes = (latestInstant - earliestInstant) / 60000`; a spread equal to the window is within it.
- [ ] Exclude missing selections; return `timing: null` when there is no other selected member and show selection coverage.
- [ ] Rank within-window flights by price then spread; rank outside-window flights by overshoot then price; use stable IDs for final ties.
- [ ] Save outbound/return choices per authenticated member and validate their origin, destination, dates, cabin, and fare.
- [ ] Reject a return departing before the outbound arrival; do not rely on UI validation alone.
- [ ] Update board grouping to use full timestamps, including dates; do not merge equal clock times on different days.
- [ ] Keep HND-only validation explicit. Multiple airports require common meeting-point travel calculations and are deferred.
- [ ] Explain when other members' existing selections already exceed the timing window and no single new choice can fix it.
- [ ] Update API timing documentation to consistently exclude members without choices.

**Worked fixture:** Gaudi arrives 15:00 and Kabe 15:40 on 21 November at HND. Clara's 15:20 option yields 40 minutes; 16:10 yields 70 minutes; 17:00 yields 120 minutes. All times are Tokyo local time and fictional.

**Done when:** API, result cards, and board agree for same-day, cross-date, and overnight fixtures.

**Progress note, 11 November 2026 (mock mode).** The arrival-window rule now lives in `src/algorithms/arrivalWindow.js` as pure functions and compares exact moments, not clock times. Flight fixtures and saved choices carry `departAt`, `arriveAt` and `arriveDate`; older saved choices are converted on read. The flight results and the board timeline use it. Checked in the browser with the seeded group: Clara 15:15, Gaudi 16:10, Kabe 16:50 gives a span of 1h 35m, and the 16:10 flight is marked outside a 1-hour window. Not done: the screens do not show "+1 day" beside a landing after midnight; the server side (shared mode) still answers "not connected yet". No item above is ticked.

### DEV-04 · Shared preferences and recommendation rules · P0 · After DEV-02

- [ ] Implement preference read, choice update, and save endpoints using shared storage.
- [ ] Count only saved votes from joined members; unsaved votes remain drafts.
- [ ] Require one like/pass response per candidate before a member can mark preferences saved.
- [ ] Changing a saved vote clears readiness and marks any existing itinerary stale.
- [ ] Keep strict majority: `likes * 2 > joinedMemberCount` makes a place eligible for shared scheduling.
- [ ] Put liked places without a majority into “Maybe”; a pass is a soft preference, not a veto or hard restriction.
- [ ] Keep ties in “Maybe”; order eligible places by likes, then use travel/cost and stable ID to resolve scheduling ties.
- [ ] Show whose preferences are represented; retain minority picks so the group can discuss them rather than hiding them.
- [ ] If every place is passed, show no voted recommendations and offer clearly labelled optional ideas without inventing support.
- [ ] Keep generation blocked while a joined member is not ready; invitations alone do not block the group.

**Done when:** two devices show the same saved/readiness state and changing a saved vote changes the next generated result.

### DEV-05 · Conflict-aware itinerary scheduling · P0 · After DEV-03/DEV-04

**Shared planner integration.** Stacia’s Tavily and Poe workflow prepares a stable deck after sign-in and generates a reviewed plan when everyone has saved. Existing swipes keep their original cards and saved plans stay available for viewing and edits. Local mock mode uses the original deterministic scheduler.

- [x] Reconnect Tavily place photos with bundled fallbacks and update photos in saved researched decks.
- [x] Give the model the exact shared window for each day, request a simpler draft when a check fails, and report the specific scheduling rule when it blocks the revised draft.
- [x] Look up named venues, check AI drafts against the coordinate-based transfer matrix, and use the saved estimates in the itinerary and its edits.
- [x] Search Tavily for named food venues and resolve generic meals to Geoapify district centres before itinerary review.

Use a greedy heuristic: examine promising activities in a fixed order and add each only if it fits. This is manageable for a small demo; it is not a globally optimal route solver.

- [ ] Choose a single shared Tokyo city hub as the itinerary's start/end location and document it in fixture data.
- [ ] Compute the shared start as the latest of each member's arrival + airport-exit buffer + airport-to-hub travel.
- [ ] Compute the shared end as the earliest of each member's return departure - airport buffer - hub-to-airport travel.
- [ ] Use configurable fictional defaults: 90 minutes for arrival formalities, 180 minutes before departure, and 60 minutes each way between HND and the hub. Label these as demo assumptions, not airline guarantees.
- [ ] Intersect each day's 09:00–21:00 planning window with shared availability; require all joined members' outbound/return selections before generating a complete group plan.
- [ ] Use a shared per-person activity/transport budget, default JPY 15,000 for the trip; exclude flights/hotels and state what the estimate includes.
- [ ] Evaluate majority candidates in vote order; within ties prefer less added travel, then lower cost, then stable ID.
- [ ] For each candidate, include travel from the previous location, wait until opening if needed, and accept only if the entire visit and required return to the hub fit the daily window and remaining budget.
- [ ] Check date-specific closures and visit durations; never treat a label such as “Morning” as an opening-hours constraint.
- [ ] Store exact start/end times, travel minutes, estimated cost, and scheduling reasons for each stop.
- [ ] Put infeasible majority picks into an unscheduled list with a reason; keep minority picks in “Maybe”. Distinguish optional filler suggestions from voted stops.
- [ ] If there is no shared availability, return a useful conflict message rather than a fabricated itinerary.
- [ ] Revalidate creator edits and reordering on the server; reject edits that introduce timing, opening-hours, or budget conflicts.
- [ ] Record input versions; membership, flights, or saved preferences changing must flag the itinerary for revalidation. Do not silently overwrite manual edits.
- [ ] Retain each viewer's personal flight cards as context while using the whole group's availability for shared activities.

**Done when:** the latest arriving friend can reach the first shared activity, the earliest departing friend can reach the airport, and every scheduled stop satisfies the fixture's opening/travel/budget constraints.

**Progress note, 11 November 2026 (mock mode).** `src/algorithms/itinerary.js` holds the rules as pure functions: strict-majority votes, the group's free time (90 minutes after the last landing until 3 hours before the first take-off, 08:00 to 21:30 each day), a greedy scheduler that honours opening hours and 20 minutes of travel between stops, and `checkPlan`, which lists every broken rule. The mock builds the itinerary with it, stores a start and end time on every stop, re-times a day when someone reorders it, and records `problems` (empty in every case tried). The itinerary screen shows the time in the existing slot line ("Morning · 09:00–11:00"). Opening hours and visit lengths are approximate demo values. Later the same day, with Clara's go-ahead on D4: seven places added (11 in total) with visit lengths, opening hours and costs stored on each place; they reuse the app's seven existing Tokyo photos, so a photo can appear twice (once on a voted place, once on a suggested stop). A suggested stop is now left out when a voted place already fills that part of the day. With the seeded votes the plan has 5 voted and 2 suggested stops and 5 places under "Maybe". Known limits: travel time is a flat 20 minutes, not per pair of places; a winner that does not fit is listed under "Maybe"; the creator-only edit rule is not enforced. No item above is ticked.

### DEV-06 · Shared refresh, integration, and demo booking · P0/P1 · After DEV-02–05

- [ ] Poll active group, flight comparison, board, readiness, and itinerary views every 5 seconds; stop polling when unmounted/hidden and refresh on focus.
- [ ] Keep immediate refresh after local mutations; do not rely on the existing in-memory change bus for remote updates.
- [ ] Preserve last successful data during temporary failures and show a stale/retry indicator; current silent refresh behavior must not hide connection loss indefinitely.
- [ ] Prevent slower old responses from overwriting newer data and prevent repeated clicks from creating duplicate writes.
- [ ] Use an itinerary revision check when saving edits; reject stale edits with a reload message.
- [ ] Keep the existing next-step journey coherent: pick flights → simulated booking → preferences → itinerary. Make the demo booking endpoints work before testing this complete journey.
- [ ] Store simulated booking transitions/expiry on the server, snapshot the chosen offers, and return an existing confirmation on a repeated successful pay request.
- [ ] Reject expired holds and changed selections; reset the demo booking when flights change rather than showing a ticket for the old choices.
- [ ] Label payment, holds, and confirmations as simulated; do not describe a countdown as a real airline inventory hold.
- [ ] Add Realtime subscriptions only as P1 if polling is already reliable; retain polling as fallback.

**Done when:** a remote selection/vote appears within 10 seconds on a healthy connection and the current frontend journey completes without using mock-person switching.

### DEV-07 · Optional provider integration · P1 · Only after P0 passes

- [ ] Timebox flight-provider access investigation to 60 minutes; stop if credentials, coverage, or usable responses are unavailable.
- [ ] Use a mentor-provided sandbox first; evaluate OAG only after confirming actual team access with a test query (the guide was read on 10 November, see PRE-02).
- [ ] If OAG is used, fetch each route and date once, save the result as labelled fixtures, and never call it on every search. About 18 requests cover three origins, two directions and three dates.
- [ ] Record official documentation links, account requirements, costs, quotas, permitted caching, expiry, coverage, and a successful sample response.
- [ ] Map provider responses into the existing flight-offer model; keep provider-specific code behind one server adapter.
- [ ] Call credentialed providers from the server and avoid logging secrets. Handle timeout, rate limit, and empty results.
- [ ] If only schedules are available, label fares as fictional; do not claim live availability or booking.
- [ ] Keep curated place data and routing estimates as the default. Add a place/routing API only if necessary, with the same access/billing/coverage checks.
- [ ] Fall back explicitly to labelled fixtures; never silently present old or fictional data as live.

**Done when:** one verified provider result can be demonstrated without threatening the existing demo. Otherwise defer the integration.

## 5. Test and reliability checklist

### TEST-01 · Focused automated checks · P0

Add tests for algorithm correctness and shared data/access behavior; do not spend the event writing snapshot tests for unchanged screens.

- [ ] Flight comparison: 40/70/120-minute examples; exact 60-minute boundary; 61 minutes; no other choices; one other choice; changed selection.
- [ ] Dates: 21 November 23:50 to 22 November 00:20 equals 30 minutes; same clock on adjacent days is 24 hours apart; different offsets representing one instant compare equally.
- [ ] Board: same timestamps group together; same clock on different dates remains separate; candidate and board spreads agree after selection.
- [ ] Preferences: 2/3 likes qualifies, 1/3 does not, a 1/2 tie stays “Maybe”, draft votes do not count, all-pass creates no majority picks.
- [ ] Scheduler: closed venue; insufficient visit time; travel makes a stop infeasible; exhausted budget; late arrival; early departure; no shared interval; required flight missing.
- [ ] Editing: removing/reordering revalidates times; changed input marks stale; two editors cannot silently overwrite a newer revision.
- [ ] Access: missing/expired session, invalid invite, non-member access, editing another person's selection/vote, and creator-only itinerary editing.
- [ ] Concurrent writes: repeated join creates one membership; different users' votes survive simultaneous updates; repeated demo pay creates one confirmation.
- [ ] Add and document the selected test command, then run it. The repository currently has no automated test suite.

**Progress note, 11 November 2026.** `npm test` runs 24 checks with Node's built-in test runner (no new dependency, instead of the proposed Vitest): 11 for the arrival window (time zones, the overnight case, window edges, whole-group spread) and 13 for the itinerary (majority rule, votes changing the plan, opening hours, travel gaps, late landing, early departure, a winner that cannot fit, the checker catching broken plans, no randomness). All pass. No item above is ticked.

### TEST-02 · End-to-end demo and regression · P0

- [ ] Start with a clean demo dataset; sign in on two separate physical devices or isolated browser profiles.
- [ ] Create a group, copy its own-domain invite, join, choose flights, inspect the board, simulate booking, save preferences, and generate an itinerary.
- [ ] Refresh both devices; check that identities remain distinct and data agrees.
- [ ] Change a flight and vote remotely; verify timing, readiness, and itinerary stale state update.
- [ ] Disconnect/reconnect one device; verify connection feedback, no false saved state, and recovery.
- [ ] Check invite deep links, route reloads, Back/Forward, error/retry, and sign-out/sign-in as another user.
- [ ] Check changed screens at 375px and 440px; spot-check desktop, keyboard focus, and console errors.
- [ ] Run `npm run check:tokens`, `npm run build`, and the new focused tests after implementation.
- [ ] Keep design tokens and reusable components; update the design-system docs/style guide only if those change.
- [ ] Keep a repeatable demo-reset/seed procedure restricted to the team; never expose an unauthenticated shared-database reset.
- [ ] Test the locally served mock fallback before relying on it; distinguish it from the shared online demo.

**Release gate:** all P0 success checks in section 1 pass, known limitations are documented, and a teammate can repeat the demo from the README.

## 6. Suggested 24-hour work schedule and submissions

This is a timeboxed team schedule, not a promise that every optional feature fits. Meals, breaks, and any staggered rest must be covered by the team's handoffs. Follow live organizer updates if timings change.

| Hong Kong time | Target / checkpoint |
| --- | --- |
| 14 Nov, 09:10 | Check-in; team development room N7.4 |
| 14 Nov, 11:00–12:00 | Development begins; confirm rules/resources, contract, scope, and fixtures |
| 14 Nov, 12:00–17:00 | Backend/auth/groups + timestamp/vote algorithm work by assigned owners; prove two-device joining first |
| 14 Nov, 17:00–20:00 | Shared flight selection/board; connect preferences and demo booking |
| 14 Nov, 20:00–15 Nov, 01:00 | Itinerary scheduling and end-to-end integration; cut optional providers if P0 is incomplete |
| 15 Nov, 01:00–06:00 | Correctness/access tests, device checks, recovery, README; finish one-pager and slides alongside development |
| 15 Nov, 06:00–08:30 | Feature freeze; rehearse five-minute demo; finish fallback and submission files |
| 15 Nov, by 08:45 | Internal target: email the one-pager and verify it was sent |
| 15 Nov, 09:00 | HARD one-pager deadline |
| 15 Nov, 09:00–10:30 | Final fixes/retests, presentation PDF, repository/README links, portal upload and verification |
| 15 Nov, by 10:40 | Internal target: all remaining materials submitted; preserve submitted versions |
| 15 Nov, 10:55 | Be ready for First Pitch in Room 410 |
| 15 Nov, 11:00 | HARD final-work deadline; no later changes or new materials |

### SUBMIT-01 · Technical handover and pitch · P0

- [x] README includes prototype URL, repository link, setup/run/test instructions, environment variable names, seed/demo steps, architecture, and data sources.
- [ ] Document exactly what is shared/real, calculated, simulated, estimated, and deferred.
- [ ] Include a small user-flow/architecture diagram in the technical handover if useful; derive it from the final implemented behavior.
- [ ] Rehearse a five-minute pitch and prepare for five minutes of Q&A, including algorithm limitations and provider assumptions.
- [ ] Prepare the one-page poster and email it by the organizer deadline using the confirmed destination/format.
- [ ] Export presentation slides as PDF and check the exported pages.
- [ ] Submit prototype/repository links in the requested README text/Markdown form plus the slides PDF through the portal.
- [ ] Verify judge access to the prototype/repository, uploads, links, and submission confirmation before leaving for Room 410.
- [ ] Record the submitted commit and artifact filenames; do not change or submit new materials after 11:00.

## 7. Cut list and next action

**P2 / after the hackathon:** joint flight optimization, multiple destination airports, real payments/ticketing, global place coverage, live disruption handling, complex route solvers, LLM-generated plans, public signup polish, and broad UI redesign.

If time is tight, cut provider integration and Realtime first. Keep shared-device state, correct flight comparisons, votes affecting the plan, and basic conflict checks. If shared state cannot be completed, present the local experience transparently as a prototype and list the missing capability.

**Next action:** complete PRE-01 (rules and reuse permission). At the permitted development start, begin DEV-01, DATA-01, and DEV-02. Do not start optional APIs before two devices can join the same shared group.

When completing a task, tick only its verified items and add a short dated note with validation results and remaining blockers.

## Update, 12 November 2026 (planner behaviour, geocoding, one .env)

- **Planner made lenient like the `stacia` branch** (`server/itinerary/pipeline.py`, `checks.py`, `scheduler.py`): after one redraft the draft with the fewest rule errors is kept and shown with its issues (no more "Try again" for rule failures; only a draft that cannot be read at all still fails); a transfer shorter than the estimate is a warning; the scheduler is told to include liked places; a place liked by at least half the group but left out is flagged as a warning; the model timeout is 60 s (`LLM_TIMEOUT_SECONDS` in `.env`). **Check the Vercel function time limit** before deploying: a 60 s model call plus a redraft can exceed a short default.
- **Geocoding now uses Geoapify** (`server/itinerary/geocoding.py`, `GEOAPIFY_API_KEY`), replacing Wikidata. A result must be within 40 km of the destination, have confidence at least 0.5 and a matching name. Real check on 10 Tokyo venues: 7 matched correctly, a made-up name and two restaurants missing from OpenStreetMap correctly got no point (30-minute fallback). Chains with many branches may return the branch nearest the city centre. The itinerary screen now shows "Powered by Geoapify" and the OpenStreetMap credit. The free plan limit (about 3,000 requests a day) is from third-party pages, not confirmed.
- **One environment file:** `cathay-app/.env` only. `.env.local` and `server/.env` are no longer read; `check:backend` and `fetch-oag` read `.env`. `SUPABASE_SECRET_KEY` (needed by the Python planner to save plans) is **not** in `.env` yet: add it yourself, and set the same names in Vercel.
- Tests: 39 Python (`pytest server/tests`), 66 JavaScript (`npm test`). Not run: the planner against the real model and Tavily.

## Update, 12 November 2026 (liked places left out, 30-minute transfers, stale plans)

Found from a real itinerary screenshot (2-member group, Day 2):
- **Liked restaurants were replaced by generic meals.** The model wrote "Dinner: Sushi dinner … Sushi No Midori is popular" and "Lunch: Soba noodles, Kanda" into the required meal slots, so the cards for Sushi No Midori and Kanda Matsuya (liked 2 of 2) were never scheduled and fell into "Maybe". Fix (`schedule.py`, `repair.py`, `plan.py`, scheduler prompt): a meal stop may now be a liked card (`card_id`); a liked food place at least half the group liked takes over a generic lunch or dinner in code when its opening hours and closed days allow; such a stop shows as that place (voted, with its vote count) and counts as scheduled.
- **Every transfer showed 30 minutes because every transfer touched a meal.** Generic meals have no coordinates, so each pair involving one used the 30-minute fallback by design. Geoapify itself works (its credit was shown, so coordinates were used elsewhere). Meals that are liked places now carry coordinates, so those transfers use the real estimate. Generic meals still use 30.
- **Saved plans were never rebuilt.** The save function used `on conflict (group_id) do nothing` and the planner treated "a plan exists" as "built". A plan made when the group had fewer members or different swipes stayed forever (this likely explains "Liked by 1 of 1" next to "Built from 2 members' swipes"). Fix: each plan carries a fingerprint of the members, swipes and flights it came from (`plan_fingerprint` in `server/app.py`); the planner rebuilds when it no longer matches. Needs migration `20261112030000_rebuild_itineraries.sql` (run on Supabase). A rebuild replaces any manual edits to the plan.
- Verified: 45 Python tests; migration chain and the replace-on-second-save behaviour on the local Postgres. **Not verified:** a real rebuild with the live model and Tavily, or the new meal-as-place cards on screen.
