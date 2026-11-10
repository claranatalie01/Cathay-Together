import tokensCss from '../styles/tokens.css?raw';

// Reads src/styles/tokens.css itself, so the style guide can never drift from the
// real tokens. Returns [{ section, name, value, note, status }] in file order.
//   status: 'proposal' (comment says PROPOSAL) | 'flag' (comment records a
//   contrast or near-duplicate issue) | 'source' (taken from Figma / prototype).
const SECTION = /^\s*\/\*\s*-{2,}\s*(.+?)\s*-{2,}\s*\*\/\s*$/;
const DECLARATION = /(--[\w-]+):\s*([^;]+);(?:[ \t]*\/\*\s*(.*?)\s*\*\/)?/g;

function statusOf(note) {
  if (/PROPOSAL/.test(note)) return 'proposal';
  if (/below|near-duplicate|fails|:1/i.test(note)) return 'flag';
  return 'source';
}

export const TOKENS = (() => {
  const out = [];
  let section = '';
  for (const line of tokensCss.split('\n')) {
    const heading = line.match(SECTION);
    if (heading) {
      section = heading[1];
      continue;
    }
    for (const match of line.matchAll(DECLARATION)) {
      const note = match[3] ?? '';
      out.push({ section, name: match[1], value: match[2].trim(), note, status: statusOf(note) });
    }
  }
  return out;
})();

export const tokensIn = (prefix) => TOKENS.filter((token) => token.name.startsWith(prefix));
export const tokenValue = (name) => TOKENS.find((token) => token.name === name)?.value;
export const tokenSections = (prefix) => [...new Set(tokensIn(prefix).map((token) => token.section))];
