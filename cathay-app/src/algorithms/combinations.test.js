// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instantOf } from './arrivalWindow.js';
import { rankCombinations } from './combinations.js';

const tokyo = (clock) => instantOf('2026-11-21', clock, 'HND');
const flight = (id, price, clock) => ({ id, price, instant: tokyo(clock) });

// Three travellers, two flights each, landing in Tokyo. The eight combinations:
//   G1 C1 K1  16,500  1h15      G2 C1 K1  15,900  2h40
//   G1 C1 K2  15,800  3h20      G2 C1 K2  15,200  2h55
//   G1 C2 K1  15,900  6h45      G2 C2 K1  15,300  5h30
//   G1 C2 K2  15,200  6h45      G2 C2 K2  14,600  3h40
const GAUDI = { userId: 'gaudi', flights: [flight('G1', 5500, '13:45'), flight('G2', 4900, '16:50')] };
const CLARA = { userId: 'clara', flights: [flight('C1', 4200, '14:10'), flight('C2', 3600, '20:30')] };
const KABE = { userId: 'kabe', flights: [flight('K1', 6800, '15:00'), flight('K2', 6100, '17:05')] };
const TRIO = [GAUDI, CLARA, KABE];
const ids = (option) => option.picks.map((p) => p.flightId);

test('cheapest: lowest total price', () => {
  const { cheapest } = rankCombinations({ members: TRIO });
  assert.deepEqual(ids(cheapest), ['G2', 'C2', 'K2']);
  assert.equal(cheapest.total, 14600);
  assert.equal(cheapest.spreadMinutes, 220); // 16:50 .. 20:30
});

test('closest: smallest gap between first and last landing', () => {
  const { closest } = rankCombinations({ members: TRIO });
  assert.deepEqual(ids(closest), ['G1', 'C1', 'K1']);
  assert.equal(closest.spreadMinutes, 75); // 13:45 .. 15:00
  assert.equal(closest.total, 16500);
});

test('balanced: a clear middle option wins', () => {
  // A is cheap but 5h apart, C is tight but dear, B costs a little more than A and is nearly as
  // tight as C. Scores: A = 0 + 1, C = 1 + 0, B = 10/100 + 10/250 = 0.14.
  const one = { userId: 'x', flights: [flight('x', 0, '12:00')] };
  const two = { userId: 'y', flights: [flight('A', 100, '17:00'), flight('B', 110, '13:00'), flight('C', 200, '12:50')] };
  const { cheapest, closest, balanced } = rankCombinations({ members: [one, two] });
  assert.equal(cheapest.picks[1].flightId, 'A');
  assert.equal(closest.picks[1].flightId, 'C');
  assert.equal(balanced.picks[1].flightId, 'B');
});

test('balanced never picks a combination that another one beats on both price and time', () => {
  // D is dearer AND further apart than B, so it can never be the answer.
  const one = { userId: 'x', flights: [flight('x', 0, '12:00')] };
  const two = { userId: 'y', flights: [flight('A', 100, '17:00'), flight('B', 150, '13:00'), flight('D', 160, '14:00'), flight('C', 200, '12:10')] };
  const { balanced } = rankCombinations({ members: [one, two] });
  assert.equal(balanced.picks[1].flightId, 'B');
});

test('balanced: with no clear middle, a tie goes to the closer landing', () => {
  // In the trio the in-between options are no better than the two ends (the best scores 1.006
  // against exactly 1 for each end), so landing together wins the tie.
  const { balanced, closest } = rankCombinations({ members: TRIO });
  assert.deepEqual(ids(balanced), ids(closest));
});

test('every combination is tried: 2 x 2 x 2 = 8', () => {
  assert.equal(rankCombinations({ members: TRIO }).count, 8);
});

test('extra shows what each person pays above their own cheapest flight', () => {
  const { closest } = rankCombinations({ members: TRIO });
  assert.deepEqual(closest.picks.map((p) => p.extra), [600, 600, 700]); // G1 vs G2, C1 vs C2, K1 vs K2
});

test('a member who has already chosen is fixed', () => {
  const members = [GAUDI, { ...CLARA, fixedFlightId: 'C2' }, KABE];
  const { cheapest, closest, balanced } = rankCombinations({ members });
  [cheapest, closest, balanced].forEach((option) => assert.equal(option.picks[1].flightId, 'C2'));
  assert.deepEqual(ids(closest), ['G2', 'C2', 'K2']); // the others move towards 20:30
});

test('a fixed member keeps their own price and has no extra', () => {
  const clara = { userId: 'clara', fixedFlightId: 'CB', flights: [flight('CA', 3000, '14:00'), flight('CB', 9000, '14:30')] };
  const r = rankCombinations({ members: [clara, KABE] });
  assert.equal(r.cheapest.picks[0].price, 9000);
  assert.equal(r.cheapest.picks[0].extra, 0);
});

test('one member alone: spread is zero and the cheapest flight wins everything', () => {
  const r = rankCombinations({ members: [CLARA] });
  assert.equal(r.cheapest.spreadMinutes, 0);
  assert.deepEqual(r.featured.map((f) => f.labels), [['cheapest', 'closest', 'balanced']]);
  assert.deepEqual(ids(r.cheapest), ['C2']);
});

test('no members, or a member with no flights: nothing to suggest', () => {
  assert.deepEqual(rankCombinations({ members: [] }), { cheapest: null, closest: null, balanced: null, featured: [], others: [], count: 0 });
  assert.equal(rankCombinations({ members: [GAUDI, { userId: 'x', flights: [] }] }).cheapest, null);
});

test('overnight landings use full timestamps', () => {
  const late = { userId: 'a', flights: [{ id: 'A', price: 1, instant: instantOf('2026-11-21', '23:55', 'HND') }] };
  const early = { userId: 'b', flights: [{ id: 'B', price: 1, instant: instantOf('2026-11-22', '00:25', 'HND') }] };
  assert.equal(rankCombinations({ members: [late, early] }).closest.spreadMinutes, 30);
});

test('featured: a combination that wins two rules appears once with both labels', () => {
  const { featured } = rankCombinations({ members: TRIO });
  assert.deepEqual(featured.map((f) => f.labels), [['cheapest'], ['closest', 'balanced']]);
});

test('others: everything not featured, best balance first, nothing twice', () => {
  const r = rankCombinations({ members: TRIO });
  assert.equal(r.others.length, 8 - 2); // 8 combinations, 2 featured cards
  assert.deepEqual(ids(r.others[0]), ['G2', 'C1', 'K2']); // 15,200 and 2h55: the best of the rest
  assert.deepEqual(ids(r.others.at(-1)), ['G1', 'C2', 'K1']); // 15,900 and 6h45: the worst
  const keys = [...r.featured.map((f) => f.option), ...r.others].map((o) => ids(o).join());
  assert.equal(new Set(keys).size, keys.length);
});

test('others respects its limit', () => {
  assert.equal(rankCombinations({ members: TRIO, othersLimit: 2 }).others.length, 2);
});

test('with every member fixed there is one combination and nothing else', () => {
  const members = [{ ...GAUDI, fixedFlightId: 'G1' }, { ...CLARA, fixedFlightId: 'C1' }, { ...KABE, fixedFlightId: 'K1' }];
  const r = rankCombinations({ members });
  assert.equal(r.count, 1);
  assert.equal(r.featured.length, 1);
  assert.deepEqual(r.others, []);
});

test('the same data always gives the same answer', () => {
  assert.deepEqual(rankCombinations({ members: TRIO }), rankCombinations({ members: TRIO }));
});
