import { notifyDataChanged } from './events';
import { request } from './http';

// The signed-in person. A real backend derives this from the session.
// Rejects with ApiError profile_not_found (404) for an account that has no profile yet.
export function getCurrentUser() {
  return request('GET', '/me');
}

// Airports a person can choose as their home airport: [{ code, city, lat, lon }].
// Shared backend only. Position is used to suggest the nearest one, in the browser.
export async function getHomeAirports() {
  const { airports } = await request('GET', '/airports');
  return airports;
}

// Saves the person's name and home airport (first sign-in, or later). Body: { name, airport }.
// Rejects with validation_failed (422) and `fields` when a value is not acceptable.
export async function saveProfile({ name, airport }) {
  const user = await request('PUT', '/me', { name, airport });
  notifyDataChanged();
  return user;
}
