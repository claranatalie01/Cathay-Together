# Cathay Together design system (v2.0, real-app first)

Every screen follows this system. The live style guide is at **`/design-system`**
(run `npm run dev`, open <http://localhost:5173/design-system>). It reads `src/styles/tokens.css`.

> **Status of this document.** v2.0 is **applied to every screen** (approved). `src/styles/tokens.css`,
> the component CSS and the style guide now hold the v2.0 values, and the old per-screen trial switch is gone.
> The previous version is kept as `docs/design-system.v1.0.backup.md`. Section 10 shows what was applied and
> what is still open.

## 0. Source priority (this is the rule)

1. **Real Cathay Pacific app screenshots win.** 14 screenshots of the real Android app (`docs/screenshot-audit.md` has the measurements and screenshot key S1 to S14).
2. **Where the screenshots are silent, the Figma / v1.0 value is kept**, unchanged.
3. **Where neither exists, the item is a PROPOSAL** and needs approval.

If the screenshots and the old document disagree, this document uses the screenshot value. Nothing is renamed or merged unless this document says so.

**Status labels** (used in every table and in token comments)

| Label | Meaning |
|---|---|
| **Real** | Read from the real app. Flat fills and clear edges (±2 per colour channel, ±1 px). |
| **Real (est.)** | From the real app but judged from thin text, thin strokes or a curve. The ± is stated or implied (colour ±8, radius ±1.5 dp, font size ±1.5 sp). |
| **Figma (kept)** | Not visible in the screenshots, so the v1.0 value is kept. Not verified against the real app. |
| **PROPOSAL** | Not in the real app or Figma. Needs approval. |
| **Flagged** | A value with a contrast or near-duplicate issue. Kept as observed. |

**Units.** The real app is about 411 dp wide (screenshots 1.796 px per dp). The demo frame is 440 px. Gutter (24) and button height (52) match 1:1, so real dp values are used as CSS px. The dp conversion is inferred, so every size is "Real (est.)" at about ±0.6 dp.

## 1. What the real app shows (summary)

- Grey canvas with **white cards** (the inverse of v1.0).
- Primary button is **dark green `#2c4035`**, white label, 52 or 56 dp tall, radius 8.
- Text is **neutral grey** (primary about `#262626`, secondary about `#6b6b6b`). Dividers are neutral `#e8e8e8`.
- The teal splits into a **mid-teal** (`#336c6a`: codes, links, active tab, selection) and a **deep teal** (`#035256`: fare tier names, table heads).
- Bottom sheets have a **16** top radius and a neutral black scrim.
- Gutter is **24** on Book, Results, Fare and Fill-in, and **16** on Home and Express checkout.
- Bottom nav is Home, Book, My trips, Profile, Travel tools. There is no "Travel Groups".

Figma defined only three shared styles (v1.0 section 1): colour style "Dark" `#141B34` (13 icon files), effect style "XXS Shadow", and colour variable "#D9D9D9" resolving to `#CFCFCF`. Figma has no hover, focus, pressed, disabled, error or loading states. These remain the Figma source where the screenshots are silent.

## 2. Where things live

| What | Where |
|---|---|
| All tokens (the only place raw values may be written) | `src/styles/tokens.css` |
| Component styles (tokens only) | `src/components/**/*.css`, `src/features/**/*.css` |
| Style guide page | `src/design-system/` (route `/design-system`) |
| Token checker | `scripts/check-tokens.mjs` (`npm run check:tokens`, also runs before `npm run build`) |
| Measurements behind this document | `docs/screenshot-audit.md` |
| Demo panel | `src/demo/`. **Not part of the design system** |

## 3. Tokens

### 3.1 Naming

`--<category>-<role>[-<variant>]`. Names say what a value is for. Existing token names are unchanged; new names are marked **new**.

- Colour: `--color-text-*`, `--color-surface-*`, `--color-border-*`, `--color-icon-*`, `--color-divider`, `--color-overlay-scrim*`, `--color-focus-ring`, `--color-neutral-*`, `--color-canvas`.
- Type: `--text-<style>-size` with `--text-<style>-leading` (always a pair), `--weight-*`, `--font-family`.
- Space: `--space-xs … --space-3xl` (4, 8, 12, 16, 24, 32, 40) and `--space-optical-N` for off-grid values.
- Radius (by use): see 3.5.
- Border width: `--border-width-default` 1, `-strong` 2, `-selected` 1 (**changed from 3**).
- Effects: `--shadow-card`, `--opacity-*`, `--focus-ring-*`.
- Layout: `--screen-width` 440, `--screen-height` 956.

### 3.2 Colour

**Brand and action**

| Token | Value | Use | Status |
|---|---|---|---|
| `--color-surface-brand` | `#2c4035` | Primary button fill | **Real** (was `#006564`) |
| `--color-text-inverse` | `#ffffff` | Label on primary button | Real (est.) (reads `#f8fffd`) |
| `--color-text-brand` | `#336c6a` | IATA codes, links, active tab and nav, route times | **Real** for fills, Real (est.) for text (was `#006564`) |
| `--color-border-brand` | `#336c6a` | Selected option border, outlined-button border and label | Real (est.) (thin line; was `#006564`) |
| `--color-text-brand-deep` **new** | `#035256` | Fare tier names, comparison column heads, Economy tab on fare screens | Real (est.) ±5 |
| `--color-border-brand-deep` **new** | `#025b61` | Tab indicator on fare screens | Real (est.) |
| `--color-icon-brand` | `#336c6a` | Teal icons (active nav, swap, filter, plane) | Real (est.). Icon files are retained; this is the colour they render in |
| `--color-gradient-segment` **new** | `#337776` to `#056065`, left to right | Selected segment fill (Economy) | Real (est.) |
| `--color-gradient-fare-light` **new** | `#c7d9d9` to `#94bdbf` | Fare-card top strip, Light | Real (est.) |
| `--color-gradient-fare-essential` **new** | `#93babd` to `#347a83` | Fare-card top strip, Essential | Real (est.) |
| Fare-card strip, Flex | darker teal, **not sampled** | | Not measured |

**Text**

| Token | Value | Use | Status |
|---|---|---|---|
| `--color-text-primary` | `#262626` | Body, titles, flight times | **Real (est.)** ±8 (was `#172e33`). Thin strokes read lighter, so true value is the same or darker |
| `--color-text-secondary` | `#6b6b6b` | Labels, meta, "Per Adult From", "Not available" | **Real (est.)** ±8 (was `#647578`). Reads `#646464` to `#757575` |
| `--color-text-strong` | `#000000` | Row labels and group heads in sheets and the comparison table | Real. v1.0 use ("flight card, nav labels") was wrong: flight-card text is primary, nav labels are secondary |
| `--color-text-accent` | `#8a6040` | "Lowest Fare", "N Seats Left" | **Real (est.)** ±10 (was `#ecaa4d`) |
| `--color-text-chip` **new** | `#905730` | Text on the peach chip | Real (est.) ±12 |
| `--color-text-class-premium` **new** | `#3a677b` | "Premium Economy" label | Real (est.) ±6 |
| `--color-text-class-business` **new** | `#182c51` | "Business" label | Real (est.) ±6 |
| `--color-text-warning` | `#886a38` | "Booked" chip | Figma (kept), not visible |
| `--color-text-caution` | `#854d0e` | Arrival-window badge | Figma (kept), not visible |
| `--color-text-danger` | `#ff474c` | Late time, field errors | Figma (kept), not visible. Flagged: 3.36:1 on white |
| `--color-text-pass` | `#796c69` | "PASSED" stamp | Figma (kept), not visible |

**Surfaces**

| Token | Value | Use | Status |
|---|---|---|---|
| `--color-canvas` | `#f8f8f8` | Screen background (Book, Results, Fare) | **Real** (v1.0 `#444444` was the page behind the phone frame; that is renamed, see below) |
| `--color-canvas-home` **new** | `#f9f8f6` | Home screen background | Real |
| `--color-canvas-warm` **new** | `#f2f1ef` | Fill-in-information and Insurance background | Real |
| `--color-canvas-frame` **new** | `#444444` | Page behind the phone frame (desktop only) | Figma (kept). Not product UI. Was named `--color-canvas` |
| `--color-surface-default` | `#ffffff` | **Cards**, sheets, bars, secondary button | **Real** (was "screen") |
| `--color-surface-panel` **new** | `#f9f9f9` | Inner panel inside fare cards, comparison footer | Real (est.) |
| `--color-surface-brand-subtle` | `#e9f3f2` | Selected option, Flex column, tinted callouts | Real (was `#e6f2ef`; within ±3, so effectively the same) |
| `--color-surface-banner` **new** | `#e5eeeb` | "Flying soon?" banner (darker `#d8e6e6` toward lower left; may be a gradient) | Real (est.) |
| `--color-surface-chip-brand` **new** | `#e4eeef` | "Economy Light" chip | Real (est.) |
| `--color-surface-table-head-a` / `-b` **new** | `#f9fdfe` / `#f6fafb` | Comparison column heads (Light / Essential) | Real |
| `--color-surface-chip` **new** | `#feede6` | Peach chip (promo, "Recommended") | **Real** |
| `--color-surface-subtle` | `#f4f8f7` | Not seen in the real app | Figma (kept), not visible |
| `--color-surface-field` | `#fbfbfb` | Search form, date chips | Figma (kept). Value is within ±2 of `surface-panel`; **your merge decision** |
| `--color-surface-warning` / `-caution` | `#fbf5ea` / `#fff3d6` | "Booked" chip, arrival badge | Figma (kept), not visible. The real chip is the peach pair above |
| `--color-surface-fare` | `#a8dcab` (25%) | Fare panel | Figma (kept), not visible |

**Borders, lines, overlays**

| Token | Value | Use | Status |
|---|---|---|---|
| `--color-border-default` | `#e8e8e8` | Card and option borders, table lines | **Real** (was `#dce6e4`). Reads `#e7e7e7` to `#eaeaea`. Flagged: 1.24:1 on white |
| `--color-divider` | `#e8e8e8` | Rules, header and tab-row dividers | **Real** (was `#dce6e4`) |
| `--color-border-handle` **new** | `#e3e3e3` | Sheet handle | Real (est.) |
| `--color-border-radio` **new** | `#b9b9b9` | Unselected radio ring | Real (est.) ±20. Thin line; true value probably darker |
| `--color-overlay-scrim` | `rgba(0,0,0,.40)` | Express checkout sheet backdrop | **Real**. Resulting colours exact, alpha ±2% (was tinted `rgba(23,46,51,.44)`) |
| `--color-overlay-scrim-light` **new** | `rgba(0,0,0,.32)` | Upgrade sheet backdrop | Real (est.). One capture, may be mid-fade |
| `--color-overlay-veil` **new** | `rgba(255,255,255,.80)` | In-flow loading veil over the whole screen | Real (est.) |
| `--color-loader-mark` **new** | `#5f9691` | Loading circle (about 81 dp) behind a white seat glyph | Real (est.) |
| `--color-text-progress-end` **new** | `#e4e5e6` | Inactive end label on loading progress | Real (est.). Flagged: 1.26:1, decorative |
| `--color-border-inverse` | `#ffffff` | Avatar ring | Figma (kept), not visible |
| `--color-border-strong` / `-alt` | `rgba(0,0,0,.43)` / `.54` | Flight card, search controls | Figma (kept), **not visible**. Real flight cards have no border |
| `--color-border-danger` | `#ff474c` | Invalid field | PROPOSAL |
| `--color-border-pass` | `#796c69` | Stamp | Figma (kept), not visible |
| `--color-neutral-line` / `-track` | `#d9d9d9` / `#d3d3d3` | Dividers, progress tracks | Figma (kept). The real grey track is visible but **not sampled** |
| `--color-focus-ring` | `#336c6a` | Focus ring | PROPOSAL (was `#006564`; follows the new brand teal) |

**Icons.** Icon and vector files are retained exactly. `--color-icon-default` stays `#141b34` (Figma style "Dark"). The real app's content icons read about `#191919` to `#2a2a2a` and inactive nav icons about `#595959` to `#646464`. This is a note only; no icon is changed here.

### 3.3 Typography

**Family.** v1.0 says Inter. The real app's typeface **cannot be identified from the screenshots**, so Inter is kept (Figma kept) and is not confirmed. The Lexend numeric font from v1.0 was removed: no screen uses it.

Sizes below are Real (est.) at ±1.5 sp, from cap-height ÷ 0.71 (assumed ratio). Where they match a v1.0 style, the v1.0 size and leading pair is kept.

| Style | Size / leading | Used for | Status |
|---|---|---|---|
| micro | 10 / 12 | Bottom-nav labels (secondary colour, not black) | Real (est.) |
| caption-sm | 11 / 13 | Dense meta | Figma (kept), not evidenced |
| caption | 12 / 15 | Field labels ("Departing"), "Good value", "N Seats Left" | Real (est.) |
| body-sm | 13 / 16 | Date tabs, flight number | Real (est.) |
| body | 14 / 17 | City names, fare row labels | Real (est.) |
| body-lg | 15 / 18 | Intro and placeholder copy | Figma (kept), not evidenced |
| body-xl | 16 / 19 | Field values, "Select" label, result price | Real (est.) |
| title-xs | 17 / 21 | | Figma (kept), not evidenced (cannot separate 17 from 18) |
| title-sm | 18 / 22 | Result times and airport codes, Home card title, insurance heading | Real (est.) |
| title-md / title | 19 / 23, 20 / 24 | Fare tier name (bold, deep teal), fare price (bold) | Real (est.) |
| **button** **new** | **18 / 22** | Button labels ("Search flight", "Straight to payment") | Real (est.). v1.0 used body-xl 16 |
| **bar-title** **new** | **20 / 24** | App-bar title and sheet title. **Regular weight, `text-primary`, centred** | Real (est.). Replaces v1.0 use of `page-title` for these |
| heading-sm / md | 21 / 25, 22 / 27 | Section titles ("Passenger", "Our latest offers"), regular weight | Real (est.) |
| heading | 23 / 28 | | Figma (kept), not evidenced |
| page-title | 25 / 30 | **Not used by the real app** for app-bar or sheet titles. Kept for any in-page title Figma defines | Figma (kept) |
| display-sm | 26 / 31 | Home IATA ("HKG", "Search"), bold, mid-teal. Splash headline: 26 on **33.4 lines** (see leading) | Real (est.) |
| **hero-code** **new** | **34 / 41** (leading estimated) | Book-screen IATA code, bold, mid-teal | Real (est.). 34 sits between `display` 32 and `code` 36; needs a native crop |
| display | 32 / 39 | | Figma (kept) |
| code / timer | 36 / 44, 44 / 53 | Invite code, countdown | Figma (kept), not visible |
| glyph | 34 | Mark inside state messages | PROPOSAL |

**Weights.** Regular 400 for most text. Bold for IATA codes, prices, tier names and the selected segment. The real app's 500 versus 600 cannot be told apart, so `--weight-medium` and `--weight-semibold` are kept (Figma) and unverified.

**Leading.** v1.0 ratios `--leading-body` 1.45, `--leading-tight` 1.4, `--leading-heading` 1.2 are kept (Figma) except where measured:

| Text | Measured line spacing | Status |
|---|---|---|
| Splash headline (26 sp, 2 lines) | **33.4** (about 1.28) | Real. Replaces 31 for multi-line |
| Insurance bullets and option copy (about 16 sp) | **24.5 to 25.6** (about 1.55) | Real (est.). Looser than 1.45 |
| Sheet body ("Upgrade for just…") | 26.2. Size not measured | Real (line spacing only) |
| Express checkout body | 20.1. Size not measured | Real (line spacing only) |

### 3.4 Old name to new name (v1.0 prototype names, still valid)

| Old | New |
|---|---|
| `--color-primary` | `text-brand` (colour), `surface-brand` (background), `border-brand` (border). **Values now differ per role** |
| `--color-ink` / `--color-muted` / `--color-black` | `text-primary` / `text-secondary` / `text-strong` |
| `--color-white` | `text-inverse` (colour), `surface-default` (background), `border-inverse` (border) |
| `--color-surface` | `surface-subtle` (Figma kept); the real app's grey is `canvas` |
| `--color-tint` | `surface-brand-subtle` (background), `text-brand` (colour) |
| `--color-border` | `border-default` (border), `divider` (background lines) |
| `--color-sand` / `--color-sand-ink` | `surface-warning` / `text-warning` |
| `--color-alert` | `text-danger` (colour), `border-danger` (border) |
| `--color-scrim` | `overlay-scrim` |
| `--color-outline` / `--color-card-line` | `border-strong-alt` / `border-strong` |
| `--font-semibold` etc. | `--weight-semibold` etc. |
| `--fs-N` | `--text-<style>-size` |
| `--lh-body` / `--lh-tight` | `--leading-body` / `--leading-tight` |
| `--space-N` | `--space-xs…3xl` or `--space-optical-N` |
| `--radius-8` / `-14` / `-10` | `--radius-control` / `-panel` / `-button-lg` |

**Merges.** Only one merge has been made: `#D9D9D9` and the Figma variable `#CFCFCF` are one value (`--color-neutral-line`). v2.0 makes none. `border-default` and `divider` now share `#e8e8e8` but remain two tokens.

### 3.5 Spacing and radius

**Spacing** scale is unchanged: 4, 8, 12, 16, 24, 32, 40, plus `--space-optical-N` (2, 3, 5, 6, 7, 9, 10, 13, 14, 18, 20, 22, 28, 30).

| Token / rule | Value | Where | Status |
|---|---|---|---|
| Gutter, standard | 24 (`--space-xl`) | Book, Results, Fare, Fill-in, Insurance, Upgrade sheet | Real |
| Gutter, tight **new** `--gutter-tight` | 16 (`--space-lg`) | **Home** and **Express checkout** sheet | Real. v1.0 said 24 everywhere |
| Card inner padding: Book card | 24 | | Real |
| Card inner padding: Fill-in and Insurance cards | 16 | | Real |
| Fare-card panel inset | 11 to 12 (use 12; 11 is not on the scale) | | Real (est.) |
| Gap between result cards | 16 | | Real |
| Gap between fare cards | about 24 | | Real (est.) |
| Result card height | 129 | | Real |
| Result card split | left 242, right 120, 1 dp divider | | Real |
| Fare-card top strip height | 6 | | Real |
| Tab row height | 48 | | Real |
| Tab indicator | about 3 thick, same width as the label | | Real (est.) |
| Top of screen to first divider | 91 (includes the system status bar) | | Real. Status bar and app bar cannot be split |
| Bottom nav | 5 equal items, about 82 wide; icon-to-label gap about 6.7; hairline above | | Real. Bar height not visible |
| Fare-row label column | labels start at one x regardless of icon width; icon box about 24, gap 11 to 13 | | Real |

**Button heights** `--size-button-*`

| Size | Value | Where | Status |
|---|---|---|---|
| Standard | **52** | Book "Search flight", Upgrade sheet buttons | Real |
| Large | **56** | "Continue" on Fill-in, both Express checkout buttons | Real. Figma had 54 (not built) |
| Small | **38** | "Select" in a fare card | Real. Figma had 39 (not built) |
| 48 | | | Figma (kept), not visible |

**Radius** (Real (est.) ±1.5 dp)

| Token | Value | Used for | Status |
|---|---|---|---|
| `--radius-hairline` | 2 | | Figma (kept), not seen |
| `--radius-bar` | 3 | "Economy Light" chip | Real (est.) |
| `--radius-chip` **new** | 4 | Peach chip | Real (est.). No existing token fits (between `bar` 3 and `badge` 5) |
| `--radius-badge` | 5 | | Figma (kept), not seen |
| `--radius-thumb` | 6 | Selected insurance option, Home banner | Real (est.) |
| `--radius-control` | 8 | **All buttons**, result cards, Fill-in cards, inner panels | Real |
| `--radius-button-lg` | 10 | | Figma (kept). Fare card (10.6) fits either this or `card`; needs a native crop |
| `--radius-card` | 12 | Book search card | Real |
| `--radius-panel` | 14 | | Figma (kept), not seen |
| `--radius-card-lg` | 16 | **Bottom-sheet top corners** | Real (est.). Replaces `sheet` |
| `--radius-sheet` | 20 | | Figma (kept), **not used by the real app**. Sheets use 16 |
| `--radius-pill` | 100 | Swap button, radios, check circles, loading mark | Real |

**Borders**

| Token | Value | Status |
|---|---|---|
| `--border-width-default` | 1 | Real |
| `--border-width-strong` | 2 | Figma (kept), not seen |
| `--border-width-selected` | **1** (was 3) | Real (est.). Selected option is a 1 dp teal border on `surface-brand-subtle` |

**Shadow.** `--shadow-card` is **Real (est.)**: soft, visible about 13 dp on every side, peak darkening about 3% of the canvas, borderless cards. Offset and blur cannot be recovered from a screenshot, so the exact CSS is **not set here**. Until it is tuned against the real card, v1.0's "XXS Shadow" stays in `tokens.css` and is flagged.

**Effects (unchanged).** `--opacity-hover` 0.9, `-pressed` 0.8, `-disabled` 0.6, `--focus-ring-width` 2, `--focus-ring-offset` 2: PROPOSAL, because the real app's states are not visible.

**Layout.** `--screen-width` 440, `--screen-height` 956: Figma (kept).

## 4. Components

**R** = in the real app, **F** = Figma only, **P** = proposal.

| Component | Real-app definition | Status |
|---|---|---|
| Button, primary | 52 or 56 tall, radius 8, `#2c4035`, white label 18 sp | R. v1.0 was `#006564` 52, 16 px |
| Button, secondary | 52 or 56 tall, white, 1 dp teal border, teal label | R (structure) |
| Button, small | 38 tall, same green, label 16 sp | R |
| Tabs | Text, 3 dp indicator under the active one. Active is mid-teal (Book, Results) or deep teal (fare screens). Inactive is dark or grey. 48 tall | R. v1.0: "defined in Figma, not built" |
| Segmented control | Economy / Premium Economy / Business with price delta. Selected has the teal gradient and a white label | R, new |
| Flight (ticket) card | White, radius 8, no border, soft shadow. Left 242, right 120, 1 dp divider | R |
| Fare card | 6 dp gradient strip, tier name (deep teal), price, grey inner panel with 4 rows, "Fare comparison" link, small Select | R |
| Chip | **Peach** `#feede6` with `#905730` text, radius 4 (promo, Recommended). **Teal-tint** `#e4eeef`, radius 3 (fare label). The v1.0 variants `neutral`, `primary`, `sand`, `tint` have no real-app match except tint | R, replaces `sand` for the peach case |
| Field (Book form) | **No box.** Label (caption, secondary), value (16), 1 dp divider below, chevron at right | R. v1.0 field was bordered |
| Option row (radio) | 1 dp border, radius 6. Selected: teal border and `#e9f3f2` fill, filled radio | R |
| Bottom sheet | White, radius 16, centred 4 dp handle, left close X, centred title (20, regular). **Built this way in Flow B** (it was still the v1.0 look before). Fixed to the window so it opens in view on a long page, max 92% of the height, scrolls inside | R. v1.0: 20 radius |
| Scrim | Neutral black. 40% (Express), 32% (Upgrade) | R |
| Sticky footer | White bar, hairline above, "Total HKD…" left, 56 dp Continue right | R |
| Comparison table | 3 columns, tinted heads, tint on Flex column, fixed price footer with Select | R |
| Bottom nav | 5 equal items: Home, Book, My trips, Profile, Travel tools. Active teal with heavier icon. Inactive grey. Hairline above | R. v1.0's "Travel Groups" tab is **not in the real app** |
| Page header | Back chevron left, centred regular title (20), 1 dp divider below | R. v1.0: `page-title`, semibold, brand |
| Photo header | Tokyo photo, dark overlay, white title and dates, rounded bottom-left curve | R. Overlay colour not measured |
| Loading splash | Photo or window illustration, headline, HKG to HND progress with plane glyph | R |
| Loading, in flow | 80% white veil over the screen plus a teal circle with a white seat glyph. No per-button spinner is visible | R |
| Unavailable | "Not available" date tab is plain `text-secondary`, no fill | R (one example) |
| Group card, Trip context, Member row, Section heading, Bonus teaser | Not in the real app screenshots | F (kept, unverified) |
| **Tabs** (built, Flow B) | `ui/Tabs`. Text tabs, 48 tall row, 3 dp indicator the width of the label, roving tabindex and arrow keys. Tones `brand` (mid-teal) and `deep` (fare screens). A tab can be `disabled` ("Not available", plain grey). Used for trip type, date row, cabin | R (S1, S5, S6). Hover / pressed: PROPOSAL |
| **Segmented control** (built, Flow B) | `ui/SegmentedControl`. Real radio inputs; selected segment has `--color-gradient-segment` with a white 16 label; unselected labels are teal / `text-class-premium` / `text-class-business` with a price delta below | R (S5) |
| **Flight card** (built, Flow B) | `domain/FlightCard`. One link. 129 tall, radius 8, no border, card shadow; left 242 (times, route line, flight number, "operated by"), right 120 (seats left or Lowest Fare, price, "Per Adult From", dots) | R (S5). The "…" is decorative (no menu is built) |
| **Fare card** (built, Flow B) | `domain/FareCard`. 6 dp gradient strip, tier name (deep teal, bold), price, grey panel with four rows, "Fare comparison" link, small Select | R (S6). Flex strip colour: PROPOSAL |
| **Comparison table** (built, Flow B) | `domain/ComparisonTable`. Real `<table>`: tinted column heads, 1 dp lines, tick / cross badges, Flex column tinted. 2 columns in the Upgrade sheet, 3 in Compare | R (S9, S11 structure) |
| **Photo header** (built, Flow B) | `domain/PhotoHeader`. Destination photo, dark overlay, white text, rounded bottom-left curve, back and edit buttons. Used on Book a trip (taller, 32 title) and results | R (S1, S5). Overlay colour: PROPOSAL (same as scrim) |
| **Price** (built, Flow B) | `ui/Price`. Currency regular, amount bold ("HKD**6,691**") | R (S5, S6) |
| **Slider** (built, Flow B) | `ui/Slider`. "Group timing window": label left, value right ("Within 1 hour"), real range input (1 to 6 hours, 1h steps), helper line below. Brand-teal fill, grey track, round dark-green thumb | Prototype ("Arrival Window"). Track and thumb sizes: PROPOSAL (`size-slider-track` 4, `size-slider-thumb` 22). Hover / pressed / focus: PROPOSAL |
| **Group timing badge** (built, Flow B) | On `domain/FlightCard`. Green with a tick: "Within 1h of everyone". Amber: "Outside your window +2h". No names. Results are grouped under headings, nearest first | Prototype ("within 1h of everyone", "Outside your arrival window"). Wording is yours; the prototype's red "+15m" is dropped (3.4:1 contrast) |
| **Member avatar colours** (built) | One colour per person on every screen (Members, board, Saved, Building, place votes): Kabe teal (`--color-surface-brand-subtle`), Gaudi steel blue (`--color-surface-timeline-depart`), Clara sand (`--color-surface-warning`); anyone else gets a colour from their id. Set by `avatarTone(userId)` in `IconHeading.jsx`, applied with the `avatar-tone--*` classes | PROPOSAL (approved) |
| **Member card** (built, Flow C) | `domain/MemberRow` with `flights`: white card, avatar, name "(you)", route to HND, status chip (Picked dark green, Booked sand, Invited tint), then two columns "Arrives / Leaves" with plane icons, big time, airport and flight number. Arrivals mid-teal, departures steel blue (`text-class-premium`, existing token in a new role); times stay dark | Prototype board, restyled. Direction colours: PROPOSAL |
| **Timeline** (built, Flow C) | `domain/Timeline`. Two columns (Arrivals, Departures), vertical hourly axis, one marker per time (members sharing a time share a marker), filled dot = your flight, band between first and last marker, "Span" pill. The axis grows so markers never overlap | PROPOSAL (new component). `surface-timeline-depart` tint is new |
| **Countdown** (built, Flow C) | `ui/Countdown`. One teal ring and `mm:ss`; caution tone under 5 minutes; announced as a timer, not every tick | PROPOSAL |
| **Dialog** (built, Flow C) | `ui/Dialog`. Centred alert dialog, radius 16, same scrim as sheets, focus trapped, no tap-outside close. No longer used by a screen after the fare-increase flow was removed; kept in the style guide | PROPOSAL |
| **Suggestion card** (built, Flow D) | `domain/SuggestionCard`. White card, radius 12, 210 photo with category tag chip, name, location with pin, description, budget and duration facts, tip. Drag left to pass or right to like (80 px); the buttons do the same. Tilted stamp: "Liked" (brand) or "Passed" (`text-pass`, `border-pass`) | Prototype; hover / pressed: PROPOSAL |
| **Step progress** (built, Flow D) | `ui/StepProgress`. Uppercase brand label, "1 of 4", one 3 dp segment per step | Prototype |
| **Choice pill** (built, Flow D) | `ui/ChoicePill`. 52 tall, round, 1 dp border; selected = brand tint and brand border; `aria-pressed` | Prototype; states: PROPOSAL |
| Member status "Ready" / "Choosing" (built, Flow D) | `MEMBER_STATUS` gains `ready` (tint chip) and `choosing` (neutral chip). Group details is the Members page with these statuses | Prototype / PROPOSAL (Choosing) |
| **Group details, visual refresh** (built) | Group details only (Members page unchanged). Trip card with calendar and people icons; "Your travel group" card with a 28 icon tile, heading, and an "N of M ready" chip that wraps under a long heading; tinted link rows (teal icon on a white tile, label, chevron, 48 tall); teal avatars and a "✓ Ready" chip; invite card with a link tile, a 44 high "Share" and a 44 x 44 copy button; friends note with a **peach** tile (the real app's warm accent); flat `surface-brand-subtle` call-to-action card with four place photos under a solid label strip (`color-overlay-photo-label`, white 12 text); "View itinerary" above "Pick itinerary preferences" once an itinerary exists. The first version used steel-blue and sand accents and a gradient; they were removed to stay on the Cathay palette (teal, dark green, neutral grey, peach). Long names and airport text are cut with an ellipsis. New icon files (none edited): `ui-plane-teal`, `ui-link-teal`, `ui-plane-peach`, `ui-chevron-teal`, `ui-heart-teal`, `ui-heart-light`. New token: `color-overlay-photo-label` | PROPOSAL (from your visual refresh file) |
| **Next step card** (built, next-steps round) | `domain/NextStep`. Flat `surface-brand-subtle` card, 16 padding, 12 radius: uppercase brand eyebrow "Next step · N of 4", a four-step tracker (Flight, Pay, Preferences, Itinerary: 3 dp bars, done bars `border-brand`, current label brand semibold, other labels `text-primary` because `text-secondary` is 4.2:1 on this fill, labels never truncate), then the one action. Shown on Group details and the Members page, directly under "Your travel group". Step is calculated from the viewer's own status: not picked = 1 (Pick flight), picked = 2 (their flights and "Review & pay" to `/board?sheet=book`), booked = 3 on Group details (preferences callout with its button below) or 4 once an itinerary exists (View itinerary, then Pick itinerary preferences). Before booking, the preferences callout, button and the Members page "Itinerary preferences" row are hidden. Invite link and friends note sit below the next step | PROPOSAL (approved from flow_next_steps_preview.html) |
| **Itinerary actions** (built) | Bottom bar: Edit (secondary, left) and Done (primary, right; goes to Group details). While editing it stays Cancel and Save changes | PROPOSAL (approved) |
| **Itinerary preferences hints** (changed) | The "Swipe left to pass · Swipe right to like" line and "Choice selected. Tap the other option to change it." are removed. Kept: "Choose Pass or Like to continue." and the final tally, because they explain a disabled button and the save | PROPOSAL (approved) |
| **Group home look** (built) | One shared page, `MembersPage`, used for the Members page (`/groups/:id/invite`) and Group details (`/groups/:id/details`): white trip card with calendar and people icons, "Your travel group" card with a tinted icon tile, tinted link rows (Pick flight, View everyone's flights, Itinerary preferences) with chevrons, member rows, invite-link card with a link tile, peach "Friends can fly…" note. Group details adds the "N of M ready" chip, Ready / Choosing statuses, the preferences callout with place photos and the call to action. All fills are flat (no gradients) | PROPOSAL (new style), flat fills per the real app |
| **Group card** (updated) | `domain/GroupCard` (Travel Groups list): calendar icon on the dates line and people icon on the members line with airport codes; the list heading has the same tinted icon tile as the group page | PROPOSAL |
| **Itinerary stop** (built, Flow E) | `domain/ItineraryStop`. White card with a 64 photo, name, duration and cost, text and a tag ("Liked by 2 of 2" brand, or "Suggested" neutral with a sparkle). A booked flight has a 3 dp edge: arrival mid-teal, departure steel blue. In edit mode: move up, move down and remove buttons (36 square) | PROPOSAL (new), colours follow the Flow C arrive / leave rule |
| **Travel connector** (built, Flow E) | `domain/TravelConnector`. Dashed line, train icon and "60 min by train · airport to city" | PROPOSAL |
| **Stat tile** (built, Flow E) | `ui/StatTile`. White card with a 36 tinted icon square (teal, steel or sand) over a value and label | PROPOSAL |
| Day tabs (built, Flow E) | The existing `Tabs` with a date sub-label | Reuse |
| Building screen (built, Flow E) | Trip card, spinning ring with a plane (reduced-motion safe), vote list with ticks | Prototype / PROPOSAL (ring) |
| Flow C alignment (built) | Aligned with the Flow C preview (file since removed): trip card with calendar and people icons (list view only), headline plus sand "booked" chip, List / Timeline toggle with icons (`SegmentedControl` `icon` / `iconSelected`), "Everyone lands within" banner (list view), `MemberRow` with a plane between airports, span pills with arrows icon, legend dot, countdown with clock icon (120 ring, `min : sec`), compact trip legs (`TripLeg compact`), booking reference with ticket icon, outline "View everyone's flights" button. New icon files (none edited): `ui-calendar`, `ui-users`, `ui-users-group`, `ui-list`, `ui-list-light`, `ui-timeline`, `ui-timeline-light`, `ui-check-circle-sand`, `ui-arrows-teal`, `ui-arrows-steel`, `ui-clock`, `ui-download` | R / PROPOSAL (new styles) |
| Button sizes (built, Flow B) | `size="sm"` 38, default 52, `size="lg"` 56 | R |
| Chip `peach` (built, Flow B) | Peach fill, radius 4, "Recommended" | R (S6) |
| Sheet + scrim (decline-invite sheet) | Structure follows the bottom sheet above | F + R |
| Select travel dates sheet (`CalendarSheet`, Create group) | Real-app date sheet: × and centred title, route header (origin, plane, destination with long dates), weekday row, two months, window ends `--color-surface-brand` with inverse text, days between `--color-surface-brand-subtle`, lowest economy fare under each open day (caption-sm), other days muted at `--opacity-disabled`, demo note, Done button. Not selectable beyond the one demo window; the real app's Reset is left out because nothing can change | R + PROPOSAL |
| State message | confirmation, building | F; real loading is the veil and mark above |
| Skeleton, Toast, inline field error | Not visible | P |

**States.** Real-app states visible: selected (tab, option, segment), loading (veil), unavailable (grey text). **Not visible, so Figma/proposal values are kept**: hover, pressed, focus, disabled, error, empty. S12's grey Continue is a screen-level veil, not a disabled style.

**Proposed state styles use tokens only**: hover `--opacity-hover` (0.9), pressed `--opacity-pressed` (0.8), disabled `--opacity-disabled` (0.6), focus `--focus-ring-*`. `is-hover`, `is-pressed`, `is-focus` classes mirror the pseudo-classes for the style guide only; product code must not set them.

**Defined in Figma, not built yet:** text action, callout variants, avatar sizes, 48 button size. Built from this system when their screens arrive. Tabs, flight, fare and suggestion cards now have real-app definitions above.

Component rules (unchanged unless noted):

- Reuse a component before writing markup. If none fits, propose one (name, variants, states, real-app screenshot or **PROPOSAL**) and wait for approval.
- One primary button per screen. Loading sets `disabled` and `aria-busy` and keeps the label.
- Every field has a visible label; errors sit under the field with `role="alert"` and are linked with `aria-describedby`.
- A card is one link. Do not nest another link or button inside it.
- Chips show status only. The label carries meaning, never colour alone.

## 5. Usage rules

**Spacing.** Use the scale (4, 8, 12, 16, 24, 32, 40). Gutter is `--space-xl` (24) on Book, Results, Fare, Fill-in, Insurance and the Upgrade sheet, and `--gutter-tight` (16) on Home and the Express checkout sheet. Do not use one gutter for every screen.

**Text hierarchy.** App-bar and sheet title (`bar-title`, 20, regular), section heading (`heading-sm` / `heading-md`, regular), card and tier title (`title-sm` to `title`), body (`body` / `body-xl`), meta (`caption`), micro labels (`micro`). Do not skip to an unrelated size to "fit"; ask for a new style.

**Colour.** Text uses `--color-text-*`, backgrounds `--color-surface-*`, outlines `--color-border-*`. **Screens use `--color-canvas`; cards and sheets use `--color-surface-default` (white).** The dark green `surface-brand` is for the primary action only. Mid-teal marks codes, links, active and selected states. Deep teal marks fare tiers and table heads.

**Layout.** The screen is 440 px wide. At 768 px and below it fills the viewport; above, it is centred on `--color-canvas-frame`. Every screen starts with a status bar and page header (centred title, back chevron left). The page title is the `h1` and takes focus after navigation. Bottom nav sits at the bottom.

**Accessibility.** Text needs 4.5:1; borders and focus rings need 3:1. Every interactive element has a visible focus ring (2px brand, 2px offset), an accessible name, and works by keyboard. Sheets trap focus and close on Escape. Motion respects `prefers-reduced-motion`.

## 6. Accessibility findings

Measured from the real app's colours. Thin text reads lighter than its true colour, so the true ratios are the same or higher.

| Pair | Ratio | Result |
|---|---|---|
| text-primary `#262626` on white | 15.1 | pass |
| text-primary on canvas-warm `#f2f1ef` | 13.4 | pass |
| text-secondary `#6b6b6b` on white | 5.3 | pass |
| text-secondary `#6b6b6b` on surface-brand-subtle `#e9f3f2` | 4.71 | pass |
| text-secondary `#6f6f6f` on canvas-warm `#f2f1ef` | 4.45 | **fails small text** |
| text-secondary `#757575` (lightest read) on canvas-warm | 4.08 | **fails small text** |
| text-brand `#336c6a` on white / on `#e9f3f2` / on `#f2f1ef` | 6.0 / 5.3 / 5.3 | pass |
| text-brand-deep `#035256` on white | 9.0 | pass |
| text-inverse on surface-brand `#2c4035` | 11.1 | pass |
| text-inverse on `#336c6a` | 6.0 | pass |
| text-accent `#8a6040` on white | 5.5 | pass |
| text-chip `#905730` on surface-chip `#fcede6` | 5.1 | pass |
| border-default / divider `#e7e7e7` on white | 1.24 | **below 3:1** (the real app does the same) |
| `#e7e7e7` on canvas `#f8f8f8` / on `#f2f1ef` | 1.16 / 1.10 | **below 3:1** |
| border-brand selected (about `#3f6a64`) on `#e9f3f2` | 5.4 | pass |
| border-radio `#b9b9b9` on white | 1.96 | **below 3:1**, thin read so true value may be darker |
| text-progress-end `#e4e5e6` on white | 1.26 | fails (decorative label) |
| text-danger `#ff474c` on white | 3.36 | **fails small text** (Figma kept, not visible) |
| text-secondary v1.0 `#647578` on white | 4.82 | superseded |
| text-accent v1.0 `#ecaa4d` on white | 2.01 | superseded; the real app does not use it |

The failing values that are observed in the real app are kept as observed (rule 0). Remedies are in section 8 as proposals.

## 7. Enforcement checklist

Before any screen is reviewed:

1. Colours, sizes, spacing, radii, weights and borders come from tokens. No raw values in component CSS.
2. Existing component reused. New component proposed and approved first.
3. Hover, pressed, focus and disabled behave; loading and error states exist where data loads or forms submit.
4. Contrast checked (4.5:1 text, 3:1 borders and focus). New failures are flagged, not hidden.
5. Checked at 375px and at 440px or wider.
6. **The screen is compared against the matching real-app screenshot** and `docs/screenshot-audit.md` when one exists.
7. `npm run check:tokens` passes (it also blocks `npm run build`).
8. Component added or updated in `/design-system`, labelled R, F or P.

`check:tokens` fails on: raw hex/rgb colours, raw `font-size`, `line-height`, spacing, radius or border widths, numeric font weights, `:root` outside `tokens.css`, and unknown `var(--…)`. A deliberate exception needs a `ds-allow:` comment with the reason.

Changing a token value or adding a style is a material design change: ask first.

## 8. Decisions awaiting approval

| # | Proposal | Why |
|---|---|---|
| A | Darker text-only danger colour (for example `#d6303a`, about 4.8:1) | `#ff474c` is 3.36:1. No error state exists in the real app screenshots to settle it |
| B | Stronger border (3:1) for field error and focus only | The real app's own dividers are 1.24:1, so this would deliberately differ from it |
| C | Confirm `text-secondary` grey | Readings `#6f6f6f` and `#757575` fail 4.5:1 on `#f2f1ef`; `#6b6b6b` passes |
| D | Merge near-duplicates | Now evidence-based: `text-strong` and `text-primary` are **both used** by the real app (keep two). `surface-field` is within ±2 of `surface-panel`. Observed greys `#f8f8f8` / `#f9f9f9` / `#f9f8f6` / `#f2f1ef` / `#f6f6f6` are not merged here. caution vs warning and strong vs strong-alt are not visible |
| E | Fix the `#056564` typo in one icon (app copy only) | Unchanged; icons retained |
| F | Convert icons to `currentColor` | Unchanged |
| G | Hover/pressed/disabled values | Not visible in the real app |
| H | Set `--shadow-card` from the real card | Needs a native-resolution crop to recover blur and offset |
| I | Settle `hero-code` 34 vs 32 or 36, fare-card radius 10 vs 12 | Needs native crops |
| J | Replace the "Travel Groups" tab | The real app's tabs are Home, Book, My trips, Profile, Travel tools. Product decision |

## 8b. Known differences from the real app (Flow B)

- The fare and Fill-in screens in the real app have **no bottom nav**. The fare page follows that and omits it.
- Book a trip and both results pages use the aircraft-wing photo from the original Cathay Together prototype (`52e22.png`), as the prototype does and as you asked. The white title sits over a 40% overlay (PROPOSAL) so it stays readable on the orange sky.
- Results show a photo header in the white status-bar frame; the real app runs the photo under the status bar.
- The swap button on Book a trip is decorative (the demo only supports home airport to Tokyo). The real screen also has Multi-city, a promotion code, a promo carousel and "Redeem flight with miles"; none are built.
- The real app's results have a filter icon; filters are not built.
- Fare rows with long values (for example "Free (Regular seats)") can wrap to two lines at 375px.

## 9. Verification

- **Token migration (v1.0):** 16 states compared before and after at 1280px and 578px; the only difference was section headings at 25px instead of 25.5px.
- **v2.0:** values were measured from 14 real-app screenshots (`docs/screenshot-audit.md`). `tokens.css`, the component CSS and the style guide hold the v2.0 values (section 10), and `npm run check:tokens` and `npm run build` pass.
- **Flow B (flight booking):** Search, Results, Fares and both sheets were checked at 375px and 440px (no horizontal overflow, one `h1` per page, focus lands on the page title after navigation, the sheet traps focus and closes on Back or Escape) and compared by eye with S1, S5, S6 and S9. S11 was not supplied as a separate capture, so the Compare sheet follows the audit text and S9.

## 10. Token changes in `src/styles/tokens.css`

**Applied (all screens):** every row in the value-change table below, the `--radius-sheet` change (sheets use `--radius-card-lg`, 16), and the new tokens `canvas-screen`, `canvas-frame`, `text-button-*`, `text-bar-title-*` and `size-header`. Value changes were made in place, so there are no duplicate or scoped overrides.

**Not applied yet (no screen uses them):** the other new tokens listed after the table (`text-chip`, `canvas-home`, `gutter-tight`, `size-button-lg` and so on). Add each when the screen that needs it is built.

Value changes (same name):

| Token | v1.0 | v2.0 |
|---|---|---|
| `--color-surface-brand` | `#006564` | `#2c4035` |
| `--color-text-brand`, `--color-border-brand`, `--color-icon-brand`, `--color-focus-ring` | `#006564` | `#336c6a` |
| `--color-text-primary` | `#172e33` | `#262626` |
| `--color-text-secondary` | `#647578` | `#6b6b6b` |
| `--color-text-accent` | `#ecaa4d` | `#8a6040` |
| `--color-surface-brand-subtle` | `#e6f2ef` | `#e9f3f2` |
| `--color-border-default`, `--color-divider` | `#dce6e4` | `#e8e8e8` |
| `--color-overlay-scrim` | `rgba(23,46,51,.44)` | `rgba(0,0,0,.40)` |
| `--color-canvas` | `#444444` | stays the dark page behind the phone frame; screens use the new `--color-canvas-screen` `#f8f8f8` |
| `--radius-sheet` use | 20 | sheets use `--radius-card-lg` (16) |
| `--border-width-selected` | 3px | 1px |

Component and role changes (no token rename): primary buttons and secondary-button labels, surface roles (cards white, screens canvas), bottom-sheet radius, app-bar and sheet title style, button label 18, nav labels `text-secondary`, field has no box, Home and Express use the tight gutter, nav tabs.

New tokens: `text-brand-deep`, `border-brand-deep`, `text-chip`, `text-class-premium`, `text-class-business`, `canvas-home`, `canvas-warm`, `canvas-frame`, `surface-panel`, `surface-banner`, `surface-chip-brand`, `surface-table-head-a`, `surface-table-head-b`, `surface-chip`, `border-handle`, `border-radio`, `overlay-scrim-light`, `overlay-veil`, `loader-mark`, `text-progress-end`, `gradient-segment`, `gradient-fare-light`, `gradient-fare-essential`, `gutter-tight`, `size-button-lg`, `size-button-sm`, `radius-chip`, `text-button-*` (18/22), `text-bar-title-*` (20/24), `text-hero-code-*` (34/41, leading estimated).

**Applied in Flow B** (each is used by a built screen): `color-text-brand-deep`, `color-border-brand-deep`, `color-gradient-segment`, `color-text-class-premium`, `color-text-class-business`, `color-gradient-fare-light`, `color-gradient-fare-essential`, `color-surface-panel`, `color-surface-chip`, `color-text-chip`, `color-surface-table-head-a`, `color-surface-table-head-b`, `radius-chip`, `size-button-sm`, `size-button-lg`, `text-hero-code-*` (34/41), `size-tab-row`, `size-tab-indicator`, `size-segment`, `size-photo-header`, `size-result-card`, `radius-header-curve` (60, Real est.). **Flow C PROPOSALS:** `color-surface-timeline-depart` (#e7eef3, tint of steel blue), `countdown-share` (default for the ring). New icon files `ui-plane-arrival.svg` (teal) and `ui-plane-departure.svg` (steel blue), redrawn from `ui-plane-dark.svg`; no existing SVG changed. **Slider PROPOSALS:** `size-slider-track` 4, `size-slider-thumb` 22, and `slider-fill` (a default; the component sets it from its value). **New PROPOSALS:** `color-gradient-fare-flex` (the Flex strip was never sampled; it continues the Essential step to deep teal) and `color-overlay-photo` (same value as the scrim; the real photo overlay was not measured).

**Flow E** adds `size-stop-photo` (64) and `size-place-photo` (200), and new icon files `ui-train`, `ui-arrow-up`, `ui-arrow-down`, `ui-trash`, `ui-yen-sand`, `ui-pin-teal`, `ui-clock-steel`, `ui-sparkle`, `ui-check-teal`, `ui-edit-teal`, `ui-x-grey`. Existing SVGs are untouched. Place photos reuse the library in `public/assets/photos/`.

**Flow D** adds one token, `size-suggestion-photo` (210, prototype). It reuses the prototype icon files `9a5a4`, `5ea58`, `5c16d`, `c9562`, `4714d` and `c07aa`, and the prototype place photos in `public/assets/`.

Icons and vectors are retained exactly as they are. Flow B added one new file, `ui-dots-dark.svg` (the existing `ui-dots.svg` is white, for photo headers); no existing SVG was changed.

## Destination photography

Library: `src/data/photos.js`; files: `public/assets/photos/` (9 photos, each as `-cover` 880x600 and `-thumb` 240x240 JPEG, about 1.1 MB total). Status: PROPOSAL. In use: the group list, trip header and invitation show a different photo per group (`pickPhoto(destination, groupId)`).

| Rule | Value |
| --- | --- |
| Source | Unsplash free licence. Skip Unsplash+ (premium) photos. Credit in `credit` once confirmed from each photo page |
| Crops | Cover 880x600 (about 3:2) for the invite and trip header; thumb 240x240 for list cards (shown at 58, so about 4x for sharp screens) |
| Corner radius | `--radius-thumb` on thumbs, `--radius-card` on covers |
| Subject | Landmark or street scene, subject kept near the centre so square crops still work; no readable faces as the focus |
| Alt text | Required, describes the scene (see `photos.js`) |
| Stable choice | `pickPhoto(destination, groupId)` always returns the same photo for the same group |
| Not Tokyo | The Fuji and Kyoto photos were removed: the demo only supports Tokyo |
