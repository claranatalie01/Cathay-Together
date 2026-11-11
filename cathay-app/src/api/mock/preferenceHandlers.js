// Mock endpoints for itinerary preferences (Flow D). Documented in docs/api-contract.md.
// With the AI planner on (see aiPlanner.js) the places come from a web search, found once per group.
import { ApiError } from '../errors';
import { USERS, getDb, saveDb } from './db';
import { AI_ENABLED, discover } from './aiPlanner';
import { currentUser, findGroup } from './helpers';
import { placeIdsOf, placesOf, startVoting } from './suggestions';

function memberContext(params) {
  const db = getDb();
  const user = currentUser(db);
  const group = findGroup(db, params.id);
  if (!group.members.some((m) => m.userId === user.id)) {
    throw new ApiError(403, 'not_a_member', 'Only group members can choose preferences.');
  }
  if (!/^tokyo\b/i.test(group.destination)) {
    throw new ApiError(404, 'no_suggestions', `There are no suggestions for ${group.destination} yet.`);
  }
  group.preferences = group.preferences ?? {};
  return { group, user };
}

function responseFor(group, user) {
  const mine = group.preferences[user.id] ?? { choices: {}, saved: false };
  const readiness = [...group.members]
    .sort((a, b) => (a.userId === user.id ? -1 : b.userId === user.id ? 1 : 0) || (a.userId === group.creatorId ? -1 : b.userId === group.creatorId ? 1 : 0))
    .map((member) => ({
      userId: member.userId,
      name: USERS[member.userId].name,
      initial: USERS[member.userId].initial,
      airport: USERS[member.userId].airport,
      isViewer: member.userId === user.id,
      isCreator: member.userId === group.creatorId,
      ready: Boolean(group.preferences[member.userId]?.saved),
    }));
  const ids = placeIdsOf(group);
  const liked = ids.filter((id) => mine.choices[id] === 'like').length;
  const passed = ids.filter((id) => mine.choices[id] === 'pass').length;
  return {
    group: { id: group.id, name: group.name, destination: group.destination, datesLabel: group.datesLabel },
    places: placesOf(group),
    choices: mine.choices,
    saved: mine.saved,
    counts: { total: ids.length, chosen: liked + passed, liked, passed },
    readiness,
    readyCount: readiness.filter((m) => m.ready).length,
    itineraryBuilt: Boolean(group.itinerary),
    // True while the AI planner is on and has not searched for this group yet.
    needsDiscovery: AI_ENABLED && !group.discovery,
  };
}

export const preferenceRoutes = [
  // GET /groups/:id/preferences – suggestions, the caller's choices and everyone's readiness
  ['GET', '/groups/:id/preferences', ({ params }) => {
    const { group, user } = memberContext(params);
    return { status: 200, body: responseFor(group, user) };
  }],

  // POST /groups/:id/preferences/discover – AI planner only: search the web for places to swipe on
  ['POST', '/groups/:id/preferences/discover', async ({ params }) => {
    const { group, user } = memberContext(params);
    if (!AI_ENABLED) throw new ApiError(404, 'planner_off', 'The AI planner is not switched on.');
    if (!group.discovery) {
      const found = await discover(group);
      const fresh = findGroup(getDb(), params.id);
      if (!fresh.discovery) {
        fresh.discovery = { places: found.places, sources: found.sources, foundAt: Date.now() };
        startVoting(fresh, user.id);
        saveDb();
      }
    }
    return { status: 200, body: responseFor(findGroup(getDb(), params.id), user) };
  }],

  // PUT /groups/:id/preferences/choices  { placeId, choice: 'like' | 'pass' }
  ['PUT', '/groups/:id/preferences/choices', ({ params, body }) => {
    const { group, user } = memberContext(params);
    if (!placeIdsOf(group).includes(body?.placeId) || !['like', 'pass'].includes(body?.choice)) {
      throw new ApiError(422, 'validation_failed', 'Choose Pass or Like for a suggestion.', { choice: 'Choose Pass or Like.' });
    }
    const mine = (group.preferences[user.id] = group.preferences[user.id] ?? { choices: {}, saved: false });
    mine.choices[body.placeId] = body.choice;
    mine.saved = false; // changing a choice means saving again
    saveDb();
    return { status: 200, body: responseFor(group, user) };
  }],

  // POST /groups/:id/preferences/save – needs every suggestion chosen
  ['POST', '/groups/:id/preferences/save', ({ params }) => {
    const { group, user } = memberContext(params);
    const mine = group.preferences[user.id] ?? { choices: {}, saved: false };
    if (placeIdsOf(group).some((id) => !mine.choices[id])) {
      throw new ApiError(422, 'choices_incomplete', 'Choose Pass or Like for every suggestion first.');
    }
    mine.saved = true;
    group.preferences[user.id] = mine;
    saveDb();
    return { status: 200, body: responseFor(group, user) };
  }],
];
