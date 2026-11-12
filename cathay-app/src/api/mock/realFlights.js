// Flights from the saved OAG snapshot (src/data/oagSnapshot.json, made by `npm run fetch:oag`).
// REAL: which Cathay Pacific and HK Express flights exist, their numbers, and their departure and
// arrival times. FICTIONAL: the prices and the "seats left" figures. OAG sells schedules, not fares.
import { buildJourneys } from '../../algorithms/connections.js';
import snapshot from '../../data/oagSnapshot.json' with { type: 'json' };

const hash = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Invented fare model: a base plus an amount per minute in the air, HK Express a little over half
// of Cathay, and a small steady difference between flights so prices are not all alike.
const CARRIER_FACTOR = { CX: 1, UO: 0.55 };
const segmentPrice = (segment, dayFactor) => {
  const base = (380 + segment.minutes * 19) * (CARRIER_FACTOR[segment.carrier] ?? 1);
  const wobble = 0.92 + (hash(segment.flightNo) % 17) / 100;
  return Math.round(base * wobble * dayFactor);
};

const SEATS = [9, 6, null, 4, null, 7, 5];
const clock = (local) => local.slice(11, 16);
const durationLabel = (minutes) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;

// Journeys for a traveller's home airport on one day, shaped like the flights the screens expect.
//   direction 'outbound': home to Tokyo Haneda on `date`; 'return': Tokyo Haneda to home on `date`.
//   cabinOnlyCx: premium economy and business exist on Cathay Pacific only (HK Express is all economy).
// Traveller airports other than Hong Kong connect through Hong Kong (src/algorithms/connections.js).
export function realJourneys({ homeCode, direction, date, dayFactor = 1, cabinOnlyCx = false, destinationCode }) {
  const from = direction === 'outbound' ? homeCode : destinationCode;
  const to = direction === 'outbound' ? destinationCode : homeCode;
  return buildJourneys({ flights: snapshot.flights, from, to, date })
    .filter((j) => !cabinOnlyCx || j.carriers.every((c) => c === 'CX'))
    .map((j) => {
      const numbers = j.segments.map((s) => s.flightNo);
      const id = `${direction}-${date}-${numbers.join('_')}`;
      const price = j.segments.reduce((sum, s) => sum + segmentPrice(s, dayFactor), 0);
      return {
        id,
        flightNo: numbers.join(' + '),
        from,
        to,
        date,
        departTime: clock(j.departLocal),
        arriveTime: clock(j.arriveLocal),
        arriveDate: j.arriveLocal.slice(0, 10),
        departAt: j.departAt,
        arriveAt: j.arriveAt,
        duration: durationLabel(j.minutes),
        operatedBy: null,
        seatsLeft: SEATS[hash(id) % SEATS.length],
        lowest: false,
        economyPrice: price,
        priceFrom: price,
        carriers: j.carriers,
        // Set when the journey is two flights joined in Hong Kong.
        via: j.layoverMinutes === null ? null : { airport: 'HKG', layoverMinutes: j.layoverMinutes, layoverLabel: durationLabel(j.layoverMinutes) },
        segments: j.segments.map((s) => ({
          flightNo: s.flightNo,
          from: s.from,
          to: s.to,
          departTime: clock(s.departLocal),
          arriveTime: clock(s.arriveLocal),
          arriveDate: s.arriveLocal.slice(0, 10),
        })),
      };
    });
}
