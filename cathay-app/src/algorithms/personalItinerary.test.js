import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itineraryTimeline, personalChangesFor, withPersonalChanges } from '../api/shared/personalItinerary.js';
import { clockOf } from './itinerary.js';

const date = '2026-11-22';
function stop(id, name, start, end) {
  return { id, name, kind: 'place', cost: 0, slot: 'Afternoon', start, end, minutes: end - start, startTime: clockOf(start), endTime: clockOf(end) };
}

test('a personal stop survives replacement and removal of its shared counterpart', () => {
  const group = {
    days: [{ date, stopIds: ['afternoon', 'dinner'] }],
    stops: { afternoon: stop('afternoon', 'Tokyo Tower', 840, 930), dinner: stop('dinner', 'Dinner', 1080, 1140) },
  };
  const edited = structuredClone(group);
  edited.stops.afternoon.name = 'Tokyo National Museum';
  const changes = personalChangesFor({}, group, edited, date);
  group.stops.afternoon.name = 'Hama-rikyū Gardens';
  assert.equal(withPersonalChanges(group, changes).stops.afternoon.name, 'Tokyo National Museum');
  group.days[0].stopIds.shift();
  delete group.stops.afternoon;
  assert.deepEqual(withPersonalChanges(group, changes).days[0].stopIds, ['afternoon', 'dinner']);
  assert.equal(withPersonalChanges(group, changes).stops.afternoon.myChange, true);

  const [timeline] = itineraryTimeline(group, { gaudi: { id: 'gaudi', name: 'Gaudi' }, clara: { id: 'clara', name: 'Clara' } }, [{ user_id: 'gaudi', changes }], 'gaudi');
  assert.deepEqual(timeline.groupStops.map(({ name }) => name), ['Dinner']);
  assert.deepEqual(timeline.members.find(({ id }) => id === 'clara').events, []);
  const gaudi = timeline.members.find(({ id }) => id === 'gaudi');
  assert.deepEqual(gaudi.events.map(({ name, start }) => [name, start]), [['Tokyo National Museum', 840]]);
  assert.deepEqual(gaudi.rejoins, [1080]);
});
