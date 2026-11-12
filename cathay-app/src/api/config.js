// Which backend the app talks to. Set in .env (see .env.example).
//   mock   (default) the pretend backend that lives inside this browser
//   shared the real Supabase project, shared by every device
// `npm run dev` uses mock; `npm run dev:shared` uses shared.
const env = import.meta.env;

const DATA_MODE = env.VITE_DATA_MODE === 'shared' ? 'shared' : 'mock';
export const isShared = DATA_MODE === 'shared';

// Both values are designed to be public. The secret key never belongs in the app.
export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_PUBLISHABLE_KEY = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
