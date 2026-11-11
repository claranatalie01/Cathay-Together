// Sign-in, sign-out and "who is signed in". Shared mode only: the mock backend
// has its own pretend current person and needs no sign-in.
//
// A session is the proof that someone signed in. Supabase keeps it in this
// browser's storage, so a reload does not sign the person out.
import { isShared } from './config';
import { ApiError } from './errors';
import { notifyDataChanged } from './events';
import { getSupabase } from './supabaseClient';

const UNREACHABLE = new ApiError(503, 'service_unavailable', 'We could not reach the service. Check your connection and try again.');

// Turns a Supabase sign-in error into the app's own error type.
function signInError(error) {
  if (error.code === 'invalid_credentials') {
    return new ApiError(401, 'invalid_credentials', 'That email and password do not match.');
  }
  if (error.code === 'email_not_confirmed') {
    return new ApiError(403, 'email_not_confirmed', 'This account has not been confirmed yet.');
  }
  if (error.status === 429) {
    return new ApiError(429, 'too_many_attempts', 'Too many attempts. Wait a minute and try again.');
  }
  if (error.status >= 400 && error.status < 500) {
    return new ApiError(401, 'invalid_credentials', 'That email and password do not match.');
  }
  return UNREACHABLE;
}

export async function signIn({ email, password }) {
  const supabase = await getSupabase();
  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch {
    throw UNREACHABLE;
  }
  if (result.error) throw signInError(result.error);
  notifyDataChanged();
}

export async function signOut() {
  const supabase = await getSupabase();
  // 'local' signs out this browser only, not the same person's other devices.
  await supabase.auth.signOut({ scope: 'local' });
  notifyDataChanged();
}

// Calls back with { userId } or null, once straight away and again on every
// sign-in or sign-out. Returns a function that stops listening.
export function onSessionChanged(callback) {
  if (!isShared) {
    callback({ userId: 'mock' });
    return () => {};
  }
  let active = true;
  let stop = () => {};
  getSupabase().then(
    (supabase) => {
      if (!active) return;
      // Supabase reports the current session as soon as we subscribe.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session ? { userId: session.user.id } : null);
      });
      stop = () => data.subscription.unsubscribe();
    },
    () => {
      if (active) callback(null);
    },
  );
  return () => {
    active = false;
    stop();
  };
}
