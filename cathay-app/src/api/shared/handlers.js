// Shared-mode answers to the app's requests, backed by Supabase.
// Same shape as src/api/mock/handlers.js: [method, path pattern, handler], and each
// handler returns { status, body } as described in docs/api-contract.md.
//
// Connected so far: GET /me. Every other request answers "not connected yet"
// (see http.js) until its endpoint is added here.
import { ApiError } from '../errors';
import { getSupabase } from '../supabaseClient';

const UNREACHABLE = () => new ApiError(503, 'service_unavailable', 'The service is temporarily unavailable.');

// The signed-in person's id, taken from their verified session. Never from the request.
async function requireUserId(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw UNREACHABLE();
  if (!data.session) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  return data.session.user.id;
}

// Runs one database query and returns its rows, or throws the app's error type.
async function rows(query) {
  const { data, error } = await query;
  if (error) throw UNREACHABLE();
  return data;
}

export const routes = [
  // GET /me – the signed-in person, read from their row in `profiles`.
  ['GET', '/me', async () => {
    const supabase = await getSupabase();
    const userId = await requireUserId(supabase);
    const [profile] = await rows(supabase.from('profiles').select('id, display_name, home_airport').eq('id', userId));
    if (!profile) {
      throw new ApiError(404, 'profile_not_found', 'This account has no profile yet. Ask the team to add it.');
    }
    const [airport] = await rows(supabase.from('airports').select('code, city').eq('code', profile.home_airport));
    return {
      status: 200,
      body: {
        id: profile.id,
        name: profile.display_name,
        initial: profile.display_name.charAt(0).toUpperCase(),
        airport: airport ?? { code: profile.home_airport, city: profile.home_airport },
      },
    };
  }],
];
