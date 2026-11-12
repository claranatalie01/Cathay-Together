// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY, checkPlan, clockOf, hasMajority, rankVotes, retimeDay, schedule } from './itinerary.js';

const at = (clock) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
const PLACES = [
  { id: 'market', minutes: 90, open: at('08:00'), close: at('14:00'), prefer: null },
  { id: 'garden', minutes: 120, open: at('09:00'), close: at('16:30'), prefer: at('13:00') },
  { id: 'temple', minutes: 120, open: at('09:00'), close: at('17:00'), prefer: null },
  { id: 'shops', minutes: 120, open: at('11:00'), close: at('20:00'), prefer: at('13:00') },
];
const FILLERS = [
  { id: 'ramen', day: 0, minutes: 60, open: at('17:30'), close: at('21:30') },
  { id: 'park', day: 1, minutes: 90, open: at('12:00'), close: at('17:30') },
  { id: 'breakfast', day: 3, minutes: 60, open: at('08:00'), close: at('12:00') },
];
const votes = (likes, total = 3) => Object.fromEntries(Object.entries(likes).map(([id, liked]) => [id, { liked, total }]));
const find = (plan, id) => plan.days.flat().find((s) => s.id === id);
const dayOf = (plan, id) => plan.days.findIndex((stops) => stops.some((s) => s.id === id));

test('strict majority: more than half, never exactly half', () => {
  assert.equal(hasMajority({ liked: 2, total: 3 }), true);
  assert.equal(hasMajority({ liked: 1, total: 3 }), false);
  assert.equal(hasMajority({ liked: 2, total: 4 }), false);
  assert.equal(hasMajority({ liked: 3, total: 4 }), true);
  assert.equal(hasMajority({ liked: 1, total: 1 }), true);
  assert.equal(hasMajority({ liked: 0, total: 0 }), false);
});

test('votes split places into winners (most liked first), maybe and dropped', () => {
  const ranked = rankVotes(PLACES, votes({ market: 2, garden: 1, temple: 3, shops: 0 }));
  assert.deepEqual(ranked.winners.map((p) => p.id), ['temple', 'market']);
  assert.deepEqual(ranked.maybe.map((p) => p.id), ['garden']);
});

test('only winners are scheduled, and changing the votes changes the plan', () => {
  const base = { dayCount: 4, places: PLACES, fillers: FILLERS };
  const a = schedule({ ...base, votes: votes({ market: 2, garden: 1, temple: 3, shops: 0 }) });
  assert.ok(find(a, 'temple') && find(a, 'market'));
  assert.equal(find(a, 'garden'), undefined);
  assert.equal(find(a, 'shops'), undefined);
  assert.deepEqual(a.maybe, ['garden']);

  const b = schedule({ ...base, votes: votes({ market: 0, garden: 3, temple: 1, shops: 2 }) });
  assert.ok(find(b, 'garden') && find(b, 'shops'));
  assert.equal(find(b, 'market'), undefined);
  assert.deepEqual(b.maybe, ['temple']);
});

test('a full plan passes the checker and respects opening hours and travel time', () => {
  const inputs = { dayCount: 4, places: PLACES, fillers: FILLERS, votes: votes({ market: 3, garden: 3, temple: 3, shops: 3 }) };
  const plan = schedule(inputs);
  assert.deepEqual(checkPlan(plan, inputs), []);
  assert.deepEqual(plan.unplaced, []);
  for (const place of PLACES) {
    const stop = find(plan, place.id);
    assert.ok(stop.start % DAY >= place.open && stop.end % DAY <= place.close, `${place.id} inside opening hours`);
  }
  plan.days.forEach((stops) => stops.slice(1).forEach((s, i) => assert.ok(s.start - stops[i].end >= 20, 'at least 20 minutes between stops')));
});

test('winners are spread over the days, middle days first', () => {
  const plan = schedule({ dayCount: 4, places: PLACES, votes: votes({ market: 3, garden: 0, temple: 2, shops: 0 }) });
  assert.deepEqual([dayOf(plan, 'market'), dayOf(plan, 'temple')].sort(), [1, 2]);
});

test('an afternoon place starts at 13:00 when that is free; a morning place starts as early as it can', () => {
  const plan = schedule({ dayCount: 3, places: PLACES, votes: votes({ market: 3, garden: 0, temple: 0, shops: 2 }) });
  assert.equal(clockOf(find(plan, 'market').start), '08:00');
  assert.equal(clockOf(find(plan, 'shops').start), '13:00');
});

test('nothing is scheduled before everyone has landed or too close to the first departure', () => {
  // Last landing 16:10 on day 1, so free from 17:40. First take-off 11:20 on day 4, so done by 08:20.
  const inputs = { dayCount: 4, places: PLACES, fillers: FILLERS, votes: votes({ market: 3, garden: 1, temple: 3, shops: 0 }), freeFrom: at('16:10') + 90, freeUntil: 3 * DAY + at('11:20') - 180 };
  const plan = schedule(inputs);
  assert.deepEqual(checkPlan(plan, inputs), []);
  plan.days.flat().forEach((s) => assert.ok(s.start >= inputs.freeFrom && s.end <= inputs.freeUntil, `${s.id} inside the group's free time`));
  assert.equal(clockOf(find(plan, 'ramen').start), '17:45'); // first quarter-hour after 17:40
  assert.deepEqual(plan.skippedFillers, ['breakfast']); // 08:00–09:00 would run past 08:20
});

test('a landing after midnight empties the first day', () => {
  // Last landing 00:25 on day 2.
  const inputs = { dayCount: 4, places: PLACES, fillers: FILLERS, votes: votes({ market: 3, garden: 1, temple: 3, shops: 0 }), freeFrom: DAY + at('00:25') + 90 };
  const plan = schedule(inputs);
  assert.deepEqual(plan.days[0], []);
  assert.deepEqual(plan.skippedFillers, ['ramen']);
  assert.deepEqual(checkPlan(plan, inputs), []);
});

test('a suggested stop is left out when a voted place already fills that part of the day', () => {
  // Day 2: the shops (voted) start at 13:00, inside the park's afternoon window.
  const inputs = { dayCount: 3, places: PLACES, fillers: FILLERS, votes: votes({ market: 0, garden: 0, temple: 0, shops: 3 }) };
  const plan = schedule(inputs);
  assert.equal(dayOf(plan, 'shops'), 1);
  assert.equal(find(plan, 'park'), undefined);
  assert.ok(plan.skippedFillers.includes('park'));
  assert.ok(find(plan, 'ramen'), 'a filler on a day with a free evening is still added');
});

test('a winner that cannot fit is reported, not squeezed in', () => {
  // A one-day trip, free only 15:00–18:00: the market (closes 14:00) cannot fit.
  const inputs = { dayCount: 1, places: PLACES, votes: votes({ market: 3, garden: 0, temple: 0, shops: 2 }), freeFrom: at('15:00'), freeUntil: at('18:00') };
  const plan = schedule(inputs);
  assert.deepEqual(plan.unplaced, ['market']);
  assert.equal(clockOf(find(plan, 'shops').start), '15:00');
  assert.deepEqual(checkPlan(plan, inputs), []);
});

test('the checker catches broken plans', () => {
  const inputs = { dayCount: 2, places: PLACES, votes: votes({ market: 3, garden: 1, temple: 3, shops: 0 }) };
  const good = schedule(inputs);
  assert.deepEqual(checkPlan(good, inputs), []);
  const broken = (days) => checkPlan({ ...good, days }, inputs).join(' ');

  assert.match(broken([[{ id: 'market', kind: 'voted', start: at('09:00'), end: at('10:30') }, { id: 'temple', kind: 'voted', start: at('10:00'), end: at('12:00') }], []]), /less than 20 minutes/);
  assert.match(broken([[{ id: 'market', kind: 'voted', start: at('13:00'), end: at('14:30') }], [{ id: 'temple', kind: 'voted', start: DAY + at('09:00'), end: DAY + at('11:00') }]]), /ends after it is allowed/);
  assert.match(broken([[{ id: 'garden', kind: 'voted', start: at('09:00'), end: at('11:00') }], []]), /without a majority/);
  assert.match(broken([[{ id: 'market', kind: 'voted', start: at('08:00'), end: at('09:30') }], []]), /temple won the vote/);
  assert.match(broken([[{ id: 'market', kind: 'voted', start: at('08:00'), end: at('09:30') }], [{ id: 'market', kind: 'voted', start: DAY + at('08:00'), end: DAY + at('09:30') }, { id: 'temple', kind: 'voted', start: DAY + at('10:00'), end: DAY + at('12:00') }]]), /scheduled twice/);
});

test('reordering a day keeps the order and re-times it without overlaps', () => {
  const items = [{ ...PLACES[3], kind: 'voted' }, { ...PLACES[2], kind: 'voted' }];
  const timed = retimeDay({ day: 1, items });
  assert.deepEqual(timed.map((s) => [s.id, clockOf(s.start), clockOf(s.end)]), [['shops', '11:00', '13:00'], ['temple', '13:30', '15:30']]);
});

test('same inputs, same plan (no randomness)', () => {
  const inputs = { dayCount: 4, places: PLACES, fillers: FILLERS, votes: votes({ market: 2, garden: 3, temple: 2, shops: 1 }) };
  assert.deepEqual(schedule(inputs), schedule(inputs));
});

// ---- Per-pair travel and closed days -----------------------------------------------------------
const TWO = [
  { id: 'a', minutes: 60, open: at('09:00'), close: at('18:00'), prefer: null },
  { id: 'b', minutes: 60, open: at('09:00'), close: at('18:00'), prefer: null },
];
const oneDay = (extra) => schedule({ dayCount: 1, places: TWO, votes: votes({ a: 3, b: 2 }), ...extra });

// Start times round up to a quarter hour, so a 20 minute gap shows up as 20 to 34 minutes.
test('without a travel function the standard 20 minute gap is kept', () => {
  const gap = find(oneDay({}), 'b').start - find(oneDay({}), 'a').end;
  assert.ok(gap >= 20 && gap < 35, `gap ${gap}`);
});

test('a travel function sets the gap for that pair', () => {
  const travel = (from, to) => (from === 'a' && to === 'b') || (from === 'b' && to === 'a') ? 45 : undefined;
  const plan = oneDay({ travel });
  assert.equal(find(plan, 'b').start - find(plan, 'a').end, 45);
  assert.deepEqual(checkPlan(plan, { dayCount: 1, places: TWO, votes: votes({ a: 3, b: 2 }), travel }), []);
});

test('the checker rejects a gap that is shorter than the travel time', () => {
  const plan = oneDay({});
  const problems = checkPlan(plan, { dayCount: 1, places: TWO, votes: votes({ a: 3, b: 2 }), travel: () => 60 });
  assert.ok(problems.some((p) => p.includes('less than 60 minutes')), problems.join('|'));
});

test('a pair the travel function does not know falls back to 20 minutes', () => {
  const plan = oneDay({ travel: () => undefined });
  const gap = find(plan, 'b').start - find(plan, 'a').end;
  assert.ok(gap >= 20 && gap < 35, `gap ${gap}`);
});

test('a place is never put on a day it is closed, and the checker agrees', () => {
  const closed = [{ ...TWO[0], closedOn: [1] }, TWO[1]];
  const plan = schedule({ dayCount: 3, places: closed, votes: votes({ a: 3, b: 3 }) });
  assert.notEqual(dayOf(plan, 'a'), 1);
  assert.deepEqual(checkPlan(plan, { dayCount: 3, places: closed, votes: votes({ a: 3, b: 3 }) }), []);
  const forced = { days: [[], [{ id: 'a', kind: 'voted', start: DAY + at('10:00'), end: DAY + at('11:00') }], []], maybe: [], unplaced: ['b'], skippedFillers: [] };
  const problems = checkPlan(forced, { dayCount: 3, places: closed, votes: votes({ a: 3, b: 3 }) });
  assert.ok(problems.some((p) => p.includes('when it is closed')), problems.join('|'));
});

test('a place closed on every day is reported as not fitting', () => {
  const never = [{ ...TWO[0], closedOn: [0, 1] }];
  const plan = schedule({ dayCount: 2, places: never, votes: votes({ a: 3 }) });
  assert.deepEqual(plan.unplaced, ['a']);
});

test('retimeDay uses the travel time between the stops it packs', () => {
  const items = TWO.map((p) => ({ ...p, kind: 'voted' }));
  const [first, second] = retimeDay({ day: 0, items, travel: () => 45 });
  assert.equal(second.start - first.end >= 45, true);
});
