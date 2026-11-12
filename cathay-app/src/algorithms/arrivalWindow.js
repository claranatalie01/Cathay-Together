// Arrival window: how far apart do the group's flights land (outbound) or take off (return)?
//
// The rule
//   1. Turn every flight time into an "instant": one exact moment, the same everywhere in the
//      world. A clock time alone is not enough: 23:55 and 00:25 the next day are 30 minutes
//      apart, not 23.5 hours, and 13:00 in Hong Kong is 14:00 in Tokyo.
//   2. Spread = latest instant - earliest instant.
//   3. A flight is "within the window" when the spread, with that flight included, is no
//      longer than the window the group chose (1 to 6 hours).
//
// Pure functions: no browser, no storage, no network. That is what makes them testable
// (see arrivalWindow.test.js) and lets a server run the same file.

// Hours ahead of UTC. None of these places changes its clocks during the year.
export const UTC_OFFSET_HOURS = { HKG: 8, SHA: 8, PVG: 8, SIN: 8, TPE: 8, MNL: 8, KUL: 8, CAN: 8, BKK: 7, ICN: 9, HND: 9 };

const MINUTE = 60000;

// The instant (milliseconds since 1970, UTC) of a local date and clock time at an airport.
// instantOf('2026-11-21', '13:45', 'HND') is 13:45 Tokyo time on 21 November.
export function instantOf(date, clock, airportCode) {
  const offset = UTC_OFFSET_HOURS[airportCode];
  if (offset === undefined) throw new Error(`Unknown airport ${airportCode}`);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - offset * 60 * MINUTE;
}

// The local date and clock time of an instant at an airport: { date: 'YYYY-MM-DD', clock: 'HH:MM' }.
export function localOf(instant, airportCode) {
  const iso = new Date(instant + UTC_OFFSET_HOURS[airportCode] * 60 * MINUTE).toISOString();
  return { date: iso.slice(0, 10), clock: iso.slice(11, 16) };
}

// Departure and arrival instants of one flight leg.
// Uses the stored instants when present. Older saved data has only the departure date and two
// clock times, so the arrival is worked out: it is the first time that clock shows at the
// destination after take-off.
export function legInstants(leg) {
  if (leg.departAt && leg.arriveAt) return { departAt: Date.parse(leg.departAt), arriveAt: Date.parse(leg.arriveAt) };
  const departAt = instantOf(leg.date, leg.departTime, leg.from);
  let arriveAt = instantOf(leg.date, leg.arriveTime, leg.to);
  while (arriveAt <= departAt) arriveAt += 24 * 60 * MINUTE;
  return { departAt, arriveAt };
}

// The moment that matters for meeting up: landing on the way out, take-off on the way home.
export function meetingInstant(leg, direction) {
  const { departAt, arriveAt } = legInstants(leg);
  return direction === 'outbound' ? arriveAt : departAt;
}

// Minutes between the earliest and the latest instant. One instant or none: 0.
export function spreadMinutes(instants) {
  if (instants.length < 2) return 0;
  return Math.round((Math.max(...instants) - Math.min(...instants)) / MINUTE);
}

// Overshoot labels, smallest first: how far past the window a flight is.
const BUCKETS = [
  { id: '15m', max: 15 },
  { id: '30m', max: 30 },
  { id: '1h', max: 60 },
  { id: '2h', max: 120 },
  { id: 'more', max: Infinity },
];

// Would this flight keep the group inside its window?
//   candidate   instant of the flight being considered
//   others      instants of the other members' chosen flights
//   windowHours the group's window
// Returns null when nobody else has chosen yet (there is nothing to compare with).
export function windowTiming({ candidate, others, windowHours }) {
  if (others.length === 0) return null;
  const spread = spreadMinutes([candidate, ...others]);
  const overshoot = spread - windowHours * 60;
  return {
    spreadMinutes: spread,
    within: overshoot <= 0,
    bucket: overshoot <= 0 ? 'within' : BUCKETS.find((b) => overshoot <= b.max).id,
    overshootMinutes: Math.max(0, overshoot),
  };
}
