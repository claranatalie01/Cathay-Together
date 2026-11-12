# Cathay Together demo (React + Vite)

Interactive demo of the Cathay Together group-booking prototype.

- [Live prototype](https://cathay-together.vercel.app)
- [Code repository](https://github.com/claranatalie01/Cathay-Together) (app in `cathay-app/`)

The app runs as a single-browser demo or as a shared trip backed by Supabase. Both modes use a bundled OAG schedule snapshot for flights to Tokyo Haneda and simulate fares, booking, payment and tickets.

The original static prototype is kept outside this repository.

## Run it

Run these commands from `cathay-app/`. Use Node.js 20.19+ on the 20.x line, or 22.12+.

```bash
npm ci             # install the locked dependencies
npm run dev        # http://localhost:5173, mock mode by default
npm test           # flight and itinerary algorithm tests
npm run check:tokens
npm run build      # production build into dist/
npm run preview    # serve the production build
```

### Mock mode

Leave `VITE_DATA_MODE` unset or set it to `mock`. The demo starts with Gaudi as the viewer and an empty group list. Create a group in `/groups/new`, then use the **Demo only** panel to switch between Gaudi, Clara and Kabe, simulate invitations or flight progress, test a request failure, or reset. The mock saves trips and the current viewer in this browser's `localStorage` under `cathay-mock-db-v4`. Use `/reset` to clear local demo data and return to group creation.

### Shared mode

1. For a fresh Supabase project, run the files in [`supabase/migrations/`](supabase/migrations) in filename order, once each, in the Supabase SQL Editor. For an existing project, apply its pending migrations.
2. Create confirmed email/password users in Supabase Authentication. A user without a profile enters their name and home airport on their first sign-in. To prefill the three demo profiles, create users with the email handles listed in [`demo_profiles.sql`](supabase/seed/demo_profiles.sql) and run that seed after the migrations.
3. Copy [`.env.example`](.env.example) to `.env.local` if you do not already have one. Set the Supabase URL and publishable key in `.env.local`.
4. Run `npm run check:backend` to verify connectivity and check that the tables and RPCs are closed to signed-out visitors. Run `npm run dev:shared` and sign in. To try a shared trip, copy an invitation link from Members and open it on a second device or browser session with a different account. Use an app URL reachable by both devices.

`npm run dev:shared` sets `VITE_DATA_MODE=shared` for the dev server. In a second terminal, start Stacia’s Python planner from `cathay-app/` with Python 3.12:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn server.app:app --host 127.0.0.1 --port 8000
```

For production, apply [`20261112020000_researched_itineraries.sql`](supabase/migrations/20261112020000_researched_itineraries.sql) after the earlier migrations. In Vercel, keep the project root set to `cathay-app`, enable Fluid Compute for the planner’s 300-second limit, and redeploy after setting the variables below. The React app and `/api/planner` deploy together. Use `npm run dev:shared` with the local planner to test the whole workflow locally.

### Environment variables

| Variable | Use |
|---|---|
| `VITE_DATA_MODE` | `mock` by default. The exact value `shared` selects Supabase. |
| `VITE_SUPABASE_URL` | Supabase project URL. Required in shared mode and exposed in the browser bundle. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public `sb_publishable_…` key or legacy `anon` key. Required in shared mode and exposed in the browser bundle. |
| `SUPABASE_SECRET_KEY` | Server only. Supabase `sb_secret_…` key or legacy `service_role` key used to store the group deck and generated plan. |
| `TAVILY_API_KEY` | Server only. Required for researching places. |
| `POE_API_KEY` | Server only. Required for search planning, curation, scheduling and review. |
| `POE_MODEL`, `POE_BASE_URL` | Optional server settings. Defaults to `GPT-4o-Mini` and `https://api.poe.com/v1/`. |
| `GOOGLE_PLACES_API_KEY` | Optional server key for ratings enrichment. |
| `OAG_SUBSCRIPTION_KEY` | Optional local credential for `npm run fetch:oag`, which refreshes `src/data/oagSnapshot.json`. Both modes can run from the checked-in snapshot. |

Set server keys as Vercel **Secrets** or in the git-ignored `server/.env` for local development. Keep them out of `VITE_` variables. The Python service verifies the caller’s Supabase session and membership before contacting Tavily or Poe. Keep the OAG subscription key in the git-ignored local environment and use its unprefixed name.

Shared mode prepares the latest trip after sign-in and researches other trips as they are opened or created. Trips with existing swipes or plans retain their original deck. Existing plans open as saved, and the planner saves a new plan only after every traveller saves their choices. Research and planning errors offer a retry. The mock workflow uses its local deck and scheduler.

The shared planner keeps the 90-minute arrival buffer, three-hour departure buffer and 08:00–21:30 local planning window. It checks known opening hours, closures and overlaps. It prioritizes places liked by at least half the group and estimates transfers. The model proposes meals and free time within the trip's activity and meal budget.

## Review shortcuts

Every route below also works when typed straight into the address bar. Create a group on `/groups/new` and use its ID in place of `<groupId>`. A new default-named group in mock mode uses `tokyo-together` if that ID is free. Shared mode uses a UUID and prompts for sign-in and profile setup when needed. Routes starting with `...` below are relative to `/groups/<groupId>`.

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
| | `.../preferences/food` (then scenery, culture, shopping) | Swipe through ideas |
| | `.../preferences/saved` | Saved picks and group readiness |
| E. Itinerary | `.../itinerary/building`, `.../itinerary` | Plan built from everyone's picks (Edit and Done) |
| | `.../itinerary/places/<stopId>` | One place |
| Other | `/design-system` | Living style guide (tokens and real components) |
| | `/sign-in`, `/welcome` | Shared sign-in and first-time profile setup |
| | `/reset` | Clear local mock data |

The Next step card on Group details and the Members page follows your progress from Pick flight to Review & pay, preferences, and View itinerary. The Demo only panel is available in mock mode.

## Structure

- `src/styles` – design tokens (`tokens.css`, where raw token values are defined), base and app-shell CSS
- `src/design-system` – the `/design-system` style guide. The rules are in [`docs/design-system.md`](docs/design-system.md), and `npm run check:tokens` checks CSS.
- `src/components` – `layout/`, `ui/` (Button, Chip, Field, Sheet, Toast, StateMessage, LoadingState, ErrorState), `domain/`
- `src/features` – pages, one folder per flow
- `src/api` – page-facing async API, browser mock handlers, Supabase handlers, and builders used in both modes
- `src/algorithms` – pure JavaScript for flight timing, connections, group ranking, travel estimates and itinerary scheduling
- `src/data` – UI copy, OAG snapshot, place coordinates, and other static data
- `src/demo` – local demo controls and reset
- `supabase` – schema migrations, RPCs, optional demo profile seed and SQL tests
- `scripts` – backend and token checks, OAG snapshot refresh and icon inventory

### Removing the demo controls

To remove the optional demo controls from a copy of the app, remove the `DemoControls` imports and usages in `GroupsPage.jsx`, `InvitePage.jsx` and `MembersPage.jsx`, and remove the `ResetPage` import and route from `App.jsx`. You can then remove `src/demo/`. The shared invite route uses the app's regular group API.

## Technical reference

- [Architecture](ARCHITECTURE.md) covers app flows, algorithms, and security boundaries.
- [Data dictionary](DATA_DICTIONARY.md) covers the Supabase schema, RPCs, payloads, and source data.
- The [older API contract](docs/api-contract.md) includes route examples from earlier flows, including the former flight timing window. Use the current handlers and the data dictionary for implemented behavior.
