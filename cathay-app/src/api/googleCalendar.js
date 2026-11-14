const SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const CLIENT_URL = 'https://accounts.google.com/gsi/client';

let clientLoad;

export function loadGoogleCalendar() {
  const oauth = globalThis.google?.accounts?.oauth2;
  if (oauth) return Promise.resolve(oauth);
  clientLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      script.remove();
      reject(new Error('Google Calendar could not load. Try again.'));
    };
    script.src = CLIENT_URL;
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      const client = globalThis.google?.accounts?.oauth2;
      if (client) resolve(client);
      else fail();
    };
    document.head.append(script);
  }).catch((error) => {
    clientLoad = undefined;
    throw error;
  });
  return clientLoad;
}

export function requestCalendarAccess(oauth, clientId) {
  return new Promise((resolve, reject) => {
    const denied = () => reject(new Error('Google Calendar permission was not granted.'));
    oauth.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      include_granted_scopes: false,
      callback: (response) => {
        if (!response.access_token || !oauth.hasGrantedAllScopes(response, SCOPE)) denied();
        else resolve(response.access_token);
      },
      error_callback: ({ type }) => {
        if (type === 'popup_closed') denied();
        else reject(new Error('Google Calendar could not open. Check your pop-up settings and try again.'));
      },
    }).requestAccessToken({ prompt: 'select_account' });
  });
}

// Stable Google event IDs make an unchanged export safe to retry after a partial write.
async function eventId(key, event) {
  const input = new TextEncoder().encode(JSON.stringify([key, event]));
  const hash = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function insertCalendarEvents(entries, token, signal) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let added = 0;
  let alreadyAdded = 0;
  try {
    for (const { key, event } of entries) {
      const id = await eventId(key, event);
      const timeout = AbortSignal.timeout(20000);
      const response = await fetch(EVENTS_URL, {
        method: 'POST', headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        body: JSON.stringify({ id, ...event }),
      });
      if (response.ok) added += 1;
      else if (response.status === 409 && (await response.json()).error?.errors?.some(({ reason }) => reason === 'duplicate')) {
        alreadyAdded += 1;
      } else break;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    // A network failure can occur after Google saved an event. Retrying uses its same ID.
  }
  return { added, alreadyAdded, remaining: entries.length - added - alreadyAdded };
}
