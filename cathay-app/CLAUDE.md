# Cathay Together demo

React 19 + Vite 8 + react-router-dom 7 demo app: a phone-sized (440 px) "Travel Groups" flow that must match the real Cathay Pacific Android app. The app uses Supabase for sign-in and shared trip state. Request handlers live in `src/api/shared`, and itinerary generation lives in `server/itinerary/`. Run `npm test` for JavaScript and `.venv/bin/python -m pytest server/tests` for Python.

**Start every session by reading `plan.md` (the master plan and progress checklist), then update its checklist when you finish a task.**

## Commands

- `npm run dev` : dev server (style guide at `/design-system`)
- `npm test` : runs the algorithm tests in `src/algorithms` (flight timing and ranking, itinerary edits and transfer display). Keep those files free of browser code and import them with the `.js` ending so Node can run them
- `npm run check:tokens` : must pass before you finish any change (also runs on `npm run build`)
- `npm run check:backend` : checks the Supabase URL and publishable key in `.env` (the one git-ignored environment file; names in `.env.example`) and that each table exists and is closed to visitors. Database tables live in `supabase/migrations`; never put the secret key in the repo
- `npm run icons:inventory` : regenerate `src/design-system/iconInventory.js` after adding or changing any SVG in `public/assets`

## Design rules (read `docs/design-system.md` first)

1. **Source priority:** the real-app screenshots beat the design doc; where the screenshots are silent, keep the doc's value; anything else is a PROPOSAL that needs approval. Measurements and the screenshot key (S1 to S14) are in `docs/screenshot-audit.md`. The screenshots themselves are not in the repo.
2. **Tokens only.** Raw colours, font sizes, radii, spacing and shadows are allowed only in `src/styles/tokens.css`. Everywhere else use `var(--token)`. `scripts/check-tokens.mjs` enforces this. Do not add a raw value to get around it; add or reuse a token.
3. **v2.0 is the live look** on every screen (grey canvas, white cards, centred 56 px app bar, underlined fields, dark-green buttons, 5-item bottom nav). `docs/design-system.v1.0.backup.md` is the old system, kept for reference only.
4. **Reuse components** in `src/components` before writing new markup. If none fits, propose one and wait for approval.
5. Update `docs/design-system.md` and the style guide (`src/design-system`) when a token or component changes. Label new values Real, Real (est.), Figma (kept) or PROPOSAL.

## Icons and photos

- **Never edit, recolour, replace or delete an existing SVG.** New or redrawn icons are added as new files. Redrawn real-app icons are `nav-*.svg` (bottom nav) and `ui-*.svg` (33 files; only `ui-back.svg` is used so far). Icons are `<img>` files with baked colours, not `currentColor`.
- Travel Groups keeps the Cathay Together icon (`447b4.svg`, `5abd4.svg`) in the nav. Do not draw the Cathay logo; use the official file.
- Known rough icons: `ui-insurance-accident`, `ui-seat`, `ui-tag`, `ui-asia-miles*`, `ui-member-card`. See `docs/icon-audit.md`.
- Destination photos: `public/assets/photos/*-cover.jpg` (880x600) and `*-thumb.jpg` (240x240), registered with alt text in `src/data/photos.js`. `pickPhoto(destination, groupId)` gives each group a stable photo. Photographer credits are still empty (Unsplash, free licence; skip Unsplash+).

## Layout and behaviour notes

- Real-app dp values are used 1:1 as CSS px.
- Every screen: `Screen` > `StatusBar` > `PageHeader` > page body > `BottomNav`. The page title is the `h1` and gets focus after each route change (`AppShell` in `App.jsx`).
- Focus on fields is a 2 dp underline (no ring around the row). Keep every interactive element's hover, pressed, focus and disabled states.
- Routes: `/groups`, `/groups/new`, `/groups/:groupId/invite` (members), `/invite/:code`, `/design-system`, and the flight flow `/groups/:groupId/flights/search`, `/flights/outbound`, `/flights/return`, `/flights/:direction/:flightId/fares` (`?cabin=`, `?date=`, `?sheet=upgrade|compare`), plus `/groups/:groupId/board` (`?view=timeline`, `?sheet=book`), `/payment`, `/confirmed`. Other paths are placeholders (`ComingSoonPage`).
- Contrast: text 4.5:1, borders and focus 3:1. Known failures are flagged in the style guide, not hidden.

## Open items (not done)

- Extra v2.0 tokens in `docs/design-system.md` section 10 (`gutter-tight`, `text-chip`, `canvas-home`, ...) are not added; add each when its screen is built.
- Unconfirmed: typeface (Inter is a guess), the two scrim values, card shadow blur, hero IATA size, fare-card radius. Active My trips and Profile nav states are a PROPOSAL.
