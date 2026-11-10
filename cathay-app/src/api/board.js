// Group board and individual booking (Flow C). Same rules as groups.js: async, REST-shaped.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

// Everyone's chosen flights, the status summary and the arrival / departure timelines.
export function getBoard(groupId) {
  return request('GET', `/groups/${enc(groupId)}/board`);
}

// The signed-in member's trip, total and payment state.
export function getBooking(groupId) {
  return request('GET', `/groups/${enc(groupId)}/booking`);
}

// "Confirm and pay": starts the 20-minute payment hold.
export async function startBooking(groupId) {
  const booking = await request('POST', `/groups/${enc(groupId)}/booking/start`);
  notifyDataChanged();
  return booking;
}

// "Change flight": gives up the payment hold.
export async function releaseHold(groupId) {
  const booking = await request('POST', `/groups/${enc(groupId)}/booking/release`);
  notifyDataChanged();
  return booking;
}

// Simulated payment. Rejects with hold_expired (410) when the 20 minutes have run out.
export async function payBooking(groupId) {
  const booking = await request('POST', `/groups/${enc(groupId)}/booking/pay`);
  notifyDataChanged();
  return booking;
}
