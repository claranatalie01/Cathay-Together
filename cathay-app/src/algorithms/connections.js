// Journeys from real schedules: a direct flight, or two flights joined at Hong Kong.
//
// Cathay Pacific and HK Express fly direct to Tokyo Haneda only from Hong Kong. Travellers from
// anywhere else go to Hong Kong first, so a "journey" is one or two flights.
//
// The rules
//   1. Direct: if the trip starts or ends at Hong Kong, only direct flights on that day count.
//   2. Connecting: otherwise take every flight on the day from the start to Hong Kong, and join
//      it to a flight from Hong Kong onwards that
//        - is on the SAME airline (one airline's connection; a mix would be two separate tickets
//          with bags collected and checked in again),
//        - leaves between MIN_LAYOVER and MAX_LAYOVER minutes after the first one lands.
//      If several fit, the one with the shortest wait wins. One journey per first flight.
//      A first flight with no fitting second flight gives no journey.
//   3. Journeys are listed by departure time.
//
// Times are exact moments (UTC) so a night flight, or a different time zone, never confuses the
// layover sum. The local clock times are kept for display.
//
// Pure functions: no browser, storage or network. Tested in connections.test.js.

const HUB = 'HKG';
export const MIN_LAYOVER = 90; // minutes: land, walk to the next gate, check the connection
export const MAX_LAYOVER = 480; // minutes: eight hours is the longest wait offered

const MINUTE = 60000;
const minutesBetween = (earlier, later) => Math.round((Date.parse(later) - Date.parse(earlier)) / MINUTE);

// flights: [{ flightNo, carrier, from, to, departLocal, arriveLocal, departAt, arriveAt, minutes }]
//   departLocal / arriveLocal  'YYYY-MM-DDTHH:MM' at each airport; departAt / arriveAt  ISO UTC.
// Returns journeys: { segments: [flight], carriers: [codes], from, to, departAt, arriveAt,
//   departLocal, arriveLocal, minutes (door to door, layover included), layoverMinutes (or null) }.
export function buildJourneys({ flights, from, to, date, hub = HUB }) {
  const on = (a, b, day) => flights.filter((f) => f.from === a && f.to === b && f.departLocal.startsWith(day));
  const journey = (segments, layoverMinutes) => ({
    segments,
    carriers: [...new Set(segments.map((s) => s.carrier))],
    from,
    to,
    departAt: segments[0].departAt,
    arriveAt: segments.at(-1).arriveAt,
    departLocal: segments[0].departLocal,
    arriveLocal: segments.at(-1).arriveLocal,
    minutes: minutesBetween(segments[0].departAt, segments.at(-1).arriveAt),
    layoverMinutes,
  });

  let found;
  if (from === hub || to === hub) {
    found = on(from, to, date).map((f) => journey([f], null));
  } else {
    // The second flight may be on the next calendar day (a late arrival), so look at both days.
    const next = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const seconds = [...on(hub, to, date), ...on(hub, to, next)];
    found = on(from, hub, date).flatMap((first) => {
      const options = seconds
        .filter((second) => second.carrier === first.carrier)
        .map((second) => ({ second, layover: minutesBetween(first.arriveAt, second.departAt) }))
        .filter(({ layover }) => layover >= MIN_LAYOVER && layover <= MAX_LAYOVER)
        .sort((a, b) => a.layover - b.layover || a.second.flightNo.localeCompare(b.second.flightNo));
      return options.length ? [journey([first, options[0].second], options[0].layover)] : [];
    });
  }
  return found.sort((a, b) => a.departAt.localeCompare(b.departAt) || a.segments[0].flightNo.localeCompare(b.segments[0].flightNo));
}
