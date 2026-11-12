import { ApiError } from '../errors';
import { getSupabase } from '../supabaseClient';

const running = new Map();
const warmed = new Set();

async function callPlanner(action, groupId, accessToken) {
  const signal = AbortSignal.timeout(305000);
  let response;
  try {
    response = await fetch('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action, groupId }),
      signal,
    });
  } catch {
    throw new ApiError(502, 'planner_unavailable', 'The trip planner could not finish. Try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ready !== true) {
    throw new ApiError(response.ok ? 502 : response.status, data?.code ?? 'planner_unavailable',
      data?.message ?? 'The trip planner could not finish. Try again.');
  }
}

export async function planSharedTrip(action, groupId) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, 'unauthenticated', 'Sign in again to prepare this trip.');
  const key = `${session.user.id}:${action}:${groupId}`;
  if (!running.has(key)) {
    running.set(key, callPlanner(action, groupId, session.access_token).finally(() => running.delete(key)));
  }
  return running.get(key);
}

// Research starts in the background after sign-in when a group is opened.
// A failed warm-up leaves the preferences screen free to try again.
export function warmTripSuggestions(group) {
  if (!group?.viewerId) return;
  const key = `${group.viewerId}:${group.id}`;
  if (warmed.has(key)) return;
  warmed.add(key);
  void planSharedTrip('discover', group.id).catch(() => {});
}
