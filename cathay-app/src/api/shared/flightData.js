// Flight catalogue for the demo. Each member sees their own flights to the group's destination,
// from their own home airport. REAL: the Cathay Pacific and HK Express flight numbers and times, from
// the saved OAG snapshot (see realFlights.js). FICTIONAL: every price and the seats left, in HKD.
import { meetingInstant, spreadMinutes } from '../../algorithms/arrivalWindow.js';
import { rankCombinations } from '../../algorithms/combinations.js';
import { realJourneys } from './realFlights.js';

export const DESTINATION_AIRPORT = { code: 'HND', city: 'Tokyo' };

// Price factor by home airport, used for the cabin upgrade amounts only (invented numbers).
const HOME_AIRPORTS = {
  HKG: { price: 1 },
  SHA: { price: 0.86 },
  PVG: { price: 0.88 },
  SIN: { price: 1.38 },
  TPE: { price: 0.82 },
  ICN: { price: 0.9 },
  MNL: { price: 1.05 },
  BKK: { price: 1.25 },
  KUL: { price: 1.35 },
  CAN: { price: 0.95 },
};

const CABINS = [
  { id: 'economy', label: 'Economy', delta: 0 },
  { id: 'premium', label: 'Premium Economy', delta: 8931 },
  { id: 'business', label: 'Business', delta: 13101 },
];

// Price factor per day (earlier and later days cost more or less).
const DAY_FACTOR = { '2026-11-20': 1.12, '2026-11-21': 1, '2026-11-22': 1.06, '2026-11-23': 1.03, '2026-11-24': 0.97 };

export const OUTBOUND_DATES = ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
export const RETURN_DATES = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25'];
const UNAVAILABLE = new Set(['2026-11-19', '2026-11-25']);

export const isAvailable = (date) => !UNAVAILABLE.has(date);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(date) {
  const d = new Date(`${date}T12:00:00Z`);
  return { day: DAYS[d.getUTCDay()], d: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear() };
}

export const tabLabel = (date) => {
  const { day, d, month } = parts(date);
  return `${day}, ${d} ${month}`;
};
export const dayLabel = (date) => {
  const { day, d, month } = parts(date);
  return `${day} ${d} ${month}`;
};
export const longLabel = (date) => {
  const { day, d, month, year } = parts(date);
  return `${day} ${d} ${month} ${year}`;
};
export const shortRange = (from, to) => {
  const a = parts(from);
  const b = parts(to);
  return `(${a.day}) ${a.d} ${a.month} - (${b.day}) ${b.d} ${b.month}`;
};

const homeFactor = (code) => HOME_AIRPORTS[code]?.price ?? 1;

export function cabinsFor(homeCode) {
  const factor = homeFactor(homeCode);
  return CABINS.map((cabin) => ({ ...cabin, delta: Math.round(cabin.delta * factor) }));
}

// Flights for one direction and day, in the given cabin. `home` is the traveller's airport.
// From Hong Kong these are direct flights; from anywhere else each result is two flights joined in
// Hong Kong. Premium economy and business are Cathay Pacific only.
export function flightsFor({ home, direction, date, cabin }) {
  const delta = cabinsFor(home.code).find((c) => c.id === cabin)?.delta ?? 0;
  const flights = realJourneys({
    homeCode: home.code,
    direction,
    date,
    dayFactor: DAY_FACTOR[date] ?? 1,
    cabinOnlyCx: cabin !== 'economy',
    destinationCode: DESTINATION_AIRPORT.code,
  }).map((f) => ({ ...f, priceFrom: f.economyPrice + delta }));
  if (flights.length) {
    const cheapest = flights.reduce((min, f) => (f.economyPrice < min.economyPrice ? f : min), flights[0]);
    cheapest.lowest = true;
  }
  return flights.sort((a, b) => a.departAt.localeCompare(b.departAt));
}

export function lowestEconomy({ home, direction, date }) {
  if (!isAvailable(date)) return null;
  const prices = flightsFor({ home, direction, date, cabin: 'economy' }).map((f) => f.economyPrice);
  return prices.length ? Math.min(...prices) : null;
}

// ---- Fares ---------------------------------------------------------------------------------
// Three fare types per flight. Light is the flight's own price; Essential and Flex add to it.
// Fictional rules for the demo, shaped like the real app's fare screen.
const FARE_STEP = { essential: 450, flex: 1150 };

const FARE_RULES = {
  light: { name: 'Light', tagline: 'Good value', seat: 'For a fee', baggage: '1x23kg', changeFee: 1200, cancelFee: 1400, miles: 800, points: 8, seatSelect: false, milesUpgrade: false },
  essential: { name: 'Essential', tagline: null, recommended: true, seat: 'Free (Regular seats)', baggage: '2x23kg', changeFee: 1000, cancelFee: 1200, miles: 1500, points: 15, seatSelect: true, milesUpgrade: true },
  flex: { name: 'Flex', tagline: null, seat: 'Free (Preferred seats)', baggage: '2x23kg', changeFee: 0, cancelFee: 600, miles: 2200, points: 22, seatSelect: true, milesUpgrade: true },
};

const FARE_IDS = Object.keys(FARE_RULES);

export function faresFor(flight) {
  const light = flight.priceFrom;
  const prices = { light, essential: light + FARE_STEP.essential, flex: light + FARE_STEP.essential + FARE_STEP.flex };
  return FARE_IDS.map((id) => {
    const rule = FARE_RULES[id];
    return {
      id,
      name: rule.name,
      tagline: rule.tagline ?? null,
      recommended: Boolean(rule.recommended),
      price: prices[id],
      rows: { seat: rule.seat, baggage: rule.baggage, changeFee: rule.changeFee, cancelFee: rule.cancelFee },
    };
  });
}

// Rows of the "compare fare types" table. Booleans render as a tick or a cross.
export function comparison() {
  const pick = (key) => Object.fromEntries(FARE_IDS.map((id) => [id, FARE_RULES[id][key]]));
  const money = (key) => Object.fromEntries(FARE_IDS.map((id) => [id, FARE_RULES[id][key]]));
  return [
    { group: 'Free seat select', rows: [{ label: 'Regular seat', values: pick('seatSelect') }] },
    { group: 'Baggage', rows: [{ label: 'Check-in', values: pick('baggage') }] },
    {
      group: 'Flexibility',
      rows: [
        { label: 'Flight change fee', values: money('changeFee') },
        { label: 'Cancellation Fee', values: money('cancelFee') },
      ],
    },
    {
      group: 'Rewards',
      rows: [
        { label: 'Asia Miles', values: pick('miles') },
        { label: 'Status Points', values: pick('points') },
        { label: 'Upgrade with Asia Miles', values: pick('milesUpgrade') },
      ],
    },
  ];
}

export function findFlight({ home, flightId }) {
  const match = /^(outbound|return)-(\d{4}-\d{2}-\d{2})-[A-Z0-9_]+$/.exec(flightId);
  if (!match) return null;
  const [, direction, date] = match;
  if (!isAvailable(date)) return null;
  return flightsFor({ home, direction, date, cabin: 'economy' }).find((f) => f.id === flightId) ?? null;
}

// ---- Group timing -----------------------------------------------------------------------------
// How far apart the group would land (outbound) or take off (return) if the viewer chose a
// flight, counting the other members' chosen flights. Members who have not chosen are left out.
// There is no window to set: closer is always better. The spread itself is calculated in
// src/algorithms/arrivalWindow.js.

// The other members' times for this direction: [{ userId, time, instant }]
export function othersTimes({ group, viewerId, direction }) {
  return group.members
    .filter((member) => member.userId !== viewerId)
    .map((member) => {
      const chosen = group.selections?.[member.userId]?.[direction];
      if (!chosen) return null;
      return { userId: member.userId, time: direction === 'outbound' ? chosen.arriveTime : chosen.departTime, instant: meetingInstant(chosen, direction) };
    })
    .filter(Boolean);
}

// Adds `timing` to each flight: { spreadMinutes, closest, deltaMinutes } against the others'
// chosen flights, or null when nobody else has chosen yet. `closest` marks the flight(s) with the
// smallest spread. `deltaMinutes` is set only when exactly one other member has chosen: how many
// minutes after (positive) or before (negative) that person this flight lands or leaves.
export function withTiming(flights, { direction, others }) {
  if (others.length === 0) return flights.map((flight) => ({ ...flight, timing: null }));
  const spreads = flights.map((flight) => spreadMinutes([meetingInstant(flight, direction), ...others.map((o) => o.instant)]));
  const smallest = Math.min(...spreads);
  const only = others.length === 1 ? others[0].instant : null;
  return flights.map((flight, i) => ({
    ...flight,
    timing: {
      spreadMinutes: spreads[i],
      closest: spreads[i] === smallest,
      deltaMinutes: only === null ? null : Math.round((meetingInstant(flight, direction) - only) / 60000),
    },
  }));
}

// ---- Group suggestions ---------------------------------------------------------------------------
// One flight per member in one direction, ranked (see src/algorithms/combinations.js).
//   members  [{ userId, name, home: { code, city }, chosen? }]  `chosen` is that member's saved
//            selection for this direction.
//   cabin    the cabin for everyone who has NOT chosen yet.
// There is no time window: see combinations.js for how "best of both" is decided.
// A member who has chosen is kept exactly as chosen: their own flight, date, cabin and fare
// price, whatever the cabin control says. Everyone else is placed from their own airport, in
// `cabin`, at the lowest fare of that cabin.
// Shown beside a suggested flight: whether the landing is on the day after take-off (outbound
// only; a return is shown by its take-off) and how many stops it has. A connection's flight
// number is two numbers joined by " + ".
const extrasOf = (flight, direction) => ({
  nextDay: direction === 'outbound' && Boolean(flight.arriveDate) && flight.arriveDate !== flight.date,
  stops: flight.flightNo.includes(' + ') ? 1 : 0,
  via: flight.via ?? null,
});

export function suggestionsFor({ members, direction, date, cabin = 'economy', othersLimit = 30 }) {
  const catalogue = members.map((member) => {
    if (member.chosen) {
      const c = member.chosen;
      const flight = { id: c.flightId, flightNo: c.flightNo, time: direction === 'outbound' ? c.arriveTime : c.departTime, price: c.price, cabinLabel: c.cabinLabel, ...extrasOf(c, direction) };
      return { member, flights: [flight], instants: { [c.flightId]: meetingInstant(c, direction) }, fixed: true };
    }
    const list = flightsFor({ home: member.home, direction, date, cabin });
    return {
      member,
      flights: list.map((f) => ({ id: f.id, flightNo: f.flightNo, time: direction === 'outbound' ? f.arriveTime : f.departTime, price: f.priceFrom, ...extrasOf(f, direction) })),
      instants: Object.fromEntries(list.map((f) => [f.id, meetingInstant(f, direction)])),
      fixed: false,
    };
  });
  const ranked = rankCombinations({
    othersLimit,
    members: catalogue.map(({ member, flights, instants, fixed }) => ({
      userId: member.userId,
      fixedFlightId: fixed ? flights[0].id : undefined,
      flights: flights.map((f) => ({ id: f.id, price: f.price, instant: instants[f.id] })),
    })),
  });
  const describe = (option) => ({
    total: option.total,
    spreadMinutes: option.spreadMinutes,
    picks: option.picks.map((p, i) => {
      const { member, flights, fixed } = catalogue[i];
      const f = flights.find((x) => x.id === p.flightId);
      return {
        userId: member.userId,
        name: member.name,
        airport: member.home,
        flightId: f.id,
        flightNo: f.flightNo,
        time: f.time,
        nextDay: f.nextDay,
        stops: f.stops,
        via: f.via,
        price: p.price,
        extra: p.extra,
        fixed,
        cabinLabel: f.cabinLabel ?? null,
      };
    }),
  });
  return {
    direction,
    date,
    cabin,
    combinations: ranked.count,
    featured: ranked.featured.map((f) => ({ labels: f.labels, ...describe(f.option) })),
    others: ranked.others.map(describe),
  };
}

// ---- Selections ---------------------------------------------------------------------------------
// One chosen flight and fare, as stored on a group and returned by the API.
export function makeSelection({ home, flightId, cabin, fare }) {
  const base = findFlight({ home, flightId });
  const cabinInfo = cabinsFor(home.code).find((c) => c.id === cabin);
  if (!base || !cabinInfo || !FARE_IDS.includes(fare)) return null;
  const flight = { ...base, priceFrom: base.economyPrice + cabinInfo.delta };
  const chosen = faresFor(flight).find((f) => f.id === fare);
  return {
    flightId: flight.id,
    cabin: cabinInfo.id,
    cabinLabel: cabinInfo.label,
    fare: chosen.id,
    fareName: chosen.name,
    price: chosen.price,
    from: flight.from,
    to: flight.to,
    date: flight.date,
    departTime: flight.departTime,
    arriveTime: flight.arriveTime,
    arriveDate: flight.arriveDate,
    departAt: flight.departAt,
    arriveAt: flight.arriveAt,
    flightNo: flight.flightNo,
    via: flight.via,
  };
}
