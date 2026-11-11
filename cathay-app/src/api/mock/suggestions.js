// Which places a group votes on: the AI-found deck once it exists, otherwise the four sample
// places. Also the demo teammates' votes. Only src/api/mock imports this file.
import { PLACES, PLACE_IDS, SEED_CHOICES } from './placeData';

export const placesOf = (group) => group.discovery?.places ?? PLACES;
export const placeIdsOf = (group) => (group.discovery ? group.discovery.places.map((p) => p.id) : PLACE_IDS);

function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Demo only: a teammate who has "already swiped". Sample places use the fixed seed; an AI deck gets
// a repeatable pattern (about 3 in 5 liked) so the same teammate always votes the same way.
export function demoChoicesFor(userId, group) {
  if (!group.discovery) {
    const seed = SEED_CHOICES[userId];
    return seed ? Object.fromEntries(PLACE_IDS.map((id) => [id, seed[id]])) : null;
  }
  return Object.fromEntries(group.discovery.places.map((p) => [p.id, hash(`${userId}:${p.id}`) % 5 < 3 ? 'like' : 'pass']));
}

// After a new AI deck: everyone starts again, except picked/booked teammates who get demo votes.
// The person using the app votes for themselves.
export function startVoting(group, viewerId) {
  group.preferences = {};
  delete group.itinerary;
  group.members.forEach((member) => {
    if (member.userId === viewerId || (member.status !== 'picked' && member.status !== 'booked')) return;
    const choices = demoChoicesFor(member.userId, group);
    if (choices) group.preferences[member.userId] = { choices, saved: true };
  });
}
