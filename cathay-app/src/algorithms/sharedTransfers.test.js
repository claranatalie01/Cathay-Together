import assert from 'node:assert/strict';
import test from 'node:test';
import { assemble } from '../api/mock/itineraryData.js';
import { retimeResearchedPlan } from '../api/shared/itineraryEdits.js';

const date = '2026-11-21';
const place = (id, start) => ({ id, kind: 'place', placeId: id, start, end: start + 30, minutes: 30 });
const freeTime = (start) => ({ ...place('free', start), placeId: undefined, suggestedId: 'free' });
const transfers = { fallbackMinutes: 30, between: { a: { b: 35 }, b: { a: 35 } } };

test('shared itinerary displays the saved estimate after a free block and excludes flight estimates', () => {
  const plan = {
    builtBy: 'ai',
    transfers,
    days: [{ date, stopIds: ['a', 'free', 'b', 'meal'] }],
    stops: { a: place('a', 540), free: freeTime(600), b: place('b', 665), meal: { ...place('meal', 725), placeId: undefined } },
    maybe: [],
  };
  const selection = { outbound: { arriveTime: '06:00' } };
  const { days } = assemble({ plan, selection, votes: {}, dates: [date] });
  assert.deepEqual(days[0].items.map((item) => item.travelBefore?.minutes ?? null), [null, null, null, 35, 30]);
  assert.equal(days[0].totals.travelMinutes, 65);
});

test('shared edits keep the saved 35-minute estimate when reordering around free time', () => {
  const plan = {
    transfers,
    days: [{ date, stopIds: ['a', 'free', 'b'] }],
    stops: { a: place('a', 540), free: freeTime(600), b: place('b', 665) },
  };
  retimeResearchedPlan(plan, [{ date, stopIds: ['b', 'free', 'a'] }], [], {});
  assert.equal(plan.stops.a.start - plan.stops.free.end, 35);
});

test('removing a stop rechecks the newly adjacent pair before saving', () => {
  const plan = {
    transfers: { fallbackMinutes: 30, between: { a: { b: 100 }, b: { a: 100 } } },
    days: [{ date, stopIds: ['a', 'meal', 'b'] }],
    stops: { a: place('a', 540), meal: place('meal', 600), b: place('b', 660) },
  };
  retimeResearchedPlan(plan, [{ date, stopIds: ['a', 'b'] }], [], {});
  assert.equal(plan.stops.b.start - plan.stops.a.end, 100);
});
