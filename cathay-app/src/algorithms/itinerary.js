// Times and flight buffers for shared itinerary editing. Trip minutes start at midnight
// on the first trip day in the destination time zone.

export const DAY = 1440;

export const RULES = {
  dayStart: 8 * 60, // 08:00
  dayEnd: 21 * 60 + 30, // 21:30
  travelGap: 20, // minutes between two stops
  afterLanding: 90, // immigration, bags and the train into the city
  beforeTakeoff: 180, // the train back plus check-in
  step: 15, // start times are rounded up to a quarter of an hour
};

const roundUp = (minutes, step) => Math.ceil(minutes / step) * step;

// Minutes of travel needed between two items. `travel(fromId, toId)` returns minutes or
// undefined when it does not know the pair (stops with no coordinates); then the standard gap.
const gapBetween = (travel, rules) => (fromId, toId) => {
  const minutes = travel ? travel(fromId, toId) : undefined;
  return Number.isFinite(minutes) ? minutes : rules.travelGap;
};

// Re-times a legacy saved itinerary after removing or reordering stops.
export function retimeDay({ day, items, freeFrom = null, travel = null, rules = RULES }) {
  const gapOf = gapBetween(travel, rules);
  const midnight = day * DAY;
  let previous = null;
  return items.map((item) => {
    const from = Math.max(midnight + rules.dayStart, midnight + item.open, freeFrom ?? 0);
    const ready = previous ? previous.end + gapOf(previous.id, item.id) : from;
    const start = roundUp(Math.max(from, ready), rules.step);
    previous = { id: item.id, end: start + item.minutes };
    return { id: item.id, kind: item.kind, start, end: start + item.minutes };
  });
}

// 'HH:MM' of a trip minute, and minutes of the day from 'HH:MM'.
export const clockOf = (tripMinute) => {
  const m = ((tripMinute % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const minutesOf = (clock) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));

export function localClockLabel(minutes) {
  const clock = clockOf(minutes);
  const hour = Number(clock.slice(0, 2));
  return `${hour % 12 || 12}${clock.slice(2)} ${hour < 12 ? 'AM' : 'PM'}`;
}

const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

// Convert saved activity clocks to minutes within the activity's local day.
export function activityTimes(stop) {
  if (!clockPattern.test(stop.startTime)) return null;
  const start = minutesOf(stop.startTime);
  const end = clockPattern.test(stop.endTime) ? minutesOf(stop.endTime) : start;
  const duration = Number.isInteger(stop.minutes) && stop.minutes > 0 ? stop.minutes : 0;
  return { start, end: end < start ? end + DAY : end === start ? start + duration : end };
}
