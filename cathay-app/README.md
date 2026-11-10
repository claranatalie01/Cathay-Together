# Cathay Together demo (React + Vite)

Interactive demo of the Cathay Together group-booking prototype.

**Live prototype:** https://cathay-together.vercel.app
**Code repository:** https://github.com/claranatalie01/Cathay-Together (app in `cathay-app/`)

The data layer is simulated in the browser (see "Data layer" below); there is no real backend yet.
The original static prototype is untouched in `../frontend`.

## Run it

```bash
npm install        # first time only
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Needs Node.js 20+ (`brew install node`).

## Review shortcuts

Every route below also works when typed straight into the address bar. The demo starts with no groups. Create one on `/groups/new` (the default name gives it the id `tokyo-together`, used below).

| Flow | Route | What it is |
|---|---|---|
| A. Groups | `/groups` | Travel Groups list (the nav tab) |
| | `/groups/new` | Start of group set-up (also what `/` opens). Travel dates opens a calendar sheet |
| | `/invite/<code>` | Invitation link for a group (the code is on the Members page) |
| | `/groups/tokyo-together/invite` | Members page |
| B. Flights | `/groups/tokyo-together/flights/search` | Book a trip (cabin, trip type, group timing window) |
| | `.../flights/outbound`, `.../flights/return` | Results, grouped by how close they land to everyone |
| | `.../flights/outbound/<flightId>/fares` | Fare choice (`?cabin=`, `?sheet=upgrade` or `compare`) |
| C. Board and payment | `/groups/tokyo-together/board` | Everyone's flights (`?view=timeline`, `?sheet=book`) |
| | `.../payment`, `.../confirmed` | Payment hold and e-ticket (go back to the board if there is nothing to pay or no ticket) |
| D. Preferences | `/groups/tokyo-together/details` | Group details with the Next step card |
| | `.../preferences/food` (then scenery, culture, shopping) | Swipe through ideas |
| | `.../preferences/saved` | Saved picks and group readiness |
| E. Itinerary | `.../itinerary/building`, `.../itinerary` | Plan built from everyone's picks (Edit and Done) |
| | `.../itinerary/places/<stopId>` | One place |
| Other | `/design-system` | Living style guide (tokens and real components) |
| | `/reset` | Clear saved demo data (demo only) |

The Next step card on Group details and the Members page changes with your own progress: Pick flight, Review & pay, preferences, then View itinerary. To see another step, use the Demo only panel on the Members page or `/reset`.

## Structure

- `src/styles` – design tokens (`tokens.css`, the only place raw values may be written), base and app-shell CSS
- `src/design-system` – the `/design-system` style guide; rules in `docs/design-system.md`; `npm run check:tokens` enforces tokens-only CSS
- `src/components` – `layout/`, `ui/` (Button, Chip, Field, Sheet, Toast, StateMessage, LoadingState, ErrorState), `domain/`
- `src/features` – pages, one folder per flow
- `src/api` – the only place pages get data from (see below)
- `src/data` – UI text and static options (not server data)
- `src/demo` – demo-only controls (see below)
- `docs/api-contract.md` – endpoints, request and response JSON for the backend

## Data layer

Pages import only from `src/api` (`getGroups`, `getGroup`, `getGroupByCode`, `createGroup`,
`joinGroup`, `declineInvite`, `markInviteCopied`, `getCurrentUser`). Each function is async and
returns the JSON in `docs/api-contract.md`. They call `request()` in `src/api/http.js`, which is
answered by a mock backend in `src/api/mock/` that saves to `localStorage`.

**To connect a real backend:** replace the body of `request()` in `src/api/http.js` with a `fetch`
to your API (same paths and JSON, throw `ApiError` on non-2xx). Then delete `src/api/mock/`.

## Demo controls (and how to remove them)

`src/demo` holds the "Demo only" panel (switch the viewing person, simulate invitations, expire
force an API error, reset) and the `/reset` route. The real invite link `/invite/CODE`
works without it. To remove it:

1. Delete the `src/demo` folder.
2. Remove the `DemoControls` import and `<DemoControls … />` line in `MembersPage.jsx`,
   `InvitePage.jsx` and `GroupsPage.jsx`.
3. Remove the `ResetPage` import and the `reset` route in `App.jsx`.
