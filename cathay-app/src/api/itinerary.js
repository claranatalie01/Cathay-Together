// Shared itinerary generation, reading and editing.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

// Builds the plan from everyone's saved preferences. Rejects with not_ready (422) until all members have saved.
export async function buildItinerary(groupId) {
  const result = await request('POST', `/groups/${enc(groupId)}/itinerary/build`);
  notifyDataChanged();
  return result;
}

// The plan: days with stops, the viewer's own flights, travel between stops, totals and the Maybe list.
// Rejects with itinerary_not_built (404) until it has been built.
export function getItinerary(groupId) {
  return request('GET', `/groups/${enc(groupId)}/itinerary`);
}

// Saves removed and reordered stops: days = [{ date, stopIds }]. Flights cannot be moved.
export async function saveItinerary(groupId, days) {
  const result = await request('PUT', `/groups/${enc(groupId)}/itinerary`, { days });
  notifyDataChanged();
  return result;
}

// One stop with its details and, for a voted place, each member's vote.
export function getStop(groupId, stopId) {
  return request('GET', `/groups/${enc(groupId)}/itinerary/stops/${enc(stopId)}`);
}
