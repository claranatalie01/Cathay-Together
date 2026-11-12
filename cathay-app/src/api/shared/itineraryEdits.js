import { DAY, RULES, clockOf, minutesOf } from '../../algorithms/itinerary';
import { ApiError } from '../errors';

// Keep removal-only edits at their saved times. Reordering packs one day inside
// its current flight and opening windows without calling the model again.
export function retimeResearchedPlan(plan, days, places, free) {
  const byId = Object.fromEntries(places.map((place) => [place.id, place]));
  const updates = {};
  days.forEach((day, index) => {
    const previousIds = plan.days[index].stopIds;
    const kept = previousIds.filter((id) => day.stopIds.includes(id));
    if (kept.length !== day.stopIds.length) throw new ApiError(422, 'invalid_edit', 'Move stops within the same day.');
    if (kept.every((id, i) => id === day.stopIds[i])) return;

    const midnight = index * DAY;
    let next = Math.max(midnight + RULES.dayStart, free.freeFrom ?? 0, plan.stops[previousIds[0]].start);
    let previous;
    for (const id of day.stopIds) {
      const stop = plan.stops[id];
      const hours = byId[stop.placeId]?.opening_hours?.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})/);
      const [opens, closes] = hours ? hours.slice(1).map((time) => minutesOf(time.padStart(5, '0'))) : [];
      const knownHours = closes > opens;
      const travel = previous && previous.suggestedId !== 'free' && stop.suggestedId !== 'free' ? 30 : 0;
      const start = Math.max(next + travel, midnight + (knownHours ? opens : RULES.dayStart));
      const end = start + stop.minutes;
      if (end > Math.min(midnight + RULES.dayEnd, free.freeUntil ?? Infinity, midnight + (knownHours ? closes : RULES.dayEnd))) {
        throw new ApiError(422, 'invalid_edit', 'That order does not fit the day’s flight or opening times.');
      }
      const hour = (start % DAY) / 60;
      const slot = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      updates[id] = { ...stop, start, end, startTime: clockOf(start), endTime: clockOf(end), slot };
      previous = stop;
      next = end;
    }
  });
  Object.assign(plan.stops, updates);
}
