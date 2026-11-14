import { DAY, activityTimes, clockOf } from './itinerary.js';

const TIME_ZONES = { 'Tokyo, Japan': 'Asia/Tokyo' };

function localDateTime(date, minute, timeZone) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + Math.floor(minute / DAY));
  return { dateTime: `${day.toISOString().slice(0, 10)}T${clockOf(minute)}:00`, timeZone };
}

// days is the signed-in traveller's effective plan, with personal changes already applied.
export function calendarExportFor({ group, days }) {
  const timeZone = TIME_ZONES[group.destination];
  const events = [];
  let unscheduled = 0;
  if (!timeZone) return { timeZone, events, unscheduled };

  for (const { date, items } of days) {
    for (const item of items) {
      if (item.kind !== 'place') continue;
      const times = activityTimes(item);
      if (!times || times.end <= times.start) {
        unscheduled += 1;
        continue;
      }
      const event = {
        summary: item.name,
        start: localDateTime(date, times.start, timeZone),
        end: localDateTime(date, times.end, timeZone),
      };
      const location = item.address || item.area;
      if (location && item.suggestedId !== 'free') event.location = location;
      events.push({ key: [group.id, date, item.id], event });
    }
  }
  return { timeZone, events, unscheduled };
}
