# Icon and vector audit: real-app screenshots vs Cathay Together icon set

Checked all 14 screenshots (S1 to S14, key in `docs/screenshot-audit.md`) against the SVG files in `public/assets`.

**Rule applied.** Where the real app has the same icon as your set, the screenshot version wins. You named Home, Book, My trips and Profile; those are done. Travel Groups keeps the Cathay Together icon. Every other icon is **listed, not changed**, so you decide. Existing files are never edited, replaced or removed.

**Method note.** "Looks similar" means I compared the screenshot glyph with the rendered file by eye. It is a judgement, not a pixel match. Confidence is ESTIMATED. Icons smaller than about 20 px in the screenshots could not be matched reliably.

## Done in this change

| Tab | Real app (screenshots) | New file(s) | Status |
|---|---|---|---|
| Home | grey outline house, filled teal when active (S1, S3) | `nav-home.svg`, `nav-home-active.svg` | Done. Used by the v2 nav |
| Book | grey outline plane, filled teal plane when active (S1, S3) | `nav-book.svg`, `nav-book-active.svg` | Done |
| My trips | grey outline briefcase (S1, S3) | `nav-trips.svg`, `nav-trips-active.svg` | Done. Active state is a PROPOSAL (not visible) |
| Profile | grey outline person (S1, S3) | `nav-profile.svg`, `nav-profile-active.svg` | Done. Active state is a PROPOSAL |
| Travel Groups | not in the real app ("Travel tools") | existing `447b4.svg` / `5abd4.svg` | Kept (Cathay Together) |

The new files are redrawn by eye from the screenshots at 24 x 24 (grey `#646464`, teal `#336c6a`). They are close, not exact: the real person icon has a continuous head-and-shoulders line, the real house has a small eave gap and the real briefcase a small clasp. Compare against your original assets and swap in the official files if you have them.

## Redrawn: 33 `ui-*.svg` files (new files, originals untouched)

Every icon marked below as RETAIN or NEW was also redrawn from the screenshots as a separate `ui-*.svg` file: swap, chevron-down, chevron-right, back, back-light, close, tag, bell, dots, plane, plane-dark, ticket, member-card, asia-miles, asia-miles-teal, pencil, pencil-light, filter, seat, info, baggage, change-flight, cancel-flight, cross-badge, check-badge, share, heart, radio, radio-on and four `ui-insurance-*` glyphs. Only `ui-back.svg` is used by a screen so far (the app-bar back arrow). The other 32 are available for later screens. Weak approximations: `ui-insurance-accident`, `ui-seat`, `ui-tag`, `ui-asia-miles*`, `ui-member-card` (no logo, on purpose).

## Every other icon in the screenshots (your original files, unchanged)

| Icon in screenshots | Where | Similar file in your set? | Status |
|---|---|---|---|
| Swap arrows in a circle | S1 | looks similar: `38cb6` | RETAIN (note only), not replaced |
| Chevron down | S1 | looks similar: `fa628` | RETAIN (note only) |
| Chevron right | S1, S3, S10 | looks similar: `e84e3` | RETAIN (note only) |
| Back chevron | S5, S6, S10 | looks similar: `65e02`, `a7296`, `c0822` | RETAIN (note only) |
| Close X | S9, S11, S13 | looks similar: `702d9`, `86cae`, `9a5a4` | RETAIN (note only) |
| Heart outline | S1, S10 | looks similar: `4714d`, `5ea58`, `977c7` | RETAIN (note only) |
| "..." menu | S3 | looks similar: `7adfe` | RETAIN (note only) |
| Filter sliders | S5 | looks similar: `ed943` | RETAIN (note only) |
| Seat | S6, S7, S12 | looks similar: `d8af5` | RETAIN (note only) |
| Baggage | S6, S7 | looks similar: `6bcf2` | RETAIN (note only) |
| Plane with a slash (cancel) | S6, S7 | looks similar: `83cc5` | RETAIN (note only) |
| Small plane on a route or progress line | S2, S4, S5, S8 | looks similar: `3d80d`, `7dd8e`, `bbe67` | RETAIN (note only) |
| Progress and radio dots | S2, S4, S8, S14 | looks similar: `4fb4e`, `78a4d`, `78f49`, `f4c8e` | RETAIN (note only) |
| Check circle (filled badge, white tick) | S9, S10, S11 | outline versions only: `017d2`, `389be`, `dfcc9` | NEW (for information only): the filled style |
| Cross badge (grey circle, white x) | S9, S11 | none | NEW (for information only) |
| Info "!" circle | S6, S7 | none | NEW (for information only) |
| Change-flight (circular arrows with plane) | S6, S7 | none | NEW (for information only) |
| Promo tag | S1 | none | NEW (for information only) |
| Ticket (banner) | S3 | none | NEW (for information only) |
| Bell | S3 | none | NEW (for information only) |
| Plane inside a circle (Home search card) | S3 | none | NEW (for information only) |
| Member card (teal, beside name) | S3, S10 | none | NEW (for information only) |
| Asia Miles "A" mark | S3, S11, S14 | none | NEW (for information only) |
| Edit pencil | S5, S10 | none | NEW (for information only) |
| Share | S10 | none | NEW (for information only) |
| Insurance glyphs: miles, medical heart, person, plane | S14 | none confirmed | NEW (for information only) |
| Cathay brushwing logo | S2, S3, S4, S8 | brand logo | Not drawn. Use your official logo file |
| Status-bar icons (signal, wifi, battery) | all | `962bc`, `b0ee8`, `87706` | Phone system UI, not product UI |

## In your set but not seen in any screenshot

Present in `public/assets` and not matched to any screenshot icon, for example the calendar (`4341a`, `f2969`), sun and moon (`47ce3`, `4969a`), clock (`4bc73`), copy (`76582`, `c9816`) and person-circle (`2fa4b`) icons, plus the rest of the 65 originals. Kept as they are. The full list with previews is the Icons section of `/design-system`.
