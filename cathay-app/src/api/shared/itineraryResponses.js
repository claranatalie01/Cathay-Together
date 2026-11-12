import { ApiError } from '../errors.js';
import { LEGACY_PLACES } from '../../data/legacyPlaces.js';
import { assemble, retimePlan } from './itineraryData.js';

// What the itinerary screens read. `ctx` is { group, user, dates, votes }.
export function bodyFor(ctx) {
  const { group, user, dates, votes } = ctx;
  if (!group.itinerary) throw new ApiError(404, 'itinerary_not_built', 'The itinerary has not been built yet.');
  return {
    group: { id: group.id, name: group.name, destination: group.destination, datesLabel: group.datesLabel },
    members: group.members.length,
    ...assemble({ plan: group.itinerary, selection: group.selections?.[user.id], votes, dates, places: ctx.places }),
  };
}

// Applies "remove and reorder" to a plan in place: body is { days: [{ date, stopIds: [] }] }.
export function applyItineraryEdit(plan, body, { retime = retimePlan } = {}) {
  if (!plan) throw new ApiError(404, 'itinerary_not_built', 'The itinerary has not been built yet.');
  const seen = new Set();
  const next = plan.days.map((day) => {
    const sent = (body?.days ?? []).find((d) => d.date === day.date);
    if (!sent || !Array.isArray(sent.stopIds)) throw new ApiError(422, 'validation_failed', 'Send every day with its stops.');
    sent.stopIds.forEach((id) => {
      if (!plan.stops[id] || seen.has(id)) throw new ApiError(422, 'validation_failed', 'A stop in that plan is not valid.');
      seen.add(id);
    });
    return { ...day, stopIds: sent.stopIds };
  });
  retime(plan, next);
  plan.days = next;
}

// One stop, with each member's vote for a voted place. `initials` is { [userId]: 'G' }.
export function stopBody(ctx, stopId, initials) {
  const full = bodyFor(ctx);
  for (const day of full.days) {
    const stop = day.items.find((item) => item.id === stopId && item.kind === 'place');
    if (!stop) continue;
    const place = stop.placeId ? (ctx.places ?? LEGACY_PLACES).find((p) => p.id === stop.placeId) : null;
    return {
      group: full.group,
      day: { index: day.index, label: day.label },
      stop: { ...stop, budget: place?.budget ?? stop.costLabel, durationBest: place ? `${place.duration} · ${place.bestTime}` : (stop.minutes === 60 ? '1 hr' : `${Math.round(stop.minutes / 6) / 10} hrs`), tip: place?.tip ?? null },
      votes: ctx.votes[stop.placeId]?.votes.map((v) => ({ ...v, initial: initials[v.userId], isViewer: v.userId === ctx.user.id })) ?? null,
    };
  }
  throw new ApiError(404, 'stop_not_found', 'That stop is not in the itinerary.');
}
