# Cathay Together: real-app screenshot audit against `docs/design-system.md`

Source of truth: the 14 screenshots from the real Cathay Pacific Android app. Document compared: `docs/design-system.md` v1.0 plus `src/styles/tokens.css`. Nothing here changes a token. You decide every merge and every change.

## How to read this

**Screenshot key** (display order)

| # | Screen |
|---|---|
| S1 | Book a trip (Return form) |
| S2 | Loading splash, "free 24-hour cancellation" |
| S3 | Home |
| S4 | "Searching flights HKG to Tokyo" splash (photo only, white text) |
| S5 | Flight results list |
| S6 | Select departing flight fare (738 px) |
| S7 | Same screen, full-length scroll capture (1080 px native) |
| S8 | Loading splash, "World's Top 3 Best Airlines" |
| S9 | "Upgrade to Essential" bottom sheet |
| S10 | Fill in information |
| S11 | Compare fare types sheet |
| S12 | Transition: loading mark over a faded Insurance screen |
| S13 | Express checkout sheet |
| S14 | Travel Insurance (No thanks selected) |

**Units.** The screenshots are 738 px wide (S7 is 1080 px, the native capture). The phone is a 1080 x 2340 Android. Several results come out as round numbers only at a 411 dp screen (2.625 px/dp): gutter 24 dp, primary button 52 dp, tab row 48 dp, five equal nav items of 82 dp. So every size below is in **dp**, converted at 1.796 px/dp from the 738 px shots. Your demo frame is 440 px wide and the real screen is about 411 dp. The gutter and button heights match 1:1, so I compare dp to your px directly. The conversion is inferred, not read from the images, so every dp value is ESTIMATED at about ±0.6 dp. If the phone were really 360 dp, every dp value would be about 14% bigger and the 24 dp gutter would be 21 dp, which is unlikely.

**Confidence**
- **EXACT**: a flat fill read from pixels (mode of the area, JPEG noise about ±2 per channel), or a clearly measurable edge (±1 px, about ±0.6 dp).
- **ESTIMATED**: anything else. Thin text and thin strokes are anti-aliased, so their colour reads lighter than the true value. The stated ± is how far off I think it could be.
- **Font size** is ESTIMATED from cap-height divided by 0.71. That ratio is assumed, because I cannot identify the typeface. Treat sizes as ±1.5 sp.

---

## A. Summary: the 10 biggest differences

| # | Difference | Document | Real app | Confidence |
|---|---|---|---|---|
| 1 | **Primary button colour** | `#006564` teal | `#2c4035` dark forest green, white label | EXACT |
| 2 | **Screen and card surfaces are inverted** | white screen, `#f4f8f7` cards | grey canvas (`#f8f8f8`, `#f9f8f6` or `#f2f1ef`), **white** cards | EXACT |
| 3 | **Text colours are neutral grey, not blue-green** | primary `#172e33`, secondary `#647578` | primary about `#262626`, secondary about `#6b6b6b` (R=G=B) | ESTIMATED ±8 |
| 4 | **The brand teal in the document is not used** | `#006564` for text, icons, borders, selection | mid-teal about `#336c6a` and a separate deep teal about `#035256`. `#006564` appears only as the right-hand end of a gradient | EXACT (fills), ESTIMATED (deep teal) |
| 5 | **Dividers and borders are neutral grey** | `#dce6e4` (green-tinted) | `#e7e7e7` to `#eaeaea`, 1 dp | EXACT |
| 6 | **Sheet top radius** | 20 | about 16 (same as your existing `card-lg` token) | ESTIMATED ±1.5 |
| 7 | **Scrim is neutral black, not tinted** | `rgba(23,46,51,.44)` | black, about 40% (S13) and about 32% (S9) | alpha ESTIMATED ±2% |
| 8 | **Gutter is not constant** | 24 everywhere | 24 on Book, Results, Fare, Fill-in. **16** on Home and Express checkout | EXACT (edges) |
| 9 | **"Lowest Fare" and "Seats left" colour** | `#ecaa4d` (2.01:1) | dark orange-brown about `#8a6040` (5.5:1) | ESTIMATED ±10 |
| 10 | **Button sizes and label size** | 52 tall, 16 px label | 52 **and 56** tall, 38 for in-card Select, label about 18 sp | EXACT (heights), ESTIMATED (size) |

Also notable: selected-option border is about 1 dp, not 3 px; card shadow is much softer and wider than "XXS Shadow"; app-bar title is regular weight, dark grey, centred, about 20 sp (document: `page-title` 25/30, semibold, brand); bottom-nav labels are grey, not black. The real tab bar has Home, Book, My trips, Profile, Travel tools. "Travel Groups" never appears.

---

## B. Tables

### B1. Colour

| Item | Value in screenshots | Value in my document | Status | Confidence | Which screenshot |
|---|---|---|---|---|---|
| Primary button fill | `#2c4035` | `surface-brand` `#006564` | **CONFLICT**. Recommend `#2c4035` | EXACT | S1, S6, S7, S9, S10, S13, S14 |
| Button label on primary | about `#ffffff` (reads `#f8fffd`) | `text-inverse` `#ffffff` | MATCH | ESTIMATED ±3 | same |
| Mid-teal: IATA codes, active tab and nav, links, route times, filter icon, radio and check fills | about `#336c6a`. Solid fills read `#316c6a`, `#336c6b`, `#346c6a`. Thin text reads `#346f6e` to `#486f6c` because of anti-aliasing | `text-brand` / `border-brand` / `surface-brand` `#006564` | **CONFLICT**. Recommend `#336c6a` | EXACT for fills (±3), ESTIMATED for text | S1, S3, S5, S10, S11, S14 |
| Deep teal: fare tier names, comparison column heads, Economy tab on fare screens | text about `#035256` (bold strokes read `#035256`, `#055053`, `#065154`, `#075154`). Tab indicator about `#025b61` | none (nearest `#006564`) | **NEW** | ESTIMATED ±5 | S6, S7, S9, S11 |
| Teal gradients: selected segment fill; fare-card top strips | segment `#337776` to `#056065` left to right. Strips: Light `#c7d9d9` to `#94bdbf`, Essential `#93babd` to `#347a83`. Flex strip is darker (not sampled) | none | **NEW** | ESTIMATED (6 sample points, looked linear) | S5, S6, S7 |
| Class-name colours | "Premium Economy" about `#3a677b`; "Business" about `#182c51` | none | **NEW** | ESTIMATED ±6 | S5, S6, S11 |
| Primary text | neutral about `#262626` (R=G=B in every shot, range `#222` to `#2c2c2c`) | `text-primary` `#172e33` | **CONFLICT**. Recommend `#262626` | ESTIMATED ±8 (thin strokes read lighter, so the true value is the same or darker) | all |
| Secondary text | neutral about `#6b6b6b` (reads `#646464` to `#757575`) | `text-secondary` `#647578` | **CONFLICT**. Recommend `#6b6b6b` | ESTIMATED ±8 | S1, S3, S5, S10 |
| Pure black text | `#000000` on table row labels and group heads in the sheets | `text-strong` `#000000` | MATCH (value). **Use differs**: the flight card text is `#262626` and nav labels are grey, not black | EXACT | S9, S11 |
| Accent text "Lowest Fare", "9 Seats Left" | about `#8a6040` | `text-accent` `#ecaa4d` | **CONFLICT**. Recommend `#8a6040` | ESTIMATED ±10 | S5 |
| Peach chip surface (promo chip, "Recommended") | `#feede6` / `#fcede6` | none. Closest by role: `surface-warning` `#fbf5ea`, `surface-caution` `#fff3d6` | **NEW** (different hue) | EXACT ±2 | S1, S6 |
| Peach chip text | about `#905730` to `#915e3c` (chevron ink `#854b25`) | `text-warning` `#886a38`, `text-caution` `#854d0e` | **NEW** | ESTIMATED ±12 | S1, S6 |
| Screen canvas | `#f8f8f8` (S1, S5, S6), `#f9f8f6` (S3), `#f2f1ef` (S10, S14). S7 reads `#f9f9f9`, `#f8f8f8`, `#f6f6f6` | `surface-default` `#ffffff` is the screen | **CONFLICT** | EXACT per screen. I cannot say whether `#f8f8f8` and `#f9f9f9` are one token | S1, S3, S5, S6, S7, S10, S14 |
| Card surface | `#ffffff` on the grey canvas | `surface-subtle` `#f4f8f7` for cards | **CONFLICT** (inverted) | EXACT | S1, S3, S5, S6, S10, S14 |
| Inner panel inside fare cards; Compare footer | `#f9f9f9` | `surface-field` `#fbfbfb` | MATCH (value within ±2). Role differs (doc: search form, date chips) | ESTIMATED | S6, S11 |
| Selected option fill; Flex column; tab sub-fill | `#e9f3f2`; `#e8f4f4` | `surface-brand-subtle` `#e6f2ef` | MATCH within ±3 | EXACT ±2 | S14, S11 |
| "Economy Light" chip fill | about `#e4eeef` | `surface-brand-subtle` `#e6f2ef` | MATCH within ±3 | ESTIMATED | S10 |
| Home "Flying soon?" banner | about `#e5eeeb`, darker `#d8e6e6` at lower left (may be a gradient) | `surface-brand-subtle` `#e6f2ef` | MATCH within ±4 | ESTIMATED | S3 |
| Comparison column heads | Light `#f9fdfe`, Essential `#f6fafb` | `surface-subtle` `#f4f8f7` is the nearest | **NEW** (two near-white cool tints) | EXACT ±2 | S9, S11 |
| Dividers, card separators, table lines | neutral `#e7e7e7` to `#eaeaea`, about 1 dp | `border-default` / `divider` `#dce6e4` | **CONFLICT**. Recommend `#e8e8e8` | EXACT | S1, S5, S6, S7, S9, S10, S11 |
| Unselected option border | `#e7e7e7`, 1 dp, white fill | `border-default` `#dce6e4` | **CONFLICT** (same as above) | EXACT | S14 |
| Selected option border | teal about `#3f6a64` to `#4f7671`, about 1 dp, on `#e9f3f2` | `border-brand` `#006564`, `border-width-selected` 3 | **CONFLICT** (colour and width) | ESTIMATED (thin line, JPEG) | S14 |
| Secondary button border and label | white fill, teal border about 1 dp, teal label | white fill, brand border and label | MATCH (structure). Teal value as in the mid-teal row | ESTIMATED | S9, S13 |
| Radio ring (unselected) | about `#b9b9b9` (thin, true value probably darker) | none | **NEW** | ESTIMATED ±20 | S14 |
| Scrim | black. S13 `#999999` over white and `#92918f` over `#f2f1ef` = about 40%. S9 `#adadad` over white header = about 32% | `overlay-scrim` `rgba(23,46,51,.44)` | **CONFLICT**. Recommend `rgba(0,0,0,.40)`. S9 may use about .32 | resulting colours EXACT, alpha ESTIMATED ±2% | S9, S13 |
| Sheet handle | `#e3e3e3` to `#e6e7e9`, about 37 x 4 dp (S13), about 47 x 4 dp (S9) | `divider` `#dce6e4` | **CONFLICT** (neutral grey). Size **NEW**. The two sheets differ, I do not know why | ESTIMATED | S9, S13 |
| Loading overlay | white veil about 80% over the whole screen. Continue button reads `#d5d9d8` | `opacity-disabled` 0.6 on the control | **NEW / unclear**. This is a screen-level veil, not a per-button disabled style | ESTIMATED | S12 |
| Loading mark | teal circle about `#5f9691`, about 81 dp across, white seat glyph | State message "building" | **NEW** | ESTIMATED | S12 |
| Progress end label (inactive "HND") | about `#e4e5e6` | none | **NEW** (about 1.26:1 on white) | ESTIMATED | S2, S8 |
| Progress track (grey line) | visible, light grey. Not sampled | `neutral-line` `#d9d9d9`, `neutral-track` `#d3d3d3` | MISSING (value not measured) | n/a | S2, S8 |
| Icon ink: content icons | about `#191919` to `#2a2a2a`. Teal icons about `#316c6a`. Inactive nav icons about `#595959` to `#646464` | `icon-default` `#141b34`, `icon-brand` `#006564` | RETAIN (note only) | ESTIMATED | S1, S5, S6, S10 |
| `text-danger`, `border-danger` | no error state visible | `#ff474c` | MISSING | n/a | none |
| `text-warning` / `surface-warning` ("Booked" chip) | not visible | `#886a38` / `#fbf5ea` | MISSING | n/a | none |
| `text-caution` / `surface-caution` (arrival badge) | not visible | `#854d0e` / `#fff3d6` | MISSING | n/a | none |
| `text-pass`, `border-pass` (PASSED stamp) | not visible | `#796c69` | MISSING | n/a | none |
| `surface-fare` `#a8dcab` | not visible | `#a8dcab` at 25% | MISSING | n/a | none |
| `border-strong`, `border-strong-alt` | no dark card border anywhere. Flight cards have no border | `rgba(0,0,0,.43)` / `.54` | MISSING | n/a | S5 |
| `color-focus-ring`, `border-inverse` avatar ring | not visible (touch UI, no avatar) | `#006564`, `#ffffff` | MISSING | n/a | none |

### B2. Typography

The family cannot be identified from a screenshot. I **cannot confirm Inter**. Compare glyph shapes on S2 ("24-hour") and S7 ("HKD6,691") at full size. Sizes are cap-height / 0.71 (assumption), ±1.5 sp.

| Item | Value in screenshots | Value in my document | Status | Confidence | Which screenshot |
|---|---|---|---|---|---|
| Font family | not identifiable | Inter; Lexend for flight-search filters | UNKNOWN. Lexend: MISSING (no filter screen) | n/a | all |
| Hero IATA code (Book, "HKG") | cap 24.5 dp, so about 34 sp, bold, mid-teal | `display` 32/39 or `code` 36/44 | **CONFLICT**. 34 sits between them. Needs a sharper crop | ESTIMATED ±1.5 | S1, S2 |
| Home IATA ("HKG", "Search") | cap 18.4 dp, about 26 sp, bold, mid-teal | `display-sm` 26/31 | MATCH (≈) | ESTIMATED | S3 |
| App-bar title ("Select departing flight fare", "Fill in information") | cap 14.5 dp, about 20 sp, regular, `#282828`, centred | `page-title` 25/30, semibold, brand | **CONFLICT** (size, weight, colour, alignment) | ESTIMATED | S6, S10, S11 |
| Sheet title ("Upgrade to Essential", "Express checkout") | about 20 sp, regular, `#2a2a2a` | `page-title` 25/30 also for sheet title | **CONFLICT** | ESTIMATED | S9, S13 |
| Section titles ("Passenger", "Contact", "Our latest offers") | cap 15.1 to 15.6 dp, about 21 to 22 sp, regular, `#282725` | `heading-sm` 21/25 / `heading-md` 22/27 | MATCH (≈). Weight: doc says semibold for page-title only | ESTIMATED | S3, S10 |
| Fare tier name ("Light", "Essential", "Flex") | about 19 sp, bold, deep teal | `title-sm` 18/22 or `title-md` 19/23 | MATCH (≈) | ESTIMATED | S6, S7 |
| Fare price ("HKD6,691") | about 19 to 20 sp, bold | `title-md` 19/23 or `title` 20/24 | MATCH (≈) | ESTIMATED | S6, S7 |
| Result time and airport code ("08:55", "HKG") | digit cap 12.8 dp and 13.4 dp, about 18 sp. Time is teal semibold, code is dark | `title-sm` 18/22 | MATCH (≈) | ESTIMATED | S5 |
| Result price ("HKD6,691") | cap 11.7 dp, about 16.5 sp, bold | `body-xl` 16/19 | MATCH (≈) | ESTIMATED | S5 |
| Home card price / title | about 18 sp bold / about 19 sp regular | `title-sm` 18/22 | MATCH (≈) | ESTIMATED | S3 |
| Primary button label ("Search flight", "Straight to payment") | cap 12.8 to 13.4 dp, about 18 to 19 sp | `body-xl` 16/19 | **CONFLICT** (about 2 sp bigger) | ESTIMATED | S1, S13 |
| In-card "Select" label | cap 11.1 dp, about 16 sp | `body-xl` 16/19 | MATCH (≈) | ESTIMATED | S6 |
| Field value ("Tue 10 Nov 2026", "Economy, 1 Adult") | cap 11.1 dp, about 16 sp | `body-xl` 16/19 | MATCH (≈) | ESTIMATED | S1 |
| City name ("Hong Kong"), row labels ("Regular seat") | cap 10.0 dp, about 14 sp | `body` 14/17 | MATCH (≈) | ESTIMATED | S1, S9, S11 |
| Field labels ("Departing"), fare subtitle ("Good value") | cap 8.4 dp, about 12 sp, grey | `caption` 12/15 | MATCH (≈) | ESTIMATED | S1, S6 |
| Date tabs and price | cap 9.5 dp, about 13 sp | `body-sm` 13/16 | MATCH (≈) | ESTIMATED | S5 |
| Flight number ("CX548") | cap 9.5 dp, about 13 sp, grey | `body-sm` 13/16 | MATCH (≈) | ESTIMATED | S5 |
| "9 Seats Left" | cap 8.4 dp, about 12 sp, orange-brown | `caption` 12/15 | MATCH (≈). Colour differs | ESTIMATED | S5 |
| Table cell values | cap 8.9 dp, about 12.5 sp | `caption` 12 or `body-sm` 13 | UNCLEAR | ESTIMATED ±1.5 | S9, S11 |
| Bottom-nav labels | cap 7.2 dp, about 10 sp, grey `#6f6f6f` | `micro` 10/12, colour `text-strong` | Size MATCH (≈). **Colour CONFLICT** | ESTIMATED | S1, S3 |
| Splash headline, 2 lines | cap 18.4 dp, about 26 sp. Line spacing **33.4 dp** (about 1.28) | `display-sm` 26/31 single line; heading ratio 1.2 | **CONFLICT** (leading 2.4 dp larger than 31) | line spacing EXACT ±0.6 dp | S2, S8 |
| Sheet body, 2 lines ("Upgrade for just HKD450...") | line spacing 26.2 dp. Size not measured | `leading-body` 1.45 | UNCLEAR (ratio unknowable without size) | line spacing EXACT | S9 |
| Insurance bullets and option text | line spacing 24.5 to 25.6 dp, size about 16 sp, so ratio about 1.55 | `leading-body` 1.45 | **CONFLICT** (slightly looser) | ESTIMATED | S14 |
| Express body copy | line spacing 20.1 dp. Size not measured | `leading-body` 1.45 | UNCLEAR | line spacing EXACT | S13 |
| Weights | regular for most text; bold-looking for IATA codes, prices, tier names, selected segment | 400 / 500 / 600 / 700 | UNCLEAR. I cannot tell 500 from 600 | n/a | all |
| Sizes with no evidence | 11, 17, 23, 25, 36, 44 px not seen. Nothing resembles invite-code or timer text | `caption-sm`, `title-xs`, `heading`, `page-title`, `code`, `timer` | MISSING | n/a | none |

### B3. Spacing and sizing (dp)

| Item | Value in screenshots | Value in my document | Status | Confidence | Which screenshot |
|---|---|---|---|---|---|
| Screen gutter: Book card, Results, Fare, Fill-in, Insurance | 24 (card left edge at 43 px) | `space-xl` 24 | MATCH | edge EXACT, dp ESTIMATED | S1, S5, S6, S10, S14 |
| Screen gutter: Home (search card, cards, headings) | **16** (left edge at 29 px) | 24 everywhere | **CONFLICT** | edge EXACT | S3 |
| Express checkout sheet content inset | **16** (button left edge 29 px) | 24 | **CONFLICT** | edge EXACT | S13 |
| Upgrade sheet content inset | 24 (43 px) | 24 | MATCH | edge EXACT | S9 |
| Book card inner padding | 24 (86 − 43 px) | `space-xl` 24 | MATCH | EXACT | S1 |
| Fill-in and Insurance card inner padding | 16 (72 − 43 px) | `space-lg` 16 | MATCH | EXACT | S10, S14 |
| Fare card: inner panel inset | 11 to 12 (20 px). Content inside the panel about 14 | `space-md` 12; 14 exists as optical-14 | UNCLEAR (11 vs 12) | ±0.6 dp | S6 |
| Result cards: gap between cards | 16 (29 px) | `space-lg` 16 | MATCH | EXACT | S5 |
| Result card height | 129 | not stated | NEW | EXACT | S5 |
| Result card split (ticket): left part / right part | 242 / 120, with a 1 dp divider (`#e9e9e9`) and a 1.7 dp gap | not stated | NEW | EXACT | S5 |
| Fare cards: gap between cards | about 24 (card bottom to next strip, 45 px) | not stated | NEW | ESTIMATED | S6, S7 |
| Fare card top strip height | 6 (11 px) | not stated | NEW | EXACT | S6 |
| Full-width button height (Search, Upgrade, Continue with Light) | **52** (93 px) | 52 | MATCH | EXACT | S1, S9 |
| Button height (Continue on Fill-in, both Express buttons) | **56** (99 to 100 px) | Figma 54 (defined, not built) | **CONFLICT** (2 dp) | EXACT edge, scale-sensitive | S10, S13 |
| In-card "Select" button | 38 (68 px) wide 105 | Figma 39 | MATCH (±1) | EXACT | S6 |
| Tab row height | 48 (126 px at 1080) | not stated | NEW | EXACT | S7 |
| Tab indicator | about 3 thick, same width as the label (about 67 wide for "Economy") | not stated | NEW | ESTIMATED ±1 | S5, S6, S11 |
| Top of screen to first divider (status bar + app bar) | 91 (239 px at 1080). Cannot split the status bar from the app bar | not stated | NEW | EXACT total | S7 |
| Bottom nav item width | 82 each, five equal items (centres 74, 221, 369, 516, 664 px) | not stated | NEW | EXACT | S1, S3 |
| Bottom nav height | cannot tell. The system nav buttons sit on the same white | not stated | cannot tell | n/a | S1, S3 |
| Nav icon to label gap | 6.7 (12 px, Home icon bottom to label top) | not stated | NEW (note) | EXACT ±0.6 | S1 |
| Label column in fare rows | text starts at one x for every row (130 px), regardless of icon width | not stated | NEW | EXACT | S6 |
| Home gutter vs Book gutter | see rows above: 16 vs 24 | one gutter | **CONFLICT** | EXACT | S1, S3 |

### B4. Corner radius (dp, ESTIMATED ±1.5, fitted to the corner curve)

| Item | Value in screenshots | Value in my document | Status | Confidence | Which screenshot |
|---|---|---|---|---|---|
| Buttons (primary, outlined, express) | 7 to 8 | `control` 8 | MATCH | ESTIMATED | S1, S6, S9, S10, S13 |
| Search card (Book) | 12.8 | `card` 12 | MATCH | ESTIMATED | S1 |
| Result card, Fill-in cards, inner panel | 8 to 9 | `control` 8 | MATCH | ESTIMATED | S5, S6, S10 |
| Fare card | 10.6 | `button-lg` 10 or `card` 12 | MATCH? Either token fits. Needs a sharper crop | ESTIMATED | S6 |
| Bottom-sheet top corners | **15.6 to 16.2** | `sheet` 20 | **CONFLICT**. Recommend 16 (`card-lg` already exists) | ESTIMATED | S9, S13 |
| Promo chip | 3.9 | none between `bar` 3 and `badge` 5 | **CONFLICT / NEW** | ESTIMATED | S1 |
| "Economy Light" chip | 2.8 | `bar` 3 | MATCH | ESTIMATED | S10 |
| Selected insurance option | 5.6 | `thumb` 6 or `badge` 5 | MATCH (≈) | ESTIMATED | S14 |
| Home banner | 6.1 | `thumb` 6 | MATCH | ESTIMATED | S3 |
| Swap button, radios, check circles, loading mark | fully round | `pill` 100 | MATCH | EXACT | S1, S10, S12, S14 |
| `hairline` 2, `badge` 5, `panel` 14, `sheet` 20 | not evidenced | listed | MISSING | n/a | none |
| Segmented control, tab indicator corners | visible, not measured | none | NEW (not measured) | n/a | S5, S6 |

### B5. Border and shadow

| Item | Value in screenshots | Value in my document | Status | Confidence | Which screenshot |
|---|---|---|---|---|---|
| Hairline width | about 1 dp | `border-width-default` 1 | MATCH (width). Colour: see B1 | ESTIMATED | S1, S5, S7, S9, S11 |
| Selected option border width | about 1 dp | `border-width-selected` 3 | **CONFLICT** | ESTIMATED | S14 |
| Outlined button border | about 1 dp teal | 1 | MATCH | ESTIMATED | S9, S13 |
| Table and column lines | 1 dp `#e9eaec` / `#e4e8e9` | `border-default` | **CONFLICT** (colour, as B1) | EXACT | S9, S11 |
| Card shadow | soft, visible about 13 dp on every side, peak darkening about 3% of the canvas | `--shadow-card` (0 2px 4px −2px .12, 0 4px 4px −2px .08) | **CONFLICT**. Blur and offset cannot be recovered from the shot. I measured only extent and strength | ESTIMATED | S1, S5, S10 |
| Sheet shadow | none visible (scrim only) | none stated | MATCH | ESTIMATED | S9, S13 |

### B6. Icons: RETAIN (note only). I am not proposing any change.

Your icon files have hash names, so I cannot match them to these by name. Treat every row as **RETAIN (note only)**. These are probably NEW, for information only, since they look beyond a group-travel prototype. Check your folder before assuming: bell, ticket, tag, filter sliders, baggage, change-flight, cancel-plane, seat, share, heart, member card, Asia Miles "A" mark, the four insurance glyphs, route plane, check and cross badges, loading seat.

| Item | Displayed size dp (px at 738) | Stroke | Colour | Space to label | Status | Confidence | Which screenshot |
|---|---|---|---|---|---|---|---|
| Nav Home, My trips, Profile, Travel tools | 16 to 18 wide x 17 to 21 tall (29 to 33 px) | about 2 dp | about `#595959` to `#646464` | 6.7 to label top | RETAIN (note only) | ESTIMATED | S1, S3 |
| Nav Book (active) | 20 x 21 (36 x 37) | about 3 to 4 dp (filled look) | about `#316967` | 6.7 | RETAIN (note only) | ESTIMATED | S1 |
| Swap button (circle, with arrows) | circle 36; arrows 25 x 22 | arrows about 3 dp, ring about 1 dp | about `#3f6c68` | none | RETAIN (note only) | ESTIMATED | S1 |
| Tag (promo code) | 17 x 17 | about 3 dp | about `#426662` | 6.7 (text starts 12 px after icon) | RETAIN (note only) | ESTIMATED | S1 |
| Cabin chevron down / chevrons right | 16 x 10 / 7 to 9 x 11 to 15 | about 3 dp | about `#484848` / `#111310` | n/a | RETAIN (note only) | ESTIMATED | S1, S3 |
| Back chevron | 10 x 16.5 | about 4 dp | `#2a2a2a` (white on photo) | n/a | RETAIN (note only) | ESTIMATED | S5, S6, S10 |
| Close X | 14 x 14 | about 3 dp | about `#191919` | n/a | RETAIN (note only) | ESTIMATED | S9, S11, S13 |
| Edit pencil, share, heart | about 18 to 23 | about 3 dp | about `#191919` to `#242528` | n/a | RETAIN (note only) | ESTIMATED | S5, S10 |
| Filter sliders | 18 x 21 | about 2.5 dp | about `#3f6664` (teal) | n/a | RETAIN (note only) | ESTIMATED | S5 |
| Route plane | 17 x 14 | about 3 dp | about `#1d1d1d` | n/a | RETAIN (note only) | ESTIMATED | S5 |
| Fare row icons (seat, baggage, change, cancel) | 10 to 15 x 12 to 14 | about 2 dp | about `#2d2d2d` | **11 to 13** (label starts at x=130 px regardless of icon width) | RETAIN (note only) | ESTIMATED | S6 |
| Info "!" | 14 x 14 (filled) | n/a | about `#222222` | about 8 to the left label | RETAIN (note only) | ESTIMATED | S6 |
| Check / cross badge (comparison) | 17 x 17 (filled circle with white mark) | n/a | check about `#336c6a`; cross about `#b8b9bb` | n/a | RETAIN (note only) | ESTIMATED | S9, S11 |
| Check circle (passenger done) | 21 x 21 | filled | about `#336c6b` | 10 (text 18 px after icon) | RETAIN (note only) | ESTIMATED | S10 |
| Radio | 24.5 | ring about 2 dp; selected fill about `#316c6a` | ring about `#b9b9b9` | 8.4 | RETAIN (note only) | ESTIMATED | S14 |
| Insurance glyphs (4) | 32 (circle outline) | about 2 dp | about `#466b68` | 9 (text 16 px after icon) | RETAIN (note only) | ESTIMATED | S14 |
| Home banner ticket icon | 17 x 14.5 | about 2 dp | about `#21272a` | 10 | RETAIN (note only) | ESTIMATED | S3 |
| Bell, "…" menu (white on photo) | 22 x 21; 20 x 8 | about 3 dp | white | n/a | RETAIN (note only) | ESTIMATED | S3 |
| Member card icon beside name | 23 x 17 | about 2 dp | white on teal | n/a | RETAIN (note only) | ESTIMATED | S3, S10 |
| Loading seat glyph | about 28 tall inside an 81 dp circle | n/a | white | n/a | RETAIN (note only) | ESTIMATED | S12 |

### B7. Components and states

| Item | Value in screenshots | Value in my document | Status | Confidence | Which screenshot |
|---|---|---|---|---|---|
| Primary button | 52 or 56 tall, radius 8, `#2c4035`, white label about 18 sp | 52 tall, `#006564`, 16 px | **CONFLICT** | EXACT / ESTIMATED | S1, S9, S10, S13 |
| Secondary (outlined) button | 52 or 56 tall, white, 1 dp teal border and label | secondary 52, white | MATCH (structure) | ESTIMATED | S9, S13 |
| Small button ("Select" in fare card) | 38 tall, same green | Figma 39, not built | MATCH (≈) | EXACT | S6 |
| Tabs (Return, One way, Multi-city; Economy, Premium Economy; date tabs) | text with 3 dp indicator under the active one. Active is teal, inactive is dark or grey | "tabs" defined in Figma, not built | NEW (observed) | ESTIMATED | S1, S5, S6, S11 |
| Segmented control (Economy, Premium, Business + price delta) | selected segment has the teal gradient fill with white label | none | **NEW** | ESTIMATED | S5 |
| Flight/ticket card | white, left part and right part, 8 dp radius, no border, soft shadow | "flight/fare/suggestion cards defined in Figma, not built" | NEW (observed) | EXACT | S5 |
| Fare card | gradient strip, tier name, price, grey inner panel with 4 rows, "Fare comparison" link, Select | same | NEW (observed) | EXACT | S6, S7 |
| Chip | peach fill, 4 dp radius (promo, Recommended); light-teal fill, 3 dp radius (fare label) | Chip: neutral, primary, sand, tint | CONFLICT (peach does not map to sand) | ESTIMATED | S1, S6, S10 |
| Field (Book form) | no box. Label, value, 1 dp divider below. Chevron at right | Field: bordered, 8 dp radius | **CONFLICT** | EXACT | S1 |
| Bottom sheet | white, 16 dp top radius, 4 dp handle, left close X, centred title | Sheet + scrim, 20 dp, handle in `divider` | CONFLICT (radius, handle) | ESTIMATED | S9, S11, S13 |
| Option list (radio rows) | 1 dp border, 6 dp radius. Selected has teal-tint fill and teal border | Field / card | NEW (observed) | ESTIMATED | S14 |
| Sticky footer (Total + Continue) | white bar, hairline above, "Total HKD" left, 56 dp button right | none | NEW | EXACT | S10, S14 |
| Comparison table | 3 columns, tint on column 3 (Flex), fixed price footer with Select | none | NEW | EXACT | S11 |
| Bottom nav | 5 equal items (Home, Book, My trips, Profile, Travel tools); active is teal with a heavier icon, inactive grey; hairline on top | Bottom nav: Travel Groups or Book active | **CONFLICT** (Travel Groups not in the real app) | EXACT | S1, S3 |
| Status bar | real system bar, with white or transparent background | Status bar mock | MISSING (system UI, not product UI) | n/a | all |
| Page header | back chevron, centred regular title, 1 dp divider below | Page header with back | CONFLICT (see B2) | ESTIMATED | S6, S10, S11 |
| Photo header (S5, S10) | Tokyo photo with dark overlay; title and dates in white; rounded bottom-left curve | none | NEW (overlay colour not measured) | n/a | S5, S10 |
| Loading splash | photo or window illustration, headline, HKG to HND progress with plane glyph | State message "building" | NEW | EXACT | S2, S4, S8 |
| Loading (in flow) | white veil about 80% plus teal circle with seat glyph | Skeleton (P), "loading" on Button | CONFLICT (approach) | ESTIMATED | S12 |
| Hover, pressed, focus | not visible (touch UI) | proposed, all P | MISSING | n/a | none |
| Disabled | **no designed disabled button visible**. S12's grey Continue is a veil effect | `opacity-disabled` 0.6 | MISSING | n/a | S12 |
| Error / empty / unavailable | "Not available" date tab (S5) is plain grey text `#6a6a6a`, no fill | State message empty/error/unavailable (P) | NEW (one example) | EXACT | S5 |
| Selected | tab indicator; teal option border plus tint; filled radio; teal segment | Chip, card selected | NEW (observed) | ESTIMATED | S5, S14 |
| Toast, skeleton, inline field error, invite/timer | not visible | P | MISSING | n/a | none |

---

## C. Alignment fixes, most important first

1. **Switch the primary button fill to `#2c4035`** and leave the label white. Every real CTA uses it.
2. **Put cards on a grey canvas.** The real app uses a grey canvas (`#f8f8f8`; `#f2f1ef` on Fill-in and Insurance; `#f9f8f6` on Home) with white cards. Your document has the reverse.
3. **Make text and divider greys neutral.** Primary about `#262626`, secondary about `#6b6b6b`, dividers about `#e8e8e8`. Your blue-green greys read tinted next to the real app.
4. **Split the brand teal into two**: mid-teal `#336c6a` (IATA codes, links, active tab, selection) and deep teal `#035256` (fare tier names, table heads). `#006564` is not what the real app draws as a flat colour.
5. **Gutter.** 24 on Book, Results, Fare, Fill-in; 16 on Home and Express checkout. One global gutter will misalign both.
6. **Sheet corner radius 16, not 20.** Handle about 37 to 47 x 4, neutral grey, centred, about 4 dp from the top.
7. **Button heights.** 52 (Book, Upgrade) and 56 (Continue on Fill-in, Express). Labels are about 18 sp, not 16.
8. **Scrim.** Neutral black about 40% (Express) and about 32% (Upgrade). Check which each sheet should use.
9. **Header.** Centred regular title about 20 sp in `#282828`, back chevron left (10 x 16.5), 1 dp neutral divider below. 91 dp from the screen top to the divider (system status bar included).
10. **Tab row.** 48 dp tall, indicator about 3 dp thick, same width as the label, deep teal on fare screens and mid-teal on Book and Results.
11. **Bottom nav.** Five equal 82 dp items, icon-to-label gap about 6.7 dp, label about 10 sp in grey, hairline above. "Travel Groups" has no equivalent in the real app.
12. **Fare rows.** Labels start at the same x regardless of icon width (icon box about 24 dp, gap about 11 to 13 dp).
13. **Card shadow.** Real shadows are visibly wider (about 13 dp of falloff, peak about 3%) than "XXS Shadow". Cards in S5 are also borderless.
14. **Selection.** Selected option uses a 1 dp teal border over a `#e9f3f2` fill, not a 3 px border.
15. **Chips.** The peach chip `#feede6` with brown text is a different hue from your sand and caution pairs. Chip radius is about 4 (not in your scale) for peach, about 3 for the teal-tint fare chip.
16. **Multi-line leading.** Splash headline is 26 sp on 33.4 dp lines; Insurance copy is about 16 sp on 24.5 to 25.6 dp lines. Both are looser than your 1.2 and 1.45 ratios.
17. **Card padding is not uniform in the real app**: 24 in the Book card, 16 in the Fill-in and Insurance cards, 11 to 12 around the fare-card panel. Your document treats card padding as one value.

---

## D. Open items from section 8

| # | Your question | What the screenshots say | Confidence |
|---|---|---|---|
| A | Darker danger text | No error state in any screenshot. Cannot test. | n/a |
| B | Border contrast ≥ 3:1 | The real app does **not** pass either. Dividers `#e7e7e7` are 1.24:1 on white and 1.10:1 on `#f2f1ef`. Unselected option border is the same. Selected border (about `#3f6a64` on `#e9f3f2`) is 5.4:1. Radio ring about `#b9b9b9` is about 1.96:1 but is a thin anti-aliased read. | EXACT / ESTIMATED |
| C | Secondary text on brand-subtle | Real secondary about `#6b6b6b` on `#e9f3f2` is 4.71:1 (pass). On `#f2f1ef` `#6f6f6f` is 4.45:1 and `#757575` 4.08:1. The lighter reads fail; the exact grey decides. | ESTIMATED |
| D | Near-duplicate colours: which does the real app use? | `text-strong` `#000000` **and** a `#262626`-type primary are both used (S9, S11), so keep two, but fix the primary value. `surface-field` vs `surface-subtle`: neither appears as a distinct value; observed greys are `#f8f8f8`, `#f9f9f9`, `#f9f8f6`, `#f2f1ef`, `#f6f6f6`. caution vs warning: neither is seen; the real pair is peach. `border-strong` vs `-alt`: neither is seen. `neutral-line` vs `-track`: not sampled. | EXACT (values), cannot decide merges |
| D | Radii in use | Seen: 3, about 4, 6, 8, 12, 16, full. Uncertain: 10 to 11 (fare card). Not seen: 2, 5, 14, 20. | ESTIMATED ±1.5 |
| D | Sizes in use | Seen: about 10, 12, 13, 14, 16, 18, 19 to 20, 21 to 22, 26, 34. Cannot separate 17 from 18, 19 from 20, or 11 from 12 by eye. Not seen: 23, 25, 36, 44. | ESTIMATED ±1.5 |
| G | Hover, pressed, disabled opacities | Not visible. | n/a |

**Contrast of the real app's text and borders** (measured colours; thin text reads lighter than true, so real ratios are same or higher)

| Pair | Ratio | Result |
|---|---|---|
| Primary about `#262626` on white | 15.1 | pass |
| Secondary about `#6b6b6b` on white | 5.3 | pass |
| Secondary `#757575` (lightest read) on white | 4.6 | pass |
| Mid-teal `#336c6a` on white | 6.0 | pass |
| Deep teal `#035256` on white | 9.0 | pass |
| White on `#2c4035` (button) | 11.1 | pass |
| Orange-brown `#8a6040` on white | 5.5 | pass |
| Peach chip text `#905730` on `#fcede6` | 5.1 | pass |
| Peach chip text `#915e3c` on `#ffece5` | 4.75 | pass |
| Inactive nav label `#6f6f6f` on white | 5.0 | pass |
| Dividers `#e7e7e7` on white | 1.24 | below 3:1 |
| Splash inactive label `#e4e5e6` on white | 1.26 | fails (decorative progress label) |
| Your document's `#ecaa4d` on white | 2.01 | fails (not what the real app uses) |

---

## E. Questions where a screenshot was unclear

1. **Typeface.** I cannot tell it from the screenshots. Is the Figma file's Inter the real app's face, or a stand-in?
2. **Phone scale.** The 411 dp assumption fits every round number. Do you know the phone's display scaling? If it is not the default, all dp values shift.
3. **Two scrims.** S13 reads about 40% and S9 about 32%. Is the Upgrade sheet fading in at the moment of capture? A fresh S9 capture would settle it.
4. **Thin line colours.** The teal tab indicator and selected-option border read differently across shots (`#347674` to `#3b6d6a`), because JPEG chroma subsampling affects thin lines. I used solid fills for the teal value instead.
5. **Two sheet handle widths** (about 37 and about 47 dp). A real difference or capture difference?
6. **Fare-card radius** (10.6 dp) could be 10 or 12. A native-resolution crop of one fare card corner would decide.
7. **Hero IATA code (about 34 sp)** sits between your 32 and 36. A native crop of S1 would settle it.
8. **Bottom nav height.** The system nav buttons overlay the same white, so the bar's lower edge is not visible.
9. **Dividers in S10 around the trip card and the Fill-in cards.** I did not find a visible border; shadow only. Confirm there is none.
10. **Flex card, the third fare strip.** It is only partly in S7, so its gradient was not sampled.
11. **Photo overlays** on S3, S5, S10 (dark gradient behind white text) are visible but not measured.
12. **Segmented-control container radius and the progress track colour** are visible but were not measured.

Nothing in this file renames or merges a token.
