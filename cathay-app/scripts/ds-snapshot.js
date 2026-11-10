// Dev-only QA helper (not part of the app bundle).
// Records computed styles and layout boxes for every Flow A state, then compares
// a later run against the saved baseline. Used to prove CSS refactors change
// nothing visually. In the browser console on the running dev server:
//   const qa = await import('/scripts/ds-snapshot.js');
//   await qa.run('baseline');   // before a refactor
//   await qa.run('compare');    // after: returns a list of differences
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROPS = ['display','position','width','height','marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft','color','backgroundColor','borderTopWidth','borderTopColor','borderTopStyle','borderRightWidth','borderBottomWidth','borderBottomColor','borderLeftWidth','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','boxShadow','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','opacity','gap','top','left','right','bottom','textAlign','whiteSpace','textDecorationLine','overflow','flexGrow','flexShrink','alignItems','justifyContent','flexDirection','zIndex','transform','outlineStyle'];

const go = async (path, ms = 800) => {
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  await wait(ms);
};

const setValue = (el, value) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};

const find = (selector, text) => [...document.querySelectorAll(selector)].find((n) => !text || n.textContent.trim() === text);

// Waits (up to 4s) for the element to appear, then clicks it.
const click = async (selector, text) => {
  for (let i = 0; i < 40 && !find(selector, text); i += 1) await wait(100);
  const el = find(selector, text);
  if (!el) throw new Error(`missing ${selector} ${text ?? ''} at ${location.pathname}`);
  el.click();
};

const ready = async (selector) => {
  for (let i = 0; i < 40 && !document.querySelector(selector); i += 1) await wait(100);
  await wait(150);
};

const snap = () => {
  window.scrollTo(0, 0);
  return [...document.querySelectorAll('#root *')].map((e, i) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const cls = typeof e.className === 'string' ? e.className : '';
    const box = [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10).join(',');
    return `${i}:${e.tagName}.${cls}|${PROPS.map((p) => cs[p]).join(',')}|${box}`;
  });
};

const options = (patch) => {
  const key = 'cathay-mock-options-v1';
  const current = JSON.parse(localStorage.getItem(key) || '{}');
  localStorage.setItem(key, JSON.stringify({ latencyMs: 250, failNext: false, ...current, ...patch }));
};

async function capture() {
  const out = {};
  const cap = (name) => { out[name] = snap(); localStorage.setItem('ds-progress', `${name} @ ${location.pathname}`); };
  localStorage.setItem('cathay-demo-ui-v1', JSON.stringify({ visible: true }));
  options({ latencyMs: 250, failNext: false });
  await go('/reset', 900);
  cap('create');
  setValue(document.getElementById('field-name'), '');
  setValue(document.getElementById('field-destination'), 'Paris');
  await click('button[type=submit]'); await wait(250);
  cap('create-errors');
  await go('/groups'); cap('groups-gaudi');
  await go('/groups/tokyo-together/invite', 300); await ready('.invite-link__copy'); cap('members-sample');
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  await click('.invite-link__copy'); await wait(400); cap('members-copied');
  setValue(document.getElementById('demo-viewer'), 'clara'); await ready('.invite-card'); cap('invite');
  await click('.button', 'Decline'); await wait(400); cap('invite-sheet');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(200);
  await click('.button', 'Decline'); await wait(250);
  await click('[role=dialog] .button', 'Decline invitation'); await ready('.state__title'); cap('declined');
  await go('/invite/NOPE12', 1000); cap('unavailable');
  await go('/groups'); cap('groups-clara');
  options({ failNext: true });
  await go('/groups/new', 300); await go('/groups'); cap('error');
  options({ latencyMs: 5000 }); await go('/groups/new', 300); await go('/groups', 400); cap('loading');
  options({ latencyMs: 250 }); await wait(5200);
  await go('/coming-soon/my-trips'); cap('coming-soon');
  await go('/nope'); cap('not-found');
  await go('/groups/missing/invite'); cap('group-missing');
  await go('/groups'); await ready('#demo-viewer');
  setValue(document.getElementById('demo-viewer'), 'gaudi'); await wait(600);
  await go('/groups/new', 500);
  await click('button[type=submit]'); await ready('.invite-link__copy'); cap('members-new');
  await go('/reset', 900);
  return out;
}

function diff(base, now) {
  const problems = [];
  for (const name of Object.keys(base)) {
    const a = base[name]; const b = now[name];
    if (!b) { problems.push(`${name}: state missing`); continue; }
    if (a.length !== b.length) problems.push(`${name}: element count ${a.length} -> ${b.length}`);
    const n = Math.min(a.length, b.length);
    let shown = 0;
    for (let i = 0; i < n && shown < 4; i += 1) {
      if (a[i] === b[i]) continue;
      const [ha, pa, ba] = a[i].split('|'); const [, pb, bb] = b[i].split('|');
      const pn = [...PROPS];
      const aa = pa.split(','); const bbp = pb.split(',');
      const changed = pn.filter((_, k) => aa[k] !== bbp[k]).map((p) => `${p}: ${aa[pn.indexOf(p)]} -> ${bbp[pn.indexOf(p)]}`);
      problems.push(`${name} #${ha}${ba !== bb ? ` box ${ba} -> ${bb}` : ''} ${changed.join('; ')}`);
      shown += 1;
    }
  }
  return problems;
}

export async function run(mode) {
  const key = `ds-baseline-${innerWidth}`;
  const result = await capture();
  if (mode === 'baseline') {
    localStorage.setItem(key, JSON.stringify(result));
    return `baseline saved for ${innerWidth}px: ${Object.keys(result).length} states, ${Object.values(result).reduce((s, v) => s + v.length, 0)} elements`;
  }
  const base = JSON.parse(localStorage.getItem(key) || 'null');
  if (!base) return 'no baseline for this width';
  const problems = diff(base, result);
  return problems.length ? problems : `identical (${Object.keys(result).length} states)`;
}
