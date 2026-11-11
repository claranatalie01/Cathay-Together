// Itinerary preferences (Flow D). Same rules as groups.js: async, REST-shaped, mock for now.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

// The four suggestions, the caller's choices so far, and who in the group is ready.
// Rejects with no_suggestions (404) for destinations without suggestions.
export function getPreferences(groupId) {
  return request('GET', `/groups/${enc(groupId)}/preferences`);
}

// AI planner only: searches the web for places this group can swipe on. Slow (up to a minute or two).
// Started when the group is created. A call made while that search is still running shares it, so
// the preferences page waits on the same search instead of starting another one.
// Rejects with planner_unreachable / agent_failed (424).
const searching = new Map();
export function discoverPlaces(groupId) {
  if (!searching.has(groupId)) {
    const call = request('POST', `/groups/${enc(groupId)}/preferences/discover`)
      .then((result) => {
        notifyDataChanged();
        return result;
      })
      .finally(() => searching.delete(groupId));
    searching.set(groupId, call);
  }
  return searching.get(groupId);
}

// Records Pass or Like for one suggestion. `choice` is 'like' or 'pass'.
export async function chooseSuggestion(groupId, placeId, choice) {
  const result = await request('PUT', `/groups/${enc(groupId)}/preferences/choices`, { placeId, choice });
  notifyDataChanged();
  return result;
}

// Saves the caller's preferences (all four suggestions must be chosen). The caller becomes "Ready".
export async function savePreferences(groupId) {
  const result = await request('POST', `/groups/${enc(groupId)}/preferences/save`);
  notifyDataChanged();
  return result;
}
