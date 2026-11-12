// Run with: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MAX_LAYOVER, MIN_LAYOVER, buildJourneys } from './connections.js';

// A tiny flight list. Hong Kong is UTC+8, Singapore UTC+8, Tokyo UTC+9.
const flight = (flightNo, from, to, departLocal, arriveLocal, utcOffsetDepart, utcOffsetArrive) => {
  const iso = (local, offset) => new Date(Date.parse(`${local}:00Z`) - offset * 3600000).toISOString();
  const departAt = iso(departLocal, utcOffsetDepart);
  const arriveAt = iso(arriveLocal, utcOffsetArrive);
  return { flightNo, carrier: flightNo.slice(0, 2), from, to, departLocal, arriveLocal, departAt, arriveAt, minutes: (Date.parse(arriveAt) - Date.parse(departAt)) / 60000 };
};
const FLIGHTS = [
  flight('CX714', 'SIN', 'HKG', '2026-11-21T01:25', '2026-11-21T05:20', 8, 8),
  flight('CX710', 'SIN', 'HKG', '2026-11-21T07:30', '2026-11-21T11:25', 8, 8),
  flight('CX716', 'SIN', 'HKG', '2026-11-21T18:00', '2026-11-21T22:00', 8, 8),
  flight('CX548', 'HKG', 'HND', '2026-11-21T08:55', '2026-11-21T13:45', 8, 9),
  flight('CX542', 'HKG', 'HND', '2026-11-21T16:30', '2026-11-21T21:15', 8, 9),
  flight('UO622', 'HKG', 'HND', '2026-11-21T17:55', '2026-11-21T22:45', 8, 9),
  flight('CX548', 'HKG', 'HND', '2026-11-22T08:55', '2026-11-22T13:45', 8, 9),
  flight('UO100', 'TPE', 'HKG', '2026-11-21T10:00', '2026-11-21T12:00', 8, 8),
];
const names = (journeys) => journeys.map((j) => j.segments.map((s) => s.flightNo).join('+'));

test('from Hong Kong only direct flights count, listed by departure', () => {
  const journeys = buildJourneys({ flights: FLIGHTS, from: 'HKG', to: 'HND', date: '2026-11-21' });
  assert.deepEqual(names(journeys), ['CX548', 'CX542', 'UO622']);
  assert.equal(journeys[0].layoverMinutes, null);
  assert.equal(journeys[0].minutes, 230); // 08:55 to 13:45 Tokyo time is 3h50 because Tokyo is an hour ahead
});

test('a connecting journey joins the first flight to the soonest fitting second flight', () => {
  const journeys = buildJourneys({ flights: FLIGHTS, from: 'SIN', to: 'HND', date: '2026-11-21' });
  // CX714 lands 05:20: the next Cathay flight is CX548 at 08:55 (3h35). CX710 lands 11:25: CX542 at 16:30 (5h05).
  assert.deepEqual(names(journeys), ['CX714+CX548', 'CX710+CX542']);
  assert.deepEqual(journeys.map((j) => j.layoverMinutes), [215, 305]);
});

test('the layover is counted between exact moments, door to door', () => {
  const [first] = buildJourneys({ flights: FLIGHTS, from: 'SIN', to: 'HND', date: '2026-11-21' });
  // Leaves 01:25 Singapore (17:25 UTC the day before), lands 13:45 Tokyo (04:45 UTC): 11h20.
  assert.equal(first.minutes, 680);
  assert.equal(first.departLocal, '2026-11-21T01:25');
  assert.equal(first.arriveLocal, '2026-11-21T13:45');
});

test('a journey stays on one airline: no Cathay flight joined to HK Express', () => {
  const journeys = buildJourneys({ flights: FLIGHTS, from: 'SIN', to: 'HND', date: '2026-11-21' });
  journeys.forEach((j) => assert.equal(j.carriers.length, 1));
  // CX716 lands 22:00: the only later Cathay flight is CX548 next morning, 10h55 away, so no journey.
  assert.ok(!names(journeys).some((n) => n.startsWith('CX716')));
  // UO100 from Taipei lands 12:00, and UO622 at 17:55 is 5h55 away: a same-airline connection.
  assert.deepEqual(names(buildJourneys({ flights: FLIGHTS, from: 'TPE', to: 'HND', date: '2026-11-21' })), ['UO100+UO622']);
});

test('the layover must be at least the minimum and at most the maximum', () => {
  assert.equal(MIN_LAYOVER, 90);
  assert.equal(MAX_LAYOVER, 480);
  const at = (second) => [
    flight('CX1', 'SIN', 'HKG', '2026-11-21T10:00', '2026-11-21T14:00', 8, 8), // lands 14:00
    second,
  ];
  const run = (second) => names(buildJourneys({ flights: at(second), from: 'SIN', to: 'HND', date: '2026-11-21' }));
  assert.deepEqual(run(flight('CX2', 'HKG', 'HND', '2026-11-21T15:20', '2026-11-21T20:00', 8, 9)), []); // 80 minutes: too short
  assert.deepEqual(run(flight('CX2', 'HKG', 'HND', '2026-11-21T15:30', '2026-11-21T20:10', 8, 9)), ['CX1+CX2']); // exactly 90: allowed
  assert.deepEqual(run(flight('CX2', 'HKG', 'HND', '2026-11-21T22:00', '2026-11-22T02:40', 8, 9)), ['CX1+CX2']); // exactly 8h: allowed
  assert.deepEqual(run(flight('CX2', 'HKG', 'HND', '2026-11-21T22:05', '2026-11-22T02:45', 8, 9)), []); // 8h05: too long
});

test('a late arrival can connect to a flight early the next day if the wait is short enough', () => {
  const late = [
    flight('CX9', 'SIN', 'HKG', '2026-11-21T22:00', '2026-11-22T02:00', 8, 8),
    flight('CX548', 'HKG', 'HND', '2026-11-22T08:55', '2026-11-22T13:45', 8, 9), // 6h55 after landing
  ];
  assert.deepEqual(names(buildJourneys({ flights: late, from: 'SIN', to: 'HND', date: '2026-11-21' })), ['CX9+CX548']);
});

test('the way back works the same: Tokyo to Hong Kong, then on', () => {
  const back = [
    flight('CX549', 'HND', 'HKG', '2026-11-24T15:00', '2026-11-24T19:05', 9, 8),
    flight('CX700', 'HKG', 'SIN', '2026-11-24T21:00', '2026-11-25T00:55', 8, 8),
    flight('CX702', 'HKG', 'SIN', '2026-11-24T19:30', '2026-11-24T23:25', 8, 8), // only 25 minutes: too short
  ];
  const journeys = buildJourneys({ flights: back, from: 'HND', to: 'SIN', date: '2026-11-24' });
  assert.deepEqual(names(journeys), ['CX549+CX700']);
  assert.equal(journeys[0].layoverMinutes, 115);
  assert.deepEqual(names(buildJourneys({ flights: back, from: 'HND', to: 'HKG', date: '2026-11-24' })), ['CX549']);
});

test('no flights on the day gives no journeys', () => {
  assert.deepEqual(buildJourneys({ flights: FLIGHTS, from: 'SIN', to: 'HND', date: '2026-11-30' }), []);
  assert.deepEqual(buildJourneys({ flights: [], from: 'HKG', to: 'HND', date: '2026-11-21' }), []);
});

test('the saved real snapshot gives the picker airports a journey on the trip days', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../data/oagSnapshot.json', import.meta.url), 'utf8'));
  // Shanghai Hongqiao (SHA) is left out on purpose: its one Cathay flight a day lands ten minutes
  // before the next Cathay flight to Tokyo, so it has no valid journey. Pudong (PVG) has many.
  const homes = ['HKG', 'PVG', 'SIN', 'TPE', 'ICN', 'MNL', 'BKK', 'KUL', 'CAN'];
  homes.forEach((home) => {
    const out = buildJourneys({ flights: snapshot.flights, from: home, to: 'HND', date: '2026-11-21' });
    const back = buildJourneys({ flights: snapshot.flights, from: 'HND', to: home, date: '2026-11-24' });
    assert.ok(out.length > 0, `${home} has no outbound journey on 21 Nov`);
    assert.ok(back.length > 0, `${home} has no return journey on 24 Nov`);
    [...out, ...back].forEach((j) => assert.ok(j.minutes > 0 && j.segments.length <= 2));
  });
});
