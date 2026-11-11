// The one connection to Supabase. Only files in src/api use it; pages never do.
// The library is loaded on first use, so the mock demo does not download it.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import { ApiError } from './errors';

let client = null;

export function getSupabase() {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return Promise.reject(
        new ApiError(503, 'backend_not_configured', 'The shared backend is not set up. Fill in .env.local and restart.'),
      );
    }
    client = import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY));
    // A failed download can be tried again on the next call.
    client.catch(() => {
      client = null;
    });
  }
  return client;
}
