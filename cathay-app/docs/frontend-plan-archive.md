# Cathay Together: Master Plan

> **Archived frontend plan.** The checklist below records the original browser-only prototype. Use the [README](../README.md) and [architecture](../ARCHITECTURE.md) for the current shared app.

## 0. Working agreement

- **Scope:** frontend demo only. No real accounts, payments, hosting or paid services.
- **Source priority:** real-app screenshots (`docs/screenshot-audit.md`, S1 to S14), then the design doc, then Figma. Anything else is a PROPOSAL that needs approval.
- **Tokens only, reuse components.** Raw values live only in `src/styles/tokens.css`. Propose a new component before building one.
- **Before coding:** state the plan and the files to change. Wait for the user's OK if more than 3 files change.
- **Ask first** before changing scope, changing a token value, deleting work or publishing.
- **Backend-ready:** pages get data only through `src/api` (async, REST-shaped, mock on localStorage). Demo controls stay in `src/demo/` and must be deletable. Document every endpoint in `docs/api-contract.md`.
- **Definition of done for any step:**
  1. `npm run check:tokens` passes.
  2. `npm run build` passes.
  3. The screens were checked at 375px and 440px or wider, against the matching screenshot.
  4. The style guide and `docs/design-system.md` are updated if a token or component changed.
  5. The user has reviewed the changed screens.
  6. The checklist below is updated.

## 1. Current state

- **Stack:** React 19, Vite 8 and react-router 7, with plain CSS. Original prototype preserved in `frontend/`.
- **Done:** Flow A, the API layer, the demo panel, design system v2.0 and the `/design-system` style guide.
- **Done, reviewed:** Flow B, flight booking (promo code, filters and Fill-in information deferred).
- **Done:** Flow C approved.
- **Done:** Flow D approved.
- **Done:** Flow E approved.
- **In progress:** final handover (planned, waiting for your OK).
- **Next steps are listed under Final handover.** Final handover (every route by direct URL, keyboard and focus, README, mismatch report).
- **Open product decisions:**
  - the "Travel Groups" nav tab versus the real app's "Travel tools" (J)
  - the Flex strip colour, fare-card radius and shadow
  - the contrast proposals A to J in the design doc

## 2. Flows and checklist

Statuses: `[x]` done, `[~]` in progress, `[ ]` not started. **Stop for user review at the end of every flow**, not at each sub-step.

**Foundation**
- [x] Node and Vite setup, router, original prototype preserved
- [x] Backend-ready API layer, `docs/api-contract.md`, demo panel isolated
- [x] Design system v2.0, token checker, `/design-system` guide
- [~] Tidy-up: design-doc section 9 wording fixed, unused `useDesignTheme.js` deleted; still to do: record photo credits

**Flow A: Group setup** (create, members, invite, join or decline)
- [x] Built and reviewed
- [ ] Re-check against the real-app look after the v2.0 migration

**Flow B: Flight booking**
- [x] B0: Plan approved. Defaults taken: Flex strip is a PROPOSAL gradient (Essential step to deep teal), fare-card radius 10, card shadow stays v1.0 "XXS" (flagged)
- [x] B1: Book a Trip search (S1), then departing results (S5)
  - [x] New tokens and components: Tabs, SegmentedControl, FlightCard, PhotoHeader, Price
  - [x] `api/flights` mock and routes `/groups/:id/flights/search` and `/outbound`
- [x] B2: Fare options (S6), with the Upgrade sheet (S9) and Compare sheet (S11)
  - [x] FareCard, comparison table, small and large buttons, sheets (route `/groups/:id/flights/:direction/:flightId/fares?sheet=`)
- [x] B3: Return results and fares, plus the Members page "Picked" status (status turns `picked` once outbound and return are both chosen)
- [x] Checks (`check:tokens`, `build`, 375px and 440px), style guide and docs updated
- [x] Review round 1 changes: aircraft-wing photo on Book a trip and results; "Group timing window" slider (1 to 6 h) on Book a trip; results grouped by how far each flight is from the other members (outbound and return), with "Lands 5m before Kabe" style badges. Wording as supplied by the user
- [ ] **Flow B review with the user, round 2** (not built: Multi-city, promo code, filters from the real app; no Fill-in information screen yet)

**Flow C: Group board and payment**
- [x] Board list and timeline (`/groups/:id/board`), whole 3-person group (invited people shown as "Invited")
- [x] Book now sheet (`?sheet=book`). The fare-increase dialog and flow were removed at your request (not needed for a prototype)
- [x] Payment hold with 20:00 countdown, simulated Pay now (`/payment`), booking confirmed with text e-ticket (`/confirmed`)
- [x] Seeded real flight choices for Gaudi and Kabe; fixed demo times removed
- [x] Checks, style guide and docs updated
- [x] Aligned the built board, payment and confirmed screens with the Flow C preview (file since removed) (icons, copy, layout, calculated values)
- [ ] **Flow C review with the user** (promo code, filters and Fill-in information from Flow B were not built)

**Flow D: Preferences**
- [x] Group details (`/groups/:id/details`): the Members page layout with Ready / Choosing chips, the "What does your Tokyo look like?" callout and "Pick itinerary preferences"
- [x] Four suggestion cards (`/groups/:id/preferences/:category`, food, scenery, culture, shopping): swipe or Pass / Like, saved straight away
- [x] Preferences saved (`/groups/:id/preferences/saved`): liked places, group readiness, Generate itinerary (leads to the Flow E placeholder)
- [x] Mock API (`/groups/:id/preferences`, `/choices`, `/save`), Gaudi and Kabe seeded as Ready
- [x] Checks, style guide and docs updated
- [x] Group details visual refresh (preview file since removed): icon tiles, tinted link rows and avatars, ready chip with tick, photo thumbnails in the call to action, "View itinerary" when one exists
- [ ] **Flow D review with the user** (entry point added: an "Itinerary preferences" link on the Members page)

**Flow E: Itinerary**
- [x] Building screen (`/groups/:id/itinerary/building`): timed build from everyone's saved picks; says who is still swiping
- [x] Itinerary (`/groups/:id/itinerary?day=`): summary tiles, a tab per day, your own booked flights, voted and "Suggested" stops, travel between stops, day totals, Maybe list, Edit (move and remove stops) and Save changes
- [x] Place detail (`/groups/:id/itinerary/places/:stopId`): photo, tiles, tip, and each member's vote for a voted place
- [x] Mock API (`/itinerary/build`, `/itinerary`, `/itinerary/stops/:id`); votes, totals and counts calculated from the data
- [x] Checks, style guide and docs updated
- [x] **Flow E review with the user** (approved)
- [x] Group home look applied to the Members page and the Travel Groups list, matching Group details (the richer style is applied to Flow E only; Group details and Members stay as they are until you decide)

**Next-steps round (after Flow E)**
- [x] Next step card on Group details and Members (pay is now one tap from the group page); preferences only after booking; invite link and friends note moved below; Done on the itinerary; swipe hints removed. Verified at 375 and 440px.

**Final handover**
- [x] Every route works by direct URL (22 routes at 375, 768, 1280px; browser Back and Forward not tested)
- [x] Keyboard, focus and console are clean (console clean everywhere; focusability checked on Group details only; Back tap target now 44px)
- [x] Layouts verified at 375, 768 and 1280px
- [x] README and run instructions
- [x] Mismatch report (`docs/mismatch-report.md`)

## 3. Per-step loop

1. Read this file, `CLAUDE.md` and the design doc.
2. Run `check:tokens` and `build` to confirm a clean start.
3. Propose the plan and files, and wait for approval if more than 3 files change.
4. Build with tokens and existing components. Mock data lives in `src/api`.
5. Run `check:tokens` and `build` again, and check the screens in the browser.
6. Update the docs and style guide, then tick the checklist.
7. At the end of a flow, show the changed screens and **wait for approval** before the next flow.

## 4. Risks and unknowns

- The typeface is unconfirmed (Inter is a guess).
- Shadow blur and some radii need native-resolution crops.
- The real-app screenshots are not in the repo, so they must be re-supplied for new screens.
- Screens with no real-app or Figma coverage get PROPOSAL treatment.

## Appendix: original plan

Written at the start of the project. Since then Node was installed and Flow A was completed. Kept as written.

---

# (Original) Plan: Cathay prototype to a React + Vite app

I created and changed no files this turn.

## 1. Environment and project state

- **Node.js is not installed** (`node`, `npm`, `npx`, `nvm`, `fnm` and `volta` are all missing).
- **Homebrew 7.0.1** is installed on this Apple-silicon Mac, so `brew install node` (current LTS) is the straightforward fix. It changes your system, so approving this plan also approves that install. If you'd rather use the nodejs.org installer, tell me.
- The original prototype now sits in `frontend/` (`index.html` plus 77 files in `assets/`). I will not touch it.
- The new app goes in a sibling folder, `cathay-app/`. Assets are copied from `frontend/assets`.

## 2. Inventory of existing screens

The prototype has 31 screens plus 3 design-only component frames. They are grouped by flow below.

| # | Flow | Screens (prototype order) | Interactions to make work |
|---|---|---|---|
| A | Group setup | Create group; Members & invite (empty); Members & invite (link copied); Invite view; Members & invite (3 members) | Form fields and travel-date dropdown; copy and share invite link; Join and Decline; Pick flight → |
| B | Flight booking | Book a Trip search; Outbound results; Outbound results (lowest fare selected); Outbound fare options (Light, Essential, Flex); Return results; Return fare options | Return and One way tabs; Passengers and Class; arrival-window slider; date chips; cabin tabs; selecting a flight and a fare; "view more condition" |
| C | Group board and payment | Board (List); Board (Timeline); Book now sheet; Payment hold; Booking confirmed | List and Timeline toggle; Book now → Confirm & pay; 20:00 hold countdown; Pay now; Change flight |
| D | Preferences | Tokyo group details (ready); 4 categories (Food, Scenery, Culture, Shopping) × 2 states (undecided, decided); Preferences saved | Swipe cards with Pass and Like buttons, "LIKED" and "PASSED" stamps, progress bar, Next suggestion, Save preferences; Generate Itinerary |
| E | Itinerary | Building itinerary; Final itinerary (4 days); Place detail sheet; Tokyo group details (final) | Timed build screen; day tabs; place card → sheet; Maybe list; Edit and Save Changes; View the Itinerary and View Booking |
| – | Design-only frames | Two countdown frames (19:59, 19:58); return-flight card variants | Become the countdown component and the flight-card selected state, not routes |

## 3. Proposed routes (React Router)

```
/                                   → redirect to /groups
/groups/new                         Create group
/groups/:id/invite                  Members & invite (empty, copied and 3-member states come from data)
/invite/:code                       Invite view (join or decline)
/groups/:id                         Board, with ?view=list|timeline
/groups/:id/flights/search          Search
/groups/:id/flights/outbound        Results → …/outbound/fares
/groups/:id/flights/return          Results → …/return/fares
/groups/:id/book                    Board with Book now sheet
/groups/:id/payment                 Payment hold
/groups/:id/confirmed               Booking confirmed
/groups/:id/details                 Tokyo group details
/groups/:id/preferences/:category   food | scenery | culture | shopping
/groups/:id/preferences/saved
/groups/:id/itinerary/building
/groups/:id/itinerary               plus /itinerary/places/:placeId (sheet)
*                                   Not found
```

Sheets are nested routes, so Back closes them and direct URLs work.

## 4. Shared components and folder structure

```
cathay-app/
  index.html  vite.config.js  package.json
  public/ or src/assets/        copied icons and photos
  src/
    main.jsx  App.jsx  routes.jsx
    styles/   tokens.css (the prototype's :root), base.css, plus one CSS file per component or feature
    components/
      layout/  PhoneFrame, StatusBar, PageHeader, BottomNav, Sheet, Scrim
      ui/      Button, Chip, Avatar, AvatarStack, Field, Tabs, Card, ProgressBar, Countdown, Toast
      domain/  FlightCard, FareCard, MemberRow, PlaceCard, TripBanner, BonusTeaser
    features/  groups, flights, board, payment, preferences, itinerary   (pages plus feature CSS)
    data/      trip.js, members.js, flights.js, fares.js, places.js, itinerary.js, copy.js
    state/     TripProvider.jsx (useReducer, persisted to localStorage, with a "reset demo" action)
    hooks/     useCountdown, useClipboard
```

Dependencies: `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`. Nothing else.

## 5. Mock data and simulated behaviour

- **No backend, login or real payments.** Pay now is simulated with a short delay.
- **Content lives in `src/data/`.** All people are fictional (Clara, Gaudi, Kabe) and can be swapped for an API later.
- **Shared trip state** keeps selections consistent: group details, chosen flights and fares, paid or unpaid, likes and passes.
- **Avatar colours by person:** Kabe teal, Gaudi steel, Clara sand on every screen (was by list position).
- **Zero-group start + calendar (Nov 21–24):** the demo now begins with no groups; Create group's Travel dates opens the new `CalendarSheet` (`GET /date-windows`, fares calculated from flight data); demo dates moved from Nov 7–10 to Nov 21–24; Kyoto/Fuji photos and the three sample groups removed; mock db key bumped to `cathay-mock-db-v4`.
- **Other members** (Gaudi booked, Kabe picked) start from seeded data, and the payment hold countdown is real.
- **Itinerary generation** is a timed 3-second build screen, and the itinerary itself is the designed mock one. Your likes and passes drive the "Your liked places" list on the Preferences saved screen.
- **Copy link** uses the real clipboard with a fallback, and shows the designed "Link Copied" feedback.
- **Forms:** group name and destination are required, the travel dates need a valid range, and errors show inline.

## 6. Missing assets, unclear behaviour and assumptions

1. **Home, My Trips and Profile tabs** have no designed screens. I'll route them to a minimal "Not part of this demo" page. Tell me if you'd rather the tabs be inert.
2. **Whose view?** The prototype mixes Gaudi (creator) and Clara (joiner). I'll treat Clara as the signed-in user after joining.
3. **Desktop** has no design. I'll show the 440px phone layout centred on the prototype's dark canvas, and full-width on phones.
4. **No designs exist for:** the travel-date picker, the Passengers and Class dropdown, the Share invite sheet, the ⋯ menu, itinerary Edit mode, or "Choose another flight". I'll use simple, on-brand native controls and ask before any material design change.
5. **Flight results and fare screens** are absolutely positioned in the prototype. I'll rebuild them as data-driven components that keep the same percentage-based geometry, so they look the same but become real components.
6. **Fonts** (Inter only; Lexend was removed as unused) stay on the Google Fonts link, which needs internet. Self-hosting via `@fontsource` would add dependencies, so tell me if you want that.
7. The known 1px quirk from before (the empty check box in the Kabe row on Preferences saved) stays excluded.

## 7. First flow for review

I recommend **Flow A: Group setup**, which is 5 screens:

Create group → Members & invite (empty, copy link) → Invite view (Join or Decline) → Members & invite (3 members).

It sets up everything the rest depends on: Vite scaffold, tokens, router, PhoneFrame, StatusBar, PageHeader, BottomNav, Button, Chip and Field components, the shared state store, form validation and copy feedback. After you review it, flows B to E follow in that order.

## 8. Verification at handover

I'll run `npm run build` and a preview server, then check:
- every route by direct URL, plus browser Back and Forward;
- form validation and state consistency across a full run-through;
- layouts at 375px, 768px and 1280px, compared against the prototype and Figma screenshots;
- keyboard operation, focus states and console errors.

I'll report anything that doesn't match.
