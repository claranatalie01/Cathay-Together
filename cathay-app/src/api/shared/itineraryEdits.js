import { DAY, RULES, clockOf, minutesOf } from '../../algorithms/itinerary.js';
import { isPhysicalStop, savedTransferMinutes } from '../../algorithms/travel.js';
import { ApiError } from '../errors.js';

function gapBefore(plan, previous, previousPlace, stop) {
  if (plan.transfers) {
    return previousPlace && isPhysicalStop(stop) ? savedTransferMinutes(plan.transfers, previousPlace, stop) : 0;
  }
  return previous && previous.suggestedId !== 'free' && stop.suggestedId !== 'free' ? 30 : 0;
}

function fitsExistingTimes(plan, stopIds) {
  let previous;
  let previousPlace;
  return stopIds.every((id) => {
    const stop = plan.stops[id];
    const fits = !previous || stop.start - previous.end >= gapBefore(plan, previous, previousPlace, stop);
    previous = stop;
    if (isPhysicalStop(stop)) previousPlace = stop;
    return fits;
  });
}

// Keep removal-only edits at their saved times when the new pairs still fit.
// Reordering fits the saved transfer estimates inside the flight and opening windows.
export function retimeResearchedPlan(plan, days, places, free) {
  const byId = Object.fromEntries(places.map((place) => [place.id, place]));
  const updates = {};
  days.forEach((day, index) => {
    const previousIds = plan.days[index].stopIds;
    const kept = previousIds.filter((id) => day.stopIds.includes(id));
    if (kept.length !== day.stopIds.length) throw new ApiError(422, 'invalid_edit', 'Move stops within the same day.');
    if (kept.every((id, i) => id === day.stopIds[i]) &&
        (!plan.transfers || kept.length === previousIds.length || fitsExistingTimes(plan, kept))) return;

    const midnight = index * DAY;
    let next = Math.max(midnight + RULES.dayStart, free.freeFrom ?? 0, plan.stops[previousIds[0]].start);
    let previous;
    let previousPlace;
    for (const id of day.stopIds) {
      const stop = plan.stops[id];
      const hours = byId[stop.placeId]?.opening_hours?.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})/);
      const [opens, closes] = hours ? hours.slice(1).map((time) => minutesOf(time.padStart(5, '0'))) : [];
      const knownHours = closes > opens;
      const travel = gapBefore(plan, previous, previousPlace, stop);
      const start = Math.max(next + travel, midnight + (knownHours ? opens : RULES.dayStart));
      const end = start + stop.minutes;
      if (end > Math.min(midnight + RULES.dayEnd, free.freeUntil ?? Infinity, midnight + (knownHours ? closes : RULES.dayEnd))) {
        throw new ApiError(422, 'invalid_edit', 'That order does not fit the transfers, flights and opening hours.');
      }
      const hour = (start % DAY) / 60;
      const slot = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      updates[id] = { ...stop, start, end, startTime: clockOf(start), endTime: clockOf(end), slot };
      previous = stop;
      if (isPhysicalStop(stop)) previousPlace = stop;
      next = end;
    }
  });
  Object.assign(plan.stops, updates);
}
