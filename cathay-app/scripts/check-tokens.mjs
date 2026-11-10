#!/usr/bin/env node
// Design-system guard. Fails if any stylesheet outside src/styles/tokens.css
//   - contains a raw colour (hex, rgb, hsl),
//   - sets font-size, line-height, spacing, radius, border or outline widths with a raw px/rem/em value,
//   - sets a numeric font-weight,
//   - declares its own :root,
//   - refers to a custom property that is not defined (in tokens.css or locally).
// Add `/* ds-allow: reason */` on the same line to allow a justified exception.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const TOKENS = join(root, 'styles', 'tokens.css');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.css') ? [path] : [];
  });

const files = walk(root);
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// Names defined anywhere (tokens.css plus local scopes such as --demo-accent).
const defined = new Set();
for (const file of files) {
  for (const m of stripComments(readFileSync(file, 'utf8')).matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
}

const SPACING = /^(gap|row-gap|column-gap|padding(-[a-z]+)*|margin(-[a-z]+)*)$/;
const RADIUS = /^border(-[a-z]+)*-radius$/;
const BORDERISH = /^(border(-(top|right|bottom|left))?|outline(-offset)?|border-width)$/;
const LITERAL_LENGTH = /(?<![\w.#-])-?\d*\.?\d+(px|rem|em)\b/;
const withoutVars = (v) => v.replace(/var\([^)]*\)/g, '');

const problems = [];
for (const file of files) {
  if (file === TOKENS) continue;
  const raw = readFileSync(file, 'utf8');
  const rawLines = raw.split('\n');
  const text = stripComments(raw);
  const rel = relative(process.cwd(), file);
  const allowed = (line) => /ds-allow:/.test(rawLines[line - 1] ?? '');
  const lineOf = (index) => text.slice(0, index).split('\n').length;

  for (const m of text.matchAll(/:root\b/g)) {
    problems.push(`${rel}:${lineOf(m.index)}  :root is only allowed in styles/tokens.css`);
  }
  for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?)\(/g)) {
    const line = lineOf(m.index);
    if (!allowed(line)) problems.push(`${rel}:${line}  raw colour "${m[0]}": use a --color-* token`);
  }
  for (const m of text.matchAll(/var\((--[\w-]+)/g)) {
    if (!defined.has(m[1])) problems.push(`${rel}:${lineOf(m.index)}  unknown token ${m[1]}`);
  }
  for (const m of text.matchAll(/(^|[;{\s])([a-z-]+)\s*:\s*([^;{}]+);/g)) {
    const prop = m[2];
    const value = m[3].trim();
    const line = lineOf(m.index + m[1].length);
    if (allowed(line)) continue;
    const bare = withoutVars(value);
    if (prop === 'font-size' && value !== 'inherit' && /[\d.]+(px|rem|em)/.test(bare)) {
      problems.push(`${rel}:${line}  font-size "${value}": use a --text-*-size token`);
    } else if (prop === 'line-height' && /[\d.]+(px|rem|em)/.test(bare)) {
      problems.push(`${rel}:${line}  line-height "${value}": use a --text-*-leading or --leading-* token`);
    } else if (prop === 'font-weight' && /^\d+$/.test(value)) {
      problems.push(`${rel}:${line}  font-weight ${value}: use a --weight-* token`);
    } else if (SPACING.test(prop) && LITERAL_LENGTH.test(bare)) {
      problems.push(`${rel}:${line}  ${prop} "${value}": use --space-* tokens`);
    } else if (RADIUS.test(prop) && LITERAL_LENGTH.test(bare)) {
      problems.push(`${rel}:${line}  ${prop} "${value}": use --radius-* tokens`);
    } else if (BORDERISH.test(prop) && LITERAL_LENGTH.test(bare)) {
      problems.push(`${rel}:${line}  ${prop} "${value}": use --border-width-* / --focus-ring-* tokens`);
    }
  }
}

if (problems.length) {
  console.error(`Design-system check failed (${problems.length}):`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log(`Design-system check passed: ${files.length - 1} stylesheets use tokens only.`);
