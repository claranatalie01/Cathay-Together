// Hand-written facts the style guide shows next to the parsed tokens.

// Foreground / background pairs the product uses. Checked at runtime.
export const CONTRAST_PAIRS = [
  { fg: '--color-text-primary', bg: '--color-surface-default', use: 'Body text', min: 4.5 },
  { fg: '--color-text-secondary', bg: '--color-surface-default', use: 'Labels, meta', min: 4.5 },
  { fg: '--color-text-secondary', bg: '--color-surface-brand-subtle', use: 'Meta on tinted panel', min: 4.5 },
  { fg: '--color-text-brand', bg: '--color-surface-default', use: 'Titles, links', min: 4.5 },
  { fg: '--color-text-inverse', bg: '--color-surface-brand', use: 'Primary button, toast', min: 4.5 },
  { fg: '--color-text-warning', bg: '--color-surface-warning', use: '"Booked" chip', min: 4.5 },
  { fg: '--color-text-caution', bg: '--color-surface-caution', use: 'Arrival-window badge', min: 4.5 },
  { fg: '--color-text-danger', bg: '--color-surface-default', use: 'Field error text', min: 4.5 },
  { fg: '--color-text-inverse', bg: '--color-surface-destructive', use: 'Delete and Leave buttons', min: 4.5 },
  { fg: '--color-text-accent', bg: '--color-surface-default', use: '"Lowest Fare"', min: 4.5 },
  { fg: '--color-border-default', bg: '--color-surface-default', use: 'Field border (non-text 3:1)', min: 3 },
  { fg: '--color-focus-ring', bg: '--color-surface-default', use: 'Focus ring (non-text 3:1)', min: 3 },
];

export const TEXT_ROLES = {
  micro: 'Smallest labels',
  'caption-sm': 'Dense meta',
  caption: 'Field labels, chips, errors',
  'body-sm': 'Toast, small body',
  body: 'Body, sheet text',
  'body-lg': 'Placeholder and intro copy',
  'body-xl': 'Buttons, field text, screen base',
  'title-xs': 'Compact section title',
  'title-sm': 'Card title',
  'title-md': 'Card title',
  title: 'Large card title',
  'heading-sm': 'Section heading',
  'heading-md': 'Heading',
  heading: 'Heading',
  'page-title': 'Page title, sheet title',
  'display-sm': 'Display heading',
  display: 'Hero number',
  code: 'Invite code',
  timer: 'Countdown',
  glyph: 'Mark glyph in state messages',
};

// Components defined in Figma that the React app has not built yet. They are
// built from this guide when their screens arrive (Flow B onwards).
export const PLANNED = [
  ['Text action', '"Pick flight →", "Share invite"', 'Partly built as .section-heading__action'],
  ['Suggestion card, selected flight card', 'Selected variant', 'Flight and fare cards are built; selected variants are not'],
  ['Callout / banner', 'Surface, tint, warning', 'Built as BonusTeaser only'],
  ['Avatar and avatar stack', 'Sizes 26, 28, 36, 40, 44', 'Member avatar is built; sizes are not'],
  ['Button sizes', '48 action, 54 pill, 39 "Select"', 'Only the 52 full-width button is built'],
];

export const CHECKLIST = [
  'Colours, sizes, spacing, radii and weights come from tokens.css. Never write a raw value.',
  'Use an existing component. If none fits, propose a new one here first and wait for approval.',
  'Every interactive element shows a visible focus ring and has a hover, pressed and disabled state.',
  'Text meets 4.5:1, borders and focus rings meet 3:1. Failing Figma colours stay flagged, not hidden.',
  'Check the screen at 375px and at 440px or wider (framed on the dark canvas).',
  'Run npm run check:tokens. It must pass before a screen is reviewed.',
  'Add or update the component in this guide, labelled Figma or Proposal.',
];
