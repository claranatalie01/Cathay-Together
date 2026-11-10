// Mock endpoints for the itinerary (Flow E). Documented in docs/api-contract.md.
import { ApiError } from '../errors';
import { USERS, getDb, saveDb } from './db';
import { windowOf } from './flightData';
import { currentUser, findGroup } from './helpers';
import { assemble, buildPlan, datesBetween, votesFor } from './itineraryData';
import { PLACES } from './placeData';

function context(params) {
  const db = getDb();
  const user = currentUser(db);
  const group = findGroup(db, params.id);
  if (!group.members.some((m) => m.userId === user.id)) throw new ApiError(403, 'not_a_member', 'Only group members can see the itinerary.');
  if (!/^tokyo\b/i.test(group.destination)) throw new ApiError(404, 'no_suggestions', `There is no itinerary for ${group.destination} yet.`);
  const win = windowOf(group.datesLabel);
  const names = Object.fromEntries(Object.entries(USERS).map(([id, u]) => [id, u.name]));
  return { group, user, dates: datesBetween(win.start, win.end), votes: votesFor(group, names), names };
}

function bodyFor(ctx) {
  const { group, user, dates, votes } = ctx;
  if (!group.itinerary) throw new ApiError(404, 'itinerary_not_built', 'The itinerary has not been built yet.');
  return {
    group: { id: group.id, name: group.name, destination: group.destination, datesLabel: group.datesLabel },
    members: group.members.length,
    ...assemble({ plan: group.itinerary, selection: group.selections?.[user.id], votes, dates }),
  };
}

export const itineraryRoutes = [
  // POST /groups/:id/itinerary/build – needs everyone ready; builds (or rebuilds) the plan
  ['POST', '/groups/:id/itinerary/build', ({ params }) => {
    const ctx = context(params);
    const waiting = ctx.group.members.filter((m) => !ctx.group.preferences?.[m.userId]?.saved).map((m) => ctx.names[m.userId]);
    if (waiting.length) throw new ApiError(422, 'not_ready', `Waiting for ${waiting.join(', ')} to finish swiping.`, { waiting });
    ctx.group.itinerary = { ...buildPlan({ dates: ctx.dates, votes: ctx.votes }), builtAt: Date.now() };
    saveDb();
    return { status: 200, body: bodyFor(ctx) };
  }],

  // GET /groups/:id/itinerary
  ['GET', '/groups/:id/itinerary', ({ params }) => ({ status: 200, body: bodyFor(context(params)) })],

  // PUT /groups/:id/itinerary  { days: [{ date, stopIds: [] }] } – remove and reorder stops
  ['PUT', '/groups/:id/itinerary', ({ params, body }) => {
    const ctx = context(params);
    const plan = ctx.group.itinerary;
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
    plan.days = next;
    saveDb();
    return { status: 200, body: bodyFor(ctx) };
  }],

  // GET /groups/:id/itinerary/stops/:stopId – one stop, with each member's vote for a voted place
  ['GET', '/groups/:id/itinerary/stops/:stopId', ({ params }) => {
    const ctx = context(params);
    const full = bodyFor(ctx);
    for (const day of full.days) {
      const stop = day.items.find((item) => item.id === params.stopId && item.kind === 'place');
      if (stop) {
        const place = stop.placeId ? PLACES.find((p) => p.id === stop.placeId) : null;
        return {
          status: 200,
          body: {
            group: full.group,
            day: { index: day.index, label: day.label },
            stop: { ...stop, budget: place?.budget ?? stop.costLabel, durationBest: place ? `${place.duration} · ${place.bestTime}` : (stop.minutes === 60 ? '1 hr' : `${Math.round(stop.minutes / 6) / 10} hrs`), tip: place?.tip ?? null },
            votes: stop.placeId ? ctx.votes[stop.placeId].votes.map((v) => ({ ...v, initial: USERS[v.userId].initial, isViewer: v.userId === ctx.user.id })) : null,
          },
        };
      }
    }
    throw new ApiError(404, 'stop_not_found', 'That stop is not in the itinerary.');
  }],
];
