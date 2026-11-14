import assert from 'node:assert/strict';
import test from 'node:test';
import { makeItineraryDraft } from '../api/shared/itineraryDraft.js';
import { withPersonalChanges } from '../api/shared/personalItinerary.js';
import { clockOf } from './itinerary.js';

const date = '2026-11-22';
const makeStop = (id, start, end, rest) => ({
  id, kind: 'place', name: id, slot: 'Morning', start, end, minutes: end - start,
  cost: 0, startTime: clockOf(start), endTime: clockOf(end), ...rest,
});
const museum = { id: 'museum', name: 'Museum', open: '09:30', close: '17:00' };

function context() {
  return {
    group: {
      selections: {},
      itinerary: {
        days: [{ date, stopIds: ['temple', 'lunch'] }],
        stops: { temple: makeStop('temple', 540, 600), lunch: makeStop('lunch', 660, 720) },
        transfers: { between: {}, fallbackMinutes: 15 },
      },
    },
    userId: 'viewer', dates: [date], personalRows: [], people: {},
  };
}

test('adds and reorders a personal museum visit with its custom duration in one draft', () => {
  const ctx = context();
  const draft = makeItineraryDraft(ctx, { scope: 'personal', operations: [
    { type: 'add', id: 'new-museum', date, placeId: 'museum', minutes: 90, start: '13:30' },
    { type: 'move', id: 'new-museum', date, target: 'lunch' },
  ] }, [museum]);
  assert.deepEqual(draft.issues, []);
  assert.deepEqual(ctx.group.itinerary.days[0].stopIds, ['temple', 'lunch']);
  const effective = withPersonalChanges(ctx.group.itinerary, draft.overrides);
  assert.deepEqual(effective.days[0].stopIds, ['temple', 'new-museum', 'lunch']);
  assert.equal(effective.stops['new-museum'].startTime, '10:15');
  assert.equal(effective.stops['new-museum'].minutes, 90);
  assert.equal(effective.stops.lunch.startTime, '12:00');
  assert.equal(effective.stops.lunch.myChange, true);
});

test('flags shared changes that clash with a saved personal activity', () => {
  const ctx = context();
  const stop = makeStop('personal', 675, 750, { name: 'Personal museum visit' });
  ctx.personalRows.push({ user_id: 'another', changes: { [date]: { personal: { name: stop.name, stop } } } });
  ctx.people.another = { name: 'Clara' };
  const draft = makeItineraryDraft(ctx, { scope: 'group', operations: [
    { type: 'duration', id: 'lunch', date, minutes: 90 },
  ] }, []);
  assert(draft.issues.some(({ name, reason }) => name === 'lunch' && reason.includes('Clara')));
});

test('reports opening-hours and fixed-booking conflicts without moving the booking', () => {
  const ctx = context();
  ctx.group.itinerary.stops.lunch.booked = true;
  const draft = makeItineraryDraft(ctx, { scope: 'personal', operations: [
    { type: 'add', id: 'new-museum', date, placeId: 'museum', minutes: 120, start: '16:00' },
    { type: 'duration', id: 'temple', date, minutes: 120 },
  ] }, [museum]);
  assert(draft.issues.some(({ name, reason }) => name === 'Museum' && reason.includes('opening hours')));
  assert(draft.issues.some(({ id, reason }) => id === 'temple' && reason.includes('booked commitment')));
  assert.equal(draft.plan.stops.lunch.startTime, '11:00');
});

test('reordering keeps a 90-minute visit and offers one exact transfer fix', () => {
  const ctx = context();
  ctx.group.itinerary.stops.temple = makeStop('temple', 600, 660);
  ctx.group.itinerary.stops.lunch = makeStop('lunch', 720, 780);
  ctx.group.itinerary.transfers.between.temple = { museum: 25 };
  const operations = [
    { type: 'add', id: 'visit', date, placeId: 'museum', minutes: 90, start: '13:30' },
    { type: 'move', id: 'visit', date, target: 'lunch', reviewTime: true },
  ];
  const draft = makeItineraryDraft(ctx, { scope: 'personal', operations }, [museum]);
  assert.deepEqual(draft.issues.map(({ id, suggestedStart }) => [id, suggestedStart]), [['visit', '11:25']]);
  assert.match(draft.issues[0].reason, /11:00 AM.*25 minutes/);
  const fixed = makeItineraryDraft(ctx, { scope: 'personal', operations: [
    ...operations, { type: 'time', id: 'visit', date, start: '11:25' },
  ] }, [museum]);
  assert.equal(fixed.issues.length, 0);
  assert.equal(fixed.plan.stops.visit.minutes, 90);
  assert.equal(fixed.plan.stops.lunch.startTime, '13:10');
});

test('suggests an earlier full visit before the flight buffer and another day when needed', () => {
  const ctx = context();
  const departureDay = '2026-11-23';
  ctx.dates.push(departureDay);
  ctx.group.itinerary.days.push({ date: departureDay, stopIds: [] });
  ctx.group.selections.viewer = { return: { date: departureDay, from: 'HND', to: 'HKG', departTime: '15:30', arriveTime: '19:30' } };
  const add = { type: 'add', id: 'visit', date: departureDay, placeId: 'museum', minutes: 90, start: '11:30' };
  const earlier = makeItineraryDraft(ctx, { scope: 'personal', operations: [add] }, [museum]);
  assert.equal(earlier.issues[0].suggestedStart, '11:00');
  assert.equal(earlier.issues[0].reorder, true);
  const applied = makeItineraryDraft(ctx, { scope: 'personal', operations: [
    add, { type: 'time', id: 'visit', date: departureDay, start: '11:00', reorder: true },
  ] }, [museum]);
  assert.equal(applied.issues.length, 0);
  assert.equal(applied.plan.stops.visit.endTime, '12:30');

  const longVisit = { ...add, minutes: 240 };
  const anotherDay = makeItineraryDraft(ctx, { scope: 'personal', operations: [longVisit] }, [museum]);
  assert.deepEqual(anotherDay.issues[0].alternativeDays, [{ date, start: '12:15' }]);
  const relocated = makeItineraryDraft(ctx, { scope: 'personal', operations: [
    longVisit, { type: 'time', id: 'visit', date: departureDay, start: '12:15', targetDate: date, newId: 'visit-other-day' },
  ] }, [museum]);
  assert.equal(relocated.issues.length, 0);
  const saved = withPersonalChanges(ctx.group.itinerary, relocated.overrides);
  assert(saved.days[0].stopIds.includes('visit-other-day'));
  assert.equal(saved.days[1].stopIds.length, 0);
});
