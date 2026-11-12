import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockOf, minutesOf, retimeDay } from './itinerary.js';

test('reordering a day keeps the order and re-times it without overlaps', () => {
  const items = [
    { id: 'shops', kind: 'voted', minutes: 120, open: minutesOf('11:00') },
    { id: 'temple', kind: 'voted', minutes: 120, open: minutesOf('09:00') },
  ];
  const timed = retimeDay({ day: 1, items });
  assert.deepEqual(timed.map((s) => [s.id, clockOf(s.start), clockOf(s.end)]), [['shops', '11:00', '13:00'], ['temple', '13:30', '15:30']]);
});

test('retimeDay uses the travel time between the stops it packs', () => {
  const items = [
    { id: 'a', kind: 'voted', minutes: 60, open: minutesOf('09:00') },
    { id: 'b', kind: 'voted', minutes: 60, open: minutesOf('09:00') },
  ];
  const [first, second] = retimeDay({ day: 0, items, travel: () => 45 });
  assert.equal(second.start - first.end >= 45, true);
});
