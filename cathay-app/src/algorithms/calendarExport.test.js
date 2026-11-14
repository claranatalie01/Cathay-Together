import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarExportFor } from './calendarExport.js';
import { withPersonalChanges } from '../api/shared/personalItinerary.js';

const stop = (id, name, startTime, endTime, details = {}) => ({
  id, name, kind: 'place', slot: 'Morning', cost: 0, minutes: 60,
  startTime, endTime, ...details,
});

test('exports the traveller’s effective activities across days in destination time', () => {
  const group = { id: 'tokyo-trip', destination: 'Tokyo, Japan' };
  const date = '2026-11-21';
  const secondDate = '2026-11-22';
  const plan = {
    days: [
      { date, stopIds: ['tower', 'garden', 'lunch'] },
      { date: secondDate, stopIds: ['late', 'untimed'] },
    ],
    stops: {
      tower: stop('tower', 'Tokyo Tower', '08:00', '09:00', { start: 480, end: 540 }),
      garden: stop('garden', 'Garden', '09:00', '10:00', { start: 540, end: 600 }),
      lunch: stop('lunch', 'Lunch', '12:00', '13:00'),
      late: stop('late', 'Night market', '23:30', '00:30'),
      untimed: stop('untimed', 'Activity without a time'),
    },
  };
  const personal = withPersonalChanges(plan, {
    [date]: {
      tower: {
        name: 'Tokyo Tower',
        stop: stop('tower', 'Disney', '08:00', '10:00', { start: 480, end: 600, area: 'Maihama' }),
      },
    },
  });
  const days = personal.days.map((day) => ({
    date: day.date,
    items: [{ id: 'flight', kind: 'flight-arrival' }, ...day.stopIds.map((id) => personal.stops[id])],
  }));

  const { events, unscheduled } = calendarExportFor({ group, days });
  assert.deepEqual(events.map(({ event }) => event.summary), ['Disney', 'Lunch', 'Night market']);
  assert.deepEqual(events[0].event, {
    summary: 'Disney',
    start: { dateTime: '2026-11-21T08:00:00', timeZone: 'Asia/Tokyo' },
    end: { dateTime: '2026-11-21T10:00:00', timeZone: 'Asia/Tokyo' },
    location: 'Maihama',
  });
  assert.deepEqual(events[2].event.end, { dateTime: '2026-11-23T00:30:00', timeZone: 'Asia/Tokyo' });
  assert.equal(unscheduled, 1);
});
