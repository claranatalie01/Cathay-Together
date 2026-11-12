// Flight search, fares and selections.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

// Prefilled "Book a trip" form for the signed-in member (their airport to the group's destination).
export function getSearchForm(groupId) {
  return request('GET', `/groups/${enc(groupId)}/flights/search-form`);
}

// Flights for one direction and day. Rejects with ApiError code date_unavailable (422).
// params: { direction: 'outbound' | 'return', date?: 'YYYY-MM-DD', cabin?: 'economy' | 'premium' | 'business' }
// Each flight carries `timing`: { spreadMinutes, closest } against the other members' chosen
// flights, or null when nobody else has chosen.
export function getFlights(groupId, { direction = 'outbound', date, cabin } = {}) {
  const query = new URLSearchParams({ direction });
  if (date) query.set('date', date);
  if (cabin) query.set('cabin', cabin);
  return request('GET', `/groups/${enc(groupId)}/flights?${query}`);
}

// Possible combinations for one direction: one flight per member. `featured` holds the cheapest,
// the closest (smallest gap between landings, or take-offs on the way home) and the balanced
// "best of both"; one combination can carry several of those labels. `others` is the rest, best
// balance first. Members who have already chosen are kept as chosen; `cabin` applies to the rest.
// params: { direction: 'outbound' | 'return', cabin?: 'economy' | 'premium' | 'business' }.
// Resolves with { featured: [{ labels, total, spreadMinutes, picks }], others: [...same without labels] }.
export function getSuggestions(groupId, { direction = 'outbound', cabin } = {}) {
  const query = new URLSearchParams({ direction });
  if (cabin) query.set('cabin', cabin);
  return request('GET', `/groups/${enc(groupId)}/flights/suggestions?${query}`);
}

// Fare types (Light, Essential, Flex) for one flight, plus the comparison table.
// Rejects with flight_not_found (404).
export function getFares(groupId, flightId, { cabin } = {}) {
  const query = cabin ? `?cabin=${enc(cabin)}` : '';
  return request('GET', `/groups/${enc(groupId)}/flights/${enc(flightId)}/fares${query}`);
}

// Saves the chosen flight and fare for its direction. Once both directions are chosen the
// member's status becomes "picked". Body: { flightId, cabin, fare }.
export async function saveSelection(groupId, selection) {
  const saved = await request('PUT', `/groups/${enc(groupId)}/flights/selection`, selection);
  notifyDataChanged();
  return saved;
}
