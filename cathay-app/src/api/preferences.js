// Itinerary preferences (Flow D). Same rules as groups.js: async, REST-shaped, mock for now.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

// The four suggestions, the caller's choices so far, and who in the group is ready.
// Rejects with no_suggestions (404) for destinations without suggestions.
export function getPreferences(groupId) {
  return request('GET', `/groups/${enc(groupId)}/preferences`);
}

// AI planner only (`needsDiscovery` is true in getPreferences): searches the web for places this group
// can swipe on. Slow (up to a minute or two). Rejects with planner_unreachable / agent_failed (424).
export async function discoverPlaces(groupId) {
  const result = await request('POST', `/groups/${enc(groupId)}/preferences/discover`);
  notifyDataChanged();
  return result;
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
