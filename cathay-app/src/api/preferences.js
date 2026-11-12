// Itinerary preferences (Flow D). Same rules as groups.js: async, REST-shaped, mock for now.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

// The suggestions, the caller's choices so far, and who in the group is ready.
// Rejects with no_suggestions (404) for destinations without suggestions.
export function getPreferences(groupId) {
  return request('GET', `/groups/${enc(groupId)}/preferences`);
}

// Records Pass or Like for one suggestion. `choice` is 'like' or 'pass'.
export async function chooseSuggestion(groupId, placeId, choice) {
  const result = await request('PUT', `/groups/${enc(groupId)}/preferences/choices`, { placeId, choice });
  notifyDataChanged();
  return result;
}

// Saves the caller's preferences (every suggestion must be chosen). The caller becomes "Ready".
export async function savePreferences(groupId) {
  const result = await request('POST', `/groups/${enc(groupId)}/preferences/save`);
  notifyDataChanged();
  return result;
}
