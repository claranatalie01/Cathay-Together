import { request } from './http';

// The signed-in person. A real backend derives this from the session.
export function getCurrentUser() {
  return request('GET', '/me');
}
