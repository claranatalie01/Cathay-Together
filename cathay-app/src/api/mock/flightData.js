// Fictional flight catalogue for the demo. Everything is generated from the traveller's home
// airport and the group's trip window, so each member sees their own flights to the group's
// destination. Prices are in HKD. Not real schedules or fares.
export const DESTINATION_AIRPORT = { code: 'HND', city: 'Tokyo' };

const HOME_AIRPORTS = {
  HKG: { minutes: 230, price: 1 },
  SHA: { minutes: 175, price: 0.86 },
  SIN: { minutes: 415, price: 1.38 },
};

const TIME_DIFF_MINUTES = 60; // Tokyo is one hour ahead of Hong Kong, Shanghai and Singapore.

const CABINS = [
  { id: 'economy', label: 'Economy', delta: 0 },
  { id: 'premium', label: 'Premium Economy', delta: 8931 },
  { id: 'business', label: 'Business', delta: 13101 },
];

const TEMPLATES = [
  { no: 548, dep: '08:55', base: 6691, seats: 9 },
  { no: 542, dep: '16:30', base: 5531, seats: null },
  { no: 6320, dep: '15:35', base: 10001, seats: 4, operatedBy: 'Japan Airlines' },
  { no: 500, dep: '11:20', base: 7340, seats: 6 },
  { no: 524, dep: '19:05', base: 6120, seats: null },
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

// "Nov 21–24, 2026" -> { start: '2026-11-21', end: '2026-11-24' }
export function windowOf(datesLabel) {
  const match = /^([A-Za-z]{3}) (\d+)[–-](\d+), (\d{4})$/.exec(datesLabel);
  if (!match) return { start: '2026-11-21', end: '2026-11-24' };
  const month = String(MONTHS.indexOf(match[1]) + 1).padStart(2, '0');
  const pad = (n) => String(n).padStart(2, '0');
  return { start: `${match[4]}-${month}-${pad(match[2])}`, end: `${match[4]}-${month}-${pad(match[3])}` };
}

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const toClock = (total) => {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};
const durationLabel = (minutes) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;

const homeFactor = (code) => HOME_AIRPORTS[code]?.price ?? 1;

export function cabinsFor(homeCode) {
  const factor = homeFactor(homeCode);
  return CABINS.map((cabin) => ({ ...cabin, delta: Math.round(cabin.delta * factor) }));
}

// Flights for one direction and day, in the given cabin. `home` is the traveller's airport.
export function flightsFor({ home, direction, date, cabin }) {
  const meta = HOME_AIRPORTS[home.code] ?? HOME_AIRPORTS.HKG;
  const delta = cabinsFor(home.code).find((c) => c.id === cabin)?.delta ?? 0;
  const outbound = direction === 'outbound';
  const from = outbound ? home.code : DESTINATION_AIRPORT.code;
  const to = outbound ? DESTINATION_AIRPORT.code : home.code;
  const flights = TEMPLATES.map((t) => {
    const price = Math.round(t.base * (DAY_FACTOR[date] ?? 1) * meta.price);
    const departs = toMinutes(t.dep);
    const arrives = departs + meta.minutes + (outbound ? TIME_DIFF_MINUTES : -TIME_DIFF_MINUTES);
    return {
      id: `${direction}-${date}-${t.no}`,
      flightNo: `CX${outbound ? t.no : t.no + 1}`,
      from,
      to,
      date,
      departTime: toClock(departs),
      arriveTime: toClock(arrives),
      duration: durationLabel(meta.minutes),
      operatedBy: t.operatedBy ?? null,
      seatsLeft: t.seats,
      lowest: false,
      economyPrice: price,
      priceFrom: price + delta,
    };
  }).sort((a, b) => a.departTime.localeCompare(b.departTime));
  const cheapest = flights.reduce((min, f) => (f.economyPrice < min.economyPrice ? f : min), flights[0]);
  cheapest.lowest = true;
  return flights;
}

export function lowestEconomy({ home, direction, date }) {
  if (!isAvailable(date)) return null;
  return Math.min(...flightsFor({ home, direction, date, cabin: 'economy' }).map((f) => f.economyPrice));
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

export const FARE_IDS = Object.keys(FARE_RULES);

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
  const match = /^(outbound|return)-(\d{4}-\d{2}-\d{2})-\d+$/.exec(flightId);
  if (!match) return null;
  const [, direction, date] = match;
  if (!isAvailable(date)) return null;
  return flightsFor({ home, direction, date, cabin: 'economy' }).find((f) => f.id === flightId) ?? null;
}

// ---- Group timing -----------------------------------------------------------------------------
// "Within 1h of everyone": how close a flight's landing (outbound) or take-off (return) is to the
// other members' chosen flights. Members who have not chosen yet are left out.
export const WINDOW_RANGE = { hours: 1, min: 1, max: 6, step: 1 };

export const clampWindow = (value) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return WINDOW_RANGE.hours;
  return Math.min(WINDOW_RANGE.max, Math.max(WINDOW_RANGE.min, n));
};

// The other members' times for this direction: [{ userId, name, minutes, time }]
export function othersTimes({ group, viewerId, direction }) {
  return group.members
    .filter((member) => member.userId !== viewerId)
    .map((member) => {
      const chosen = group.selections?.[member.userId]?.[direction];
      const time = chosen ? (direction === 'outbound' ? chosen.arriveTime : chosen.departTime) : null;
      return time ? { time, minutes: toMinutes(time) } : null;
    })
    .filter(Boolean);
}

// Overshoot bucket labels, smallest first.
const BUCKETS = [
  { id: '15m', max: 15 },
  { id: '30m', max: 30 },
  { id: '1h', max: 60 },
  { id: '2h', max: 120 },
  { id: 'more', max: Infinity },
];

// Adds `timing` to each flight: the spread between this flight and every other member's time
// (earliest to latest). Within the window when the spread fits; otherwise bucketed by overshoot.
export function withTiming(flights, { direction, others, windowHours }) {
  if (others.length === 0) return flights.map((flight) => ({ ...flight, timing: null }));
  return flights.map((flight) => {
    const minutes = toMinutes(direction === 'outbound' ? flight.arriveTime : flight.departTime);
    const all = [minutes, ...others.map((o) => o.minutes)];
    const spread = Math.max(...all) - Math.min(...all);
    const overshoot = spread - windowHours * 60;
    return {
      ...flight,
      timing: {
        within: overshoot <= 0,
        bucket: overshoot <= 0 ? 'within' : BUCKETS.find((b) => overshoot <= b.max).id,
        overshootMinutes: Math.max(0, overshoot),
      },
    };
  });
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
    flightNo: flight.flightNo,
  };
}

// Demo choices for members who are already "picked" or "booked" in the seed data, so every screen
// shows the same real flights for them. [outbound flight number, return flight number]
const SEED_FLIGHTS = { gaudi: [500, 6320], kabe: [548, 542], clara: [500, 6320] };

export function seedSelectionFor({ userId, home, status, window }) {
  const picks = SEED_FLIGHTS[userId];
  if (!picks) return null;
  const fare = status === 'booked' ? 'essential' : 'light';
  const outbound = makeSelection({ home, flightId: `outbound-${window.start}-${picks[0]}`, cabin: 'economy', fare });
  const back = makeSelection({ home, flightId: `return-${window.end}-${picks[1]}`, cabin: 'economy', fare });
  return outbound && back ? { outbound, return: back } : null;
}
