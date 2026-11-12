import assert from 'node:assert/strict';
import test from 'node:test';
import { assemble } from '../api/shared/itineraryData.js';
import { retimeResearchedPlan } from '../api/shared/itineraryEdits.js';
import { applyItineraryEdit } from '../api/shared/itineraryResponses.js';

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

test('an older shared plan keeps its saved suggested stop when reordered', () => {
  const plan = {
    free: { freeFrom: 540, freeUntil: null },
    days: [{ date, stopIds: ['suggested-ramen', 'place-food'] }],
    stops: {
      'suggested-ramen': { id: 'suggested-ramen', kind: 'place', suggestedId: 'ramen', minutes: 60, name: 'Neighbourhood ramen' },
      'place-food': { id: 'place-food', kind: 'place', placeId: 'food', minutes: 90 },
    },
    maybe: [],
  };

  applyItineraryEdit(plan, { days: [{ date, stopIds: ['place-food', 'suggested-ramen'] }] });

  const { days } = assemble({ plan, votes: {}, dates: [date] });
  const stops = days[0].items.filter((stop) => stop.kind === 'place');
  assert.deepEqual(stops.map((stop) => [stop.id, stop.startTime]), [['place-food', '09:00'], ['suggested-ramen', '11:00']]);
  assert.equal(stops[1].name, 'Neighbourhood ramen');
  assert.equal(stops[1].travelBefore.minutes, 20);
});
