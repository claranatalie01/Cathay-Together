# Mismatch report

> **Historical prototype audit.** See the [design system](design-system.md) for the current UI and the [README](../README.md) for current setup.

Where this demo differs from the real Cathay Android app and from the Figma file. Source priority is real-app screenshots, then `docs/design-system.md` (v2.0), then Figma and the original prototype. Anything marked PROPOSAL was not in a source and was approved or built on your request.

## Differs from the real app (screenshots S1 to S14)

| Area | Real app | This demo | Why |
|---|---|---|---|
| Book a trip | Multi-city, promotion code, promo carousel, "Redeem flight with miles" | Not built. The swap button is decorative (home airport to Tokyo only) | Out of scope for a group-flight demo |
| Flight results | Filter icon | Not built | You did not ask for filters |
| Fill-in information | A passenger details screen | Not built | You disliked the preview and did not ask again |
| Results header | Photo runs under the status bar | Photo sits in a white status-bar frame | Kept the prototype wing photo as you asked |
| Fare and Fill-in screens | No bottom nav | Fare page has none (matches). Other screens keep the 5-item nav | Follows the real app where shown |
| Travel Groups nav item | "Travel tools" | Travel Groups, with the Cathay Together icon | Your decision |
| My trips and Profile active states | Not visible | Teal active state | PROPOSAL |
| Payment | Real card entry | Simulated "Pay now" with a 20 minute hold. No card details are taken | Frontend-only demo |
| Fare rows | Fit on one line | Long values such as "Free (Regular seats)" can wrap to two lines at 375px | Kept readable instead of truncating |

## Differs from Figma / the original prototype

| Area | Original | This demo |
|---|---|---|
| Group details accents | Steel blue and sand accents, gradient callout | Teal and peach only, flat callout, solid photo-label strip (`color-overlay-photo-label`, PROPOSAL) |
| Group timing | Red "+15m" late label | Dropped (3.4:1 contrast). Amber "Outside your window +2h" instead |
| Next step card | Not in the prototype | New component with a four-step tracker (PROPOSAL, approved) |
| Itinerary preferences | Helper lines "Swipe left to pass..." and "Choice selected..." | Removed. "Choose Pass or Like to continue" and the final tally stay |
| Itinerary | Edit only | Edit and Done (PROPOSAL, approved) |
| Preferences entry | Always visible | Only after your flight is booked |

## Known design-system gaps

- **Unconfirmed values:** typeface (Inter is a guess), the two scrim values, card shadow blur, hero IATA size, fare-card radius.
- **Contrast flagged, not hidden:** `text-secondary` is 4.2:1 on `surface-brand-subtle` (the Next step card uses primary text for its labels, but "About 1 minute..." under the preferences photos still uses secondary); `text-danger` is 3.4:1 on white; `text-accent` ("Lowest Fare") is 2.0:1 on white; default borders are 1.3:1 on white.
- **Rough icons:** `ui-insurance-accident`, `ui-seat`, `ui-tag`, `ui-asia-miles*`, `ui-member-card` (see `docs/icon-audit.md`). New icons were redrawn by eye, so they are close, not exact.
- **Photos:** photographer credits are still empty (Unsplash, free licence).
- **Extra v2.0 tokens** listed in `docs/design-system.md` section 10 (`gutter-tight`, `text-chip`, `canvas-home` and others) are not added because no screen uses them yet.
- **Style guide** shows an "error state" sample, so the text "Something went wrong" appears on `/design-system` by design.

## Product decisions still open

- The Members page and Group details are near-copies with different status words (Booked vs Ready). Merging them would remove the confusion.
- After booking, the "Pick flight" row stays on the group page; "View your booking" may be clearer.
- The board button says "Book now" while the sheet is about paying; "Review & pay" would match the Next step card.
- Back button: the icon is 24px as in the real app, with a 44px tap area added around it.

## Demo-only parts

The prototype used a browser mock backend (`src/api/mock`, `localStorage` key `cathay-mock-db-v3`), a "Demo only" panel (`src/demo`) and `/reset`. The shared app has since retired all three.
