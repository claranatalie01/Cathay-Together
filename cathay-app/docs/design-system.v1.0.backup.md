# Cathay Together design system (v1.0)

Every screen follows this system. The live version is the style guide at **`/design-system`**
(run `npm run dev`, open <http://localhost:5173/design-system>). It reads `src/styles/tokens.css`
and renders the real components, so it cannot drift from the code. This document explains the
rules behind it.

**Sources:** the Figma file, then the prototype in `frontend/`. Where Figma is silent the item is
labelled **PROPOSAL** and needs approval before it is relied on. Nothing has been restyled to
"improve" the design: every Figma value is kept, including values that fail contrast.

Status labels used everywhere (docs, style guide, token comments):

| Label | Meaning |
|---|---|
| Figma / prototype | Value or component taken from the Figma file or the prototype |
| **PROPOSAL** | Not in Figma. Added so the product works (states, errors, loading). Needs approval |
| Flagged | A Figma value with a contrast or near-duplicate issue. Kept as designed |

## 1. What Figma defines

Only three shared styles exist; everything else is hard-coded on each screen.

| Name | Value |
|---|---|
| Colour style "Dark" | `#141B34` (13 icon files) |
| Effect style "XXS Shadow" | `0 2px 4px -2px rgba(24,39,75,.12), 0 4px 4px -2px rgba(24,39,75,.08)` |
| Colour variable "#D9D9D9" | resolves to `#CFCFCF` |

Figma components have no hover, focus, pressed, disabled, error or loading states. Only the Day
tab and the return flight card have variants (default / selected).

## 2. Where things live

| What | Where |
|---|---|
| All tokens (the only place raw values may be written) | `src/styles/tokens.css` |
| Component styles (tokens only) | `src/components/**/*.css`, `src/features/**/*.css` |
| Style guide page | `src/design-system/` (route `/design-system`) |
| Token checker | `scripts/check-tokens.mjs` (`npm run check:tokens`, also runs before `npm run build`) |
| Visual regression harness (dev only) | `scripts/ds-snapshot.js` |
| Demo panel | `src/demo/`. **Not part of the design system**; the style guide never renders it |

## 3. Tokens

### 3.1 Naming

`--<category>-<role>[-<variant>]`. Names say what a value is for, not what it looks like.

- Colour: `--color-text-*`, `--color-surface-*`, `--color-border-*`, `--color-icon-*`, plus
  `--color-divider`, `--color-overlay-scrim`, `--color-focus-ring`, `--color-neutral-*`, `--color-canvas`.
- Type: `--text-<style>-size` with `--text-<style>-leading` (always used as a pair), `--weight-*`,
  `--font-family`, `--font-family-numeric` (Lexend, flight search filters only).
- Space: `--space-xs … --space-3xl` (4, 8, 12, 16, 24, 32, 40) and `--space-optical-N` for Figma's
  off-grid values (2, 3, 5, 6, 7, 9, 10, 13, 14, 18, 20, 22, 28, 30).
- Radius (by use): `--radius-hairline` 2, `bar` 3, `badge` 5, `thumb` 6, `control` 8, `button-lg` 10,
  `card` 12, `panel` 14, `card-lg` 16, `sheet` 20, `pill` 100.
- Border width: `--border-width-default` 1, `-strong` 2, `-selected` 3.
- Effects: `--shadow-card`, `--opacity-disabled`, `--opacity-hover`, `--opacity-pressed`,
  `--focus-ring-width`, `--focus-ring-offset`, `--color-focus-ring`.
- Layout: `--screen-width` 440, `--screen-height` 956.

### 3.2 Colour

| Token | Value | Use | Status |
|---|---|---|---|
| `--color-text-primary` | `#172e33` | Body text | Figma |
| `--color-text-secondary` | `#647578` | Labels, meta | Flagged: 4.20:1 on `surface-brand-subtle` |
| `--color-text-strong` | `#000000` | Flight card, nav labels | Flagged: near-duplicate of text-primary |
| `--color-text-inverse` | `#ffffff` | Text on brand | Figma |
| `--color-text-brand` | `#006564` | Titles, links, selected | Figma |
| `--color-text-warning` | `#886a38` | "Booked" chip | Figma |
| `--color-text-caution` | `#854d0e` | Arrival-window badge | Flagged: near-duplicate of text-warning |
| `--color-text-danger` | `#ff474c` | Late time, field errors | Flagged: 3.36:1 on white |
| `--color-text-accent` | `#ecaa4d` | "Lowest Fare" | Flagged: 2.01:1 on white |
| `--color-text-pass` | `#796c69` | "PASSED" stamp | Figma, one-off |
| `--color-surface-default` | `#ffffff` | Screen, sheet, secondary button | Figma |
| `--color-surface-subtle` | `#f4f8f7` | Cards, chips, callouts | Figma |
| `--color-surface-field` | `#fbfbfb` | Search form, date chips | Flagged: near-duplicate of surface-subtle |
| `--color-surface-brand` | `#006564` | Primary button, toast | Figma |
| `--color-surface-brand-subtle` | `#e6f2ef` | Brand-tinted panels, state mark | Figma |
| `--color-surface-warning` | `#fbf5ea` | Alerts, "Booked" chip | Figma |
| `--color-surface-caution` | `#fff3d6` | Arrival-window badge | Flagged: near-duplicate of surface-warning |
| `--color-surface-fare` | `#a8dcab` | Fare panel (25% opacity) | Figma, one-off |
| `--color-border-default` | `#dce6e4` | Card and field borders | Flagged: 1.27:1 on white |
| `--color-border-brand` | `#006564` | Selected, focus | Figma |
| `--color-border-inverse` | `#ffffff` | Avatar ring | Figma |
| `--color-border-strong` / `-alt` | `rgba(0,0,0,.43)` / `.54` | Flight card, search controls | Flagged: near-duplicates |
| `--color-border-danger` | `#ff474c` | Invalid field | PROPOSAL use of the Figma alert colour |
| `--color-border-pass` | `#796c69` | Stamp | Figma, one-off |
| `--color-divider` | `#dce6e4` | Rules, sheet handle | Figma |
| `--color-neutral-line` / `-track` | `#d9d9d9` / `#d3d3d3` | Dividers, progress tracks | Flagged: near-duplicates |
| `--color-overlay-scrim` | `rgba(23,46,51,.44)` | Sheet backdrop | Figma |
| `--color-icon-default` / `-brand` | `#141b34` / `#006564` | Icons (style "Dark") | Figma |
| `--color-focus-ring` | `#006564` | Focus ring | PROPOSAL |
| `--color-canvas` | `#444444` | Page behind the phone frame | Not product UI |

### 3.3 Typography

Inter throughout. Figma sets line height to "normal", which is whole pixels at each size, so each
style stores its size and leading together.

| Style | Size / leading | Used for |
|---|---|---|
| micro | 10 / 12 | Smallest labels |
| caption-sm | 11 / 13 | Dense meta |
| caption | 12 / 15 | Field labels, chips, errors |
| body-sm | 13 / 16 | Toast, small body |
| body | 14 / 17 | Body, sheet text |
| body-lg | 15 / 18 | Intro and placeholder copy |
| body-xl | 16 / 19 | Buttons, field text, screen base |
| title-xs / sm / md / title | 17 / 21, 18 / 22, 19 / 23, 20 / 24 | Card and compact section titles |
| heading-sm / md / heading | 21 / 25, 22 / 27, 23 / 28 | Section headings |
| page-title | 25 / 30 | Page title (semibold, brand), sheet title |
| display-sm / display | 26 / 31, 32 / 39 | Display headings |
| code / timer | 36 / 44, 44 / 53 | Invite code, countdown |
| glyph | 34 | **PROPOSAL**: mark inside state messages |

Weights: regular 400, medium 500, semibold 600, bold 700. Multi-line copy uses a ratio
(`--leading-body` 1.45, `--leading-tight` 1.4, `--leading-heading` 1.2); `--leading-NN` tokens hold the
whole-pixel values Figma uses where a size has a different leading.

### 3.4 Old name to new name

The prototype names are gone from `src/`. A colour that served two roles split by property.

| Old | New |
|---|---|
| `--color-primary` | `text-brand` (colour), `surface-brand` (background), `border-brand` (border) |
| `--color-ink` / `--color-muted` / `--color-black` | `text-primary` / `text-secondary` / `text-strong` |
| `--color-white` | `text-inverse` (colour), `surface-default` (background), `border-inverse` (border) |
| `--color-surface` | `surface-subtle` |
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

Only one merge was made: `#D9D9D9` and the Figma variable `#CFCFCF` are one value
(`--color-neutral-line`). All other near-duplicates stay separate and are flagged in `tokens.css`.

## 4. Components

**F** = in Figma, **P** = proposal. Built components are in `src/components/` and shown at `/design-system`.

| Component | Variants | Figma states | Proposed states (all P) |
|---|---|---|---|
| Button | primary, secondary (52px full width) | default | hover, pressed, focus, disabled, loading |
| Chip | neutral, primary, sand, tint | default | none (not interactive) |
| Field | text, select with icon | default | hover, focus, error, disabled |
| Group card | default | default | hover, pressed |
| Trip context, Member row, Section heading, Bonus teaser | | default | |
| Status bar, Page header, Bottom nav | page header with back; nav with Travel Groups or Book active | default, active | hover and pressed on back button and tabs |
| Sheet + scrim | decline-invite sheet | open | focus trap, Escape, return focus |
| State message | confirmation, building (F) | default | empty, error, unavailable |
| Skeleton, Toast, inline field error | | not in Figma | all P |

**Proposed state styles use tokens only**: hover `--opacity-hover` (0.9), pressed `--opacity-pressed`
(0.8), disabled `--opacity-disabled` (0.6), focus `--focus-ring-*`. Card and field hover use existing
colour tokens. No new colours were introduced. `is-hover`, `is-pressed`, `is-focus` classes mirror the
pseudo-classes for the style guide only; product code must not set them.

**Defined in Figma, not built yet:** text action, tabs, flight/fare/suggestion cards, callout variants,
avatar sizes, 48/54/39 button sizes. They are built from this system when their screens arrive.

Component rules:

- Reuse a component before writing markup. If none fits, propose a new one (name, variants, states,
  Figma reference or **PROPOSAL**) and wait for approval.
- One primary button per screen. Loading sets `disabled` and `aria-busy`, and keeps the label.
- Every field has a visible label; errors sit under the field with `role="alert"` and are linked with
  `aria-describedby`.
- A card is one link. Do not nest another link or button inside it.
- Chips show status only. The label carries meaning, never colour alone.

## 5. Usage rules

**Spacing.** Use the scale (4, 8, 12, 16, 24, 32, 40); gutter is `--space-xl` (24). Use an
`--space-optical-N` token only to match a Figma measurement.

**Text hierarchy.** Page title (`page-title`, semibold, brand), section heading (`heading-sm` or
`title-xs` for compact), card title (`title-sm` to `title`), body (`body` / `body-lg`), meta (`caption`),
micro labels (`micro`, `caption-sm`). Do not skip to an unrelated size to "fit"; ask for a new style.

**Colour.** Text uses `--color-text-*`, backgrounds `--color-surface-*`, outlines `--color-border-*`.
Brand colour marks action and selection only. Use warning tones for booked/caution, never for errors.

**Layout.** The screen is 440px wide with a 24px gutter. At 768px and below it fills the viewport; above,
it is centred on the dark canvas. Every screen starts with status bar and page header; the page title
is the `h1` and takes focus after navigation. Bottom nav sits at the bottom.

**Accessibility.** Text needs 4.5:1; borders and focus rings need 3:1. Every interactive element has a
visible focus ring (2px brand, 2px offset), an accessible name, and works by keyboard. Sheets
trap focus and close on Escape. Motion respects `prefers-reduced-motion`.

## 6. Accessibility findings (measured in the style guide)

| Pair | Ratio | Result |
|---|---|---|
| text-primary on surface-default | 14.24 | pass |
| text-secondary on surface-default | 4.82 | pass |
| text-secondary on surface-brand-subtle | 4.20 | **fails small text** |
| text-brand on white; inverse on brand | 6.90 | pass |
| text-warning on surface-warning | 4.65 | pass |
| text-caution on surface-caution | 6.21 | pass |
| text-danger on white | 3.36 | **fails small text** |
| text-accent on white | 2.01 | **fails** |
| border-default on white | 1.27 | **below 3:1** |
| focus-ring on white | 6.90 | pass |

The failing values are Figma's and are kept. Remedies are in section 8 as proposals.

## 7. Enforcement checklist

Before any screen is reviewed:

1. Colours, sizes, spacing, radii, weights and borders come from tokens. No raw values in component CSS.
2. Existing component reused. New component proposed and approved first.
3. Hover, pressed, focus and disabled behave; loading and error states exist where data loads or forms submit.
4. Contrast checked (4.5:1 text, 3:1 borders and focus). New failures are flagged, not hidden.
5. Checked at 375px and at 440px or wider.
6. `npm run check:tokens` passes (it also blocks `npm run build`).
7. Component added or updated in `/design-system`, labelled Figma or PROPOSAL.

`check:tokens` fails on: raw hex/rgb colours, raw `font-size`, `line-height`, spacing, radius or border
widths, numeric font weights, `:root` outside `tokens.css`, and unknown `var(--…)`. A deliberate exception
needs a `ds-allow:` comment with the reason (used for the visually-hidden helper and the guide's dashed rule).

Changing a token value or adding a style is a material design change: ask first.

## 8. Decisions awaiting approval

| # | Proposal | Why |
|---|---|---|
| A | Darker text-only danger colour (for example `#d6303a`, about 4.8:1) for field errors | `#ff474c` is 3.36:1 |
| B | Stronger border (3:1) for field error and focus only | Default `#dce6e4` is 1.27:1 |
| C | Darker `text-secondary` on `surface-brand-subtle` | 4.20:1 |
| D | Merge near-duplicates (`text-strong`/`text-primary`, `surface-field`/`surface-subtle`, caution/warning, strong/strong-alt borders) | Fewer tokens; slight visible change |
| E | Fix the `#056564` typo in one icon (app copy only) | Looks like a typo for `#006564` |
| F | Convert icons to `currentColor` | Lets icons follow state colours |
| G | Hover/pressed/disabled values (`--opacity-hover` 0.9, `-pressed` 0.8, `-disabled` 0.6) | Chosen, not designed |

Real Cathay app screenshots are in `reference screenshot cathay app/`. They are used to report
differences from Figma, not to change values, until a difference is approved. Icons and vectors are
retained as they are.

## 9. Verification done

- Token migration: 16 states compared before and after at 1280px and 578px. The only difference is
  section headings, now 25px (Figma's whole-pixel "normal" for 21px type) instead of 25.5px.
- `npm run check:tokens` passes on 26 stylesheets; `npm run build` succeeds.
- `/design-system` checked at 1100px and 375px: no horizontal scroll, one `h1`, states computed as
  specified, sheet traps focus and closes on Escape, toast appears.
