# Cathay Together demo (React + Vite)

Interactive demo of the Cathay Together group-booking prototype.

- [Live prototype](https://cathay-together.vercel.app)
- [Code repository](https://github.com/claranatalie01/Cathay-Together) (app in `cathay-app/`)

Supabase shares trip data across signed-in travellers. Flights use a bundled OAG schedule snapshot for Tokyo Haneda. Fares, booking, payment and tickets are simulated.

Tavily researches the swipe deck, Geoapify supplies coordinates where available, and the Python planner uses Poe to draft and review one group itinerary.

The original static prototype is kept outside this repository.

## Run it

Run these commands from `cathay-app/`. Use Node.js 20.19+ on the 20.x line, or 22.12+.

```bash
npm ci             # install the locked dependencies
npm run dev        # http://localhost:5173
npm test           # flight and itinerary algorithm tests
npm run check:tokens
npm run build      # production build into dist/
npm run preview    # serve the production build
```

### Supabase setup

1. For a fresh Supabase project, run the files in [`supabase/migrations/`](supabase/migrations) in filename order, once each, in the Supabase SQL Editor. For an existing project, apply its pending migrations.
2. Create confirmed email/password users in Supabase Authentication. A user without a profile enters their name and home airport on their first sign-in. To prefill the three demo profiles, create users with the email handles listed in [`demo_profiles.sql`](supabase/seed/demo_profiles.sql) and run that seed after the migrations.
3. Copy [`.env.example`](.env.example) to `.env` (the one environment file) if you do not already have one. Set the Supabase URL and publishable key in `.env`.
4. Run `npm run check:backend` to verify connectivity and check that the tables and RPCs are closed to signed-out visitors. Run `npm run dev` and sign in. To try a shared trip, copy an invitation link from Members and open it on a second device or browser session with a different account. Use an app URL reachable by both devices.

In a second terminal, start Stacia’s Python planner from `cathay-app/` with Python 3.12 (it needs `SUPABASE_SECRET_KEY`, `POE_API_KEY` and `TAVILY_API_KEY` in `.env`; `GEOAPIFY_API_KEY` is optional):

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run dev:api
```

Or start both in one terminal with `npm run dev:all` (after the one-time setup above). Ctrl+C stops both.

### Python tests

After installing the planner dependencies above, install pytest in the same virtual environment and run the planner tests from `cathay-app/`.

```bash
.venv/bin/python -m pip install pytest
.venv/bin/python -m pytest server/tests
```

The tests use local fixtures and run without provider credentials, a running server, or a Supabase connection.

### Production deployment

For production, apply the pending [migrations](supabase/migrations) in order through [`20261113000000_trip_preference_realtime.sql`](supabase/migrations/20261113000000_trip_preference_realtime.sql). That migration adds the notification table to the `supabase_realtime` publication. In Vercel, keep the project root set to `cathay-app`, enable Fluid Compute for the planner’s 300-second limit, and redeploy after setting the variables below. The React app and `/api/planner` deploy together. Use `npm run dev` with the local planner to test the whole workflow locally.

To check readiness updates after applying the migration, sign in as two members of one trip in separate browser sessions. With both on the trip, save the last activity choice in one session and confirm the other session shows the member as ready before its next five-second poll. With a third signed-in account outside the trip, attempt the same subscription and confirm no change payload arrives. Block only the Realtime WebSocket in the receiving session, save again, and check that the visible screen refreshes by polling. Unblock the socket and confirm that rejoining refreshes readiness once.

### Environment variables

| Variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL. Required and exposed in the browser bundle. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public `sb_publishable_…` key or legacy `anon` key. Required and exposed in the browser bundle. |
| `SUPABASE_SECRET_KEY` | Server only. Supabase `sb_secret_…` key or legacy `service_role` key used to store the group deck and generated plan. |
| `TAVILY_API_KEY` | Server only. Required for researching places. |
| `POE_API_KEY` | Server only. Required for search planning, curation, scheduling and review. |
| `POE_MODEL`, `POE_BASE_URL` | Optional server settings. Defaults to `GPT-4o-Mini` and `https://api.poe.com/v1/`. |
| `GEOAPIFY_API_KEY` | Optional server key for named venue and generic meal district coordinates. Missing points use the 30-minute transfer fallback. |
| `LLM_TIMEOUT_SECONDS` | Optional server setting for each model call. Defaults to 60 seconds with a 5-second minimum. |
| `GOOGLE_PLACES_API_KEY` | Optional server key for ratings enrichment. |
| `OAG_SUBSCRIPTION_KEY` | Optional local credential for `npm run fetch:oag`, which refreshes `src/data/oagSnapshot.json`. The app uses the checked-in snapshot. |

Set server keys as Vercel **Secrets** or in the git-ignored `.env` for local development (the same file the front end uses; only `VITE_` names reach the browser). Keep them out of `VITE_` variables. The Python service verifies the caller’s Supabase session and membership before contacting Tavily or Poe. Keep the OAG subscription key in the git-ignored local environment and use its unprefixed name.

The app prepares the latest trip after sign-in and researches other trips as they are opened or created. Trips with existing swipes or plans retain their original deck. Every traveller must save their choices before the server can generate a new plan. The itinerary screen opens a saved plan as-is. When called directly, the build endpoint compares the saved fingerprint with current membership, votes and flight times. Research and planning errors offer a retry.

The shared planner keeps the 90-minute arrival buffer, three-hour departure buffer and 08:00–21:30 local planning window. It checks known opening hours, closures and overlaps. It prioritizes places liked by at least half the group. The model proposes activities, meals and free time, and the server can use a popular food venue in a generic meal slot. Transfers use named venue or district coordinates when available. A short transfer is a warning, and the planner can save a readable draft with review issues.

## Review shortcuts

Every route below also works when typed straight into the address bar. Create a group on `/groups/new` and use its ID in place of `<groupId>`. Group IDs are UUIDs. The app prompts for sign-in and profile setup when needed. Routes starting with `...` below are relative to `/groups/<groupId>`.

| Flow | Route | What it is |
|---|---|---|
| A. Groups | `/groups` | Travel Groups list (the nav tab, also what `/` opens) |
| | `/groups/new` | Start of group set-up. Travel dates opens a calendar sheet |
| | `/invite/<code>` | Invitation link for a group (the code is on the Members page) |
| | `.../invite` | Members page |
| B. Flights | `.../flights/search` | Book a trip (cabin and trip type) |
| | `.../flights/outbound`, `.../flights/return` | Individual results and group suggestions. Once others have picked, individual results sort by landing or take-off spread. |
| | `.../flights/<direction>/<flightId>/fares` | Fare choice (`?cabin=`, `?sheet=upgrade` or `compare`) |
| C. Board and payment | `.../board` | Everyone's flights (`?view=timeline`, `?sheet=book`) |
| | `.../payment`, `.../confirmed` | Simulated payment hold and e-ticket. The payment screen returns to the board when there is no hold or ticket. The confirmation screen requires a ticket. |
| D. Preferences | `.../details` | Group details with the Next step card |
| | `.../preferences/<placeId>` | Swipe through ideas |
| | `.../preferences/saved` | Saved picks and group readiness |
| E. Itinerary | `.../itinerary/building`, `.../itinerary` | Plan built from everyone's picks (Edit and Done) |
| | `.../itinerary/places/<stopId>` | One place |
| Other | `/design-system` | Living style guide (tokens and real components) |
| | `/sign-in`, `/welcome` | Shared sign-in and first-time profile setup |

The Next step card on Group details and the Members page follows your progress from Pick flight to Review & pay, preferences, and View itinerary.

## Structure

- `src/styles` – design tokens (`tokens.css`, where raw token values are defined), base and app-shell CSS
- `src/design-system` – the `/design-system` style guide. The rules are in [`docs/design-system.md`](docs/design-system.md), and `npm run check:tokens` checks CSS.
- `src/components` – `layout/`, `ui/` (Button, Chip, Field, Sheet, Toast, StateMessage, LoadingState, ErrorState), `domain/`
- `src/features` – pages, one folder per flow
- `src/api` – page-facing async API, Supabase handlers, and response builders
- `src/algorithms` – JavaScript flight timing, group ranking, itinerary editing and transfer display helpers
- `server/itinerary` and `api/planner.py` – the shared research, geocoding and itinerary pipeline and its Vercel entry point
- `src/data` – UI copy, OAG snapshot, place coordinates, and other static data
- `supabase` – schema migrations, RPCs, optional demo profile seed and SQL tests
- `scripts` – backend and token checks, OAG snapshot refresh and icon inventory

## Technical reference

- [Architecture](ARCHITECTURE.md) covers app flows, algorithms, and security boundaries.
- [Data dictionary](DATA_DICTIONARY.md) covers the Supabase schema, RPCs, payloads, and source data.
- [Logic](LOGIC.md) covers the flight formulas and shared itinerary rules.
- The [API contract](docs/api-contract.md) describes the app’s request and response shapes.
