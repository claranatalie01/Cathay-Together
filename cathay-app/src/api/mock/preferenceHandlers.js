// Mock endpoints for itinerary preferences (Flow D). Documented in docs/api-contract.md.
import { ApiError } from '../errors';
import { USERS, getDb, saveDb } from './db';
import { currentUser, findGroup } from './helpers';
import { PLACES, PLACE_IDS } from './placeData';

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
  const liked = PLACE_IDS.filter((id) => mine.choices[id] === 'like').length;
  const passed = PLACE_IDS.filter((id) => mine.choices[id] === 'pass').length;
  return {
    group: { id: group.id, name: group.name, destination: group.destination, datesLabel: group.datesLabel },
    places: PLACES,
    choices: mine.choices,
    saved: mine.saved,
    counts: { total: PLACES.length, chosen: liked + passed, liked, passed },
    readiness,
    readyCount: readiness.filter((m) => m.ready).length,
    itineraryBuilt: Boolean(group.itinerary),
  };
}

export const preferenceRoutes = [
  // GET /groups/:id/preferences – suggestions, the caller's choices and everyone's readiness
  ['GET', '/groups/:id/preferences', ({ params }) => {
    const { group, user } = memberContext(params);
    return { status: 200, body: responseFor(group, user) };
  }],

  // PUT /groups/:id/preferences/choices  { placeId, choice: 'like' | 'pass' }
  ['PUT', '/groups/:id/preferences/choices', ({ params, body }) => {
    const { group, user } = memberContext(params);
    if (!PLACE_IDS.includes(body?.placeId) || !['like', 'pass'].includes(body?.choice)) {
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
    if (PLACE_IDS.some((id) => !mine.choices[id])) {
      throw new ApiError(422, 'choices_incomplete', 'Choose Pass or Like for every suggestion first.');
    }
    mine.saved = true;
    group.preferences[user.id] = mine;
    saveDb();
    return { status: 200, body: responseFor(group, user) };
  }],
];
