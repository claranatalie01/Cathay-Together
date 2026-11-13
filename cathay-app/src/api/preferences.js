// Place swipe choices and group readiness.
import { notifyDataChanged } from './events';
import { invalidateGet, request } from './http';

const enc = encodeURIComponent;
const preferencesPath = (groupId) => `/groups/${enc(groupId)}/preferences`;

function refreshPreferences(groupId) {
  invalidateGet(preferencesPath(groupId));
  invalidateGet(`${preferencesPath(groupId)}?prepare=0`);
  notifyDataChanged();
}

// The suggestions, the caller's choices so far, and who in the group is ready.
// Rejects with no_suggestions (404) for destinations without suggestions.
export function getPreferences(groupId, { prepare = true } = {}) {
  return request('GET', `${preferencesPath(groupId)}${prepare ? '' : '?prepare=0'}`);
}

// Records Pass or Like for one suggestion. `choice` is 'like' or 'pass'.
export async function chooseSuggestion(groupId, placeId, choice) {
  const result = await request('PUT', `/groups/${enc(groupId)}/preferences/choices`, { placeId, choice });
  refreshPreferences(groupId);
  return result;
}

// Saves the caller's preferences (every suggestion must be chosen). The caller becomes "Ready".
export async function savePreferences(groupId) {
  const result = await request('POST', `/groups/${enc(groupId)}/preferences/save`);
  refreshPreferences(groupId);
  return result;
}
