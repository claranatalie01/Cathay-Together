import { ApiError } from '../errors.js';
import { LEGACY_PLACES } from '../../data/legacyPlaces.js';
import { assemble, retimePlan } from './itineraryData.js';
import { itineraryTimeline, personalRemovals, withPersonalChanges } from './personalItinerary.js';

// What the itinerary screens read. `ctx` is { group, user, dates, votes }.
export function bodyFor(ctx) {
  const { group, user, dates, votes } = ctx;
  if (!group.itinerary) throw new ApiError(404, 'itinerary_not_built', 'The itinerary has not been built yet.');
  const personalRows = ctx.personalRows ?? [];
  const own = personalRows.find((row) => row.user_id === user.id);
  const plan = own ? withPersonalChanges(group.itinerary, own.changes) : group.itinerary;
  const result = assemble({ plan, selection: group.selections?.[user.id], votes, dates, places: ctx.places });
  return {
    group: { id: group.id, name: group.name, destination: group.destination, datesLabel: group.datesLabel },
    members: group.members.length,
    ...result,
    groupRevision: ctx.itineraryRevision,
    personalRevision: own?.updated_at ?? null,
    sharedDays: group.itinerary.days.map(({ date, stopIds }) => ({
      date, stops: stopIds.map((id) => ({ id, name: group.itinerary.stops[id]?.name })),
    })),
    removedByDay: personalRemovals(group.itinerary, own?.changes),
    editPlaces: (ctx.places ?? []).map(({ id, name, area, budget }) => ({ id, name, area, budget })),
    timeline: itineraryTimeline(group.itinerary, ctx.people ?? {}, personalRows, user.id),
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
  const shared = assemble({ plan: ctx.group.itinerary, selection: ctx.group.selections?.[ctx.user.id], votes: ctx.votes, dates: ctx.dates, places: ctx.places });
  for (const day of [...full.days, ...shared.days]) {
    const stop = day.items.find((item) => item.id === stopId && item.kind === 'place');
    if (!stop) continue;
    const place = stop.placeId ? (ctx.places ?? LEGACY_PLACES).find((p) => p.id === stop.placeId) : null;
    const votes = stop.source === 'voted' ? ctx.votes[stop.placeId]?.votes : null;
    return {
      group: full.group,
      day: { index: day.index, label: day.label },
      stop: { ...stop, budget: place?.budget ?? stop.costLabel, durationBest: place ? `${place.duration} · ${place.bestTime}` : (stop.minutes === 60 ? '1 hr' : `${Math.round(stop.minutes / 6) / 10} hrs`), tip: place?.tip ?? null },
      votes: votes?.map((v) => ({ ...v, initial: initials[v.userId], isViewer: v.userId === ctx.user.id })) ?? null,
    };
  }
  throw new ApiError(404, 'stop_not_found', 'That stop is not in the itinerary.');
}
