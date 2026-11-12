const env = import.meta.env;

// Both values are designed to be public. The secret key never belongs in the app.
export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_PUBLISHABLE_KEY = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
