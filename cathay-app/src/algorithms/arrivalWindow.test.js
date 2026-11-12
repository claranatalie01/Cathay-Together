// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instantOf, legInstants, localOf, meetingInstant, spreadMinutes, windowTiming } from './arrivalWindow.js';

const tokyo = (date, clock) => instantOf(date, clock, 'HND');

test('the same moment in two time zones is one instant', () => {
  // 13:00 in Hong Kong is 14:00 in Tokyo.
  assert.equal(instantOf('2026-11-21', '13:00', 'HKG'), instantOf('2026-11-21', '14:00', 'HND'));
});

test('an instant converts back to the local date and clock', () => {
  assert.deepEqual(localOf(tokyo('2026-11-22', '00:25'), 'HND'), { date: '2026-11-22', clock: '00:25' });
  assert.deepEqual(localOf(tokyo('2026-11-22', '00:25'), 'SIN'), { date: '2026-11-21', clock: '23:25' });
});

test('overnight: 23:55 and 00:25 the next day are 30 minutes apart', () => {
  assert.equal(spreadMinutes([tokyo('2026-11-21', '23:55'), tokyo('2026-11-22', '00:25')]), 30);
});

test('spread is latest minus earliest, whatever the order', () => {
  const times = [tokyo('2026-11-21', '16:10'), tokyo('2026-11-21', '13:45'), tokyo('2026-11-21', '15:15')];
  assert.equal(spreadMinutes(times), 145);
  assert.equal(spreadMinutes([times[0]]), 0);
  assert.equal(spreadMinutes([]), 0);
});

test('a flight inside the window is "within"; the edge counts as inside', () => {
  const others = [tokyo('2026-11-21', '13:45')];
  assert.equal(windowTiming({ candidate: tokyo('2026-11-21', '14:45'), others, windowHours: 1 }).within, true);
  const late = windowTiming({ candidate: tokyo('2026-11-21', '14:46'), others, windowHours: 1 });
  assert.deepEqual(late, { spreadMinutes: 61, within: false, bucket: '15m', overshootMinutes: 1 });
});

test('a wider window accepts the same flight', () => {
  const others = [tokyo('2026-11-21', '13:45')];
  const candidate = tokyo('2026-11-21', '16:10');
  assert.equal(windowTiming({ candidate, others, windowHours: 2 }).within, false);
  assert.equal(windowTiming({ candidate, others, windowHours: 3 }).within, true);
});

test('overshoot buckets', () => {
  const others = [tokyo('2026-11-21', '12:00')];
  const bucket = (clock) => windowTiming({ candidate: tokyo('2026-11-21', clock), others, windowHours: 1 }).bucket;
  assert.deepEqual(['13:00', '13:15', '13:30', '14:00', '15:00', '15:01'].map(bucket), ['within', '15m', '30m', '1h', '2h', 'more']);
});

test('the window is measured across the whole group, not just the nearest person', () => {
  // Others land at 12:00 and 13:00. Landing at 12:30 keeps the spread at 60 minutes.
  // Landing at 13:30 is only 30 minutes after one of them, but 90 after the other.
  const others = [tokyo('2026-11-21', '12:00'), tokyo('2026-11-21', '13:00')];
  assert.equal(windowTiming({ candidate: tokyo('2026-11-21', '12:30'), others, windowHours: 1 }).within, true);
  assert.equal(windowTiming({ candidate: tokyo('2026-11-21', '13:30'), others, windowHours: 1 }).within, false);
});

test('nobody else has chosen: nothing to compare', () => {
  assert.equal(windowTiming({ candidate: tokyo('2026-11-21', '12:00'), others: [], windowHours: 1 }), null);
});

test('a leg saved without instants: the landing after midnight is the next day', () => {
  // Singapore 16:30 to Tokyo 00:25: 6 h 55 min in the air, one hour of time difference.
  const leg = { date: '2026-11-21', from: 'SIN', to: 'HND', departTime: '16:30', arriveTime: '00:25' };
  const { departAt, arriveAt } = legInstants(leg);
  assert.equal((arriveAt - departAt) / 60000, 415);
  assert.equal(meetingInstant(leg, 'outbound'), tokyo('2026-11-22', '00:25'));
  assert.equal(meetingInstant(leg, 'return'), departAt);
});

test('the demo case: Hong Kong lands 23:55, Singapore lands 00:25, 30 minutes apart', () => {
  const hkg = { date: '2026-11-21', from: 'HKG', to: 'HND', departTime: '19:05', arriveTime: '23:55' };
  const sin = { date: '2026-11-21', from: 'SIN', to: 'HND', departTime: '16:30', arriveTime: '00:25' };
  const timing = windowTiming({ candidate: meetingInstant(sin, 'outbound'), others: [meetingInstant(hkg, 'outbound')], windowHours: 1 });
  assert.equal(timing.spreadMinutes, 30);
  assert.equal(timing.within, true);
});
