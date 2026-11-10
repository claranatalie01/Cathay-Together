// Flight booking calls (Flow B). Same rules as groups.js: async, REST-shaped, mock for now.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

// Prefilled "Book a trip" form for the signed-in member (their airport to the group's destination).
export function getSearchForm(groupId) {
  return request('GET', `/groups/${enc(groupId)}/flights/search-form`);
}

// Flights for one direction and day. Rejects with ApiError code date_unavailable (422).
// params: { direction: 'outbound' | 'return', date?: 'YYYY-MM-DD', cabin?: 'economy' | 'premium' | 'business', window?: 1..6 }
// `window` is the group timing window in hours; each flight then carries `timing` against the other members.
export function getFlights(groupId, { direction = 'outbound', date, cabin, window } = {}) {
  const query = new URLSearchParams({ direction });
  if (date) query.set('date', date);
  if (cabin) query.set('cabin', cabin);
  if (window) query.set('window', String(window));
  return request('GET', `/groups/${enc(groupId)}/flights?${query}`);
}

// Fare types (Light, Essential, Flex) for one flight, plus the comparison table.
// Rejects with flight_not_found (404).
export function getFares(groupId, flightId, { cabin } = {}) {
  const query = cabin ? `?cabin=${enc(cabin)}` : '';
  return request('GET', `/groups/${enc(groupId)}/flights/${enc(flightId)}/fares${query}`);
}

// The signed-in member's chosen outbound and return flights so far: { outbound?, return? }.
export function getSelection(groupId) {
  return request('GET', `/groups/${enc(groupId)}/flights/selection`);
}

// Saves the chosen flight and fare for its direction. Once both directions are chosen the
// member's status becomes "picked". Body: { flightId, cabin, fare }.
export async function saveSelection(groupId, selection) {
  const saved = await request('PUT', `/groups/${enc(groupId)}/flights/selection`, selection);
  notifyDataChanged();
  return saved;
}
