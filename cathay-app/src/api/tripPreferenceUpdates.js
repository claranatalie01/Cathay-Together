import { notifyDataChanged } from './events';
import { invalidateGet } from './http';
import { getSupabase } from './supabaseClient';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const RETRY_MS = 5000;
let nextSubscription = 0;

export function watchTripPreferences(groupId, userId) {
  if (!userId || !UUID.test(groupId ?? '')) return () => {};

  const preferencesPath = `/groups/${groupId}/preferences`;
  let active = true;
  let removeChannel = () => {};
  let retry;

  const refresh = () => {
    if (!active) return;
    // A poll that began before the save may still have the old readiness.
    invalidateGet(preferencesPath);
    invalidateGet(`${preferencesPath}?prepare=0`);
    notifyDataChanged();
  };

  async function connect() {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) throw error;
      if (data.session?.user.id !== userId) return;

      // A previous visit may still be leaving its channel. Use a fresh topic.
      // The row policy, rather than the topic name, enforces membership.
      const channel = supabase.channel(`trip-preferences:${groupId}:${++nextSubscription}`, {
        config: { postgres_changes_options: { wait: true } },
      });
      removeChannel = () => { void supabase.removeChannel(channel).catch(() => {}); };
      const changes = {
        schema: 'public',
        table: 'trip_preference_updates',
        filter: `group_id=eq.${groupId.toLowerCase()}`,
      };
      channel
        .on('postgres_changes', { ...changes, event: 'INSERT' }, refresh)
        .on('postgres_changes', { ...changes, event: 'UPDATE' }, refresh)
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') refresh();
          // The SDK rejoins on transport errors. A closed channel has been
          // removed by the SDK and needs a new subscription.
          if (status === 'CLOSED') retry = setTimeout(connect, RETRY_MS);
        });
    } catch {
      if (!active) return;
      removeChannel();
      retry = setTimeout(connect, RETRY_MS);
    }
  }

  void connect();
  return () => {
    active = false;
    clearTimeout(retry);
    removeChannel();
  };
}
