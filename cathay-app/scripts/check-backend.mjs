#!/usr/bin/env node
// Checks the connection to the shared backend (Supabase) without printing any key.
//   1. Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from .env.
//   2. Confirms the project answers and accepts the key.
//   3. Confirms each table exists and that a visitor who is not signed in can read nothing.
// Run with: npm run check:backend
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TABLES = ['airports', 'profiles', 'groups', 'group_members', 'flight_selections', 'votes', 'bookings', 'itineraries', 'group_place_decks'];
// Database functions the app calls for shared trips.
const FUNCTIONS = {
  list_my_groups: {},
  get_group: { target_group: '00000000-0000-0000-0000-000000000000' },
  preview_invitation: { code: 'AAAAAA' },
  create_group: { group_name: 'check', trip_start: '2026-11-21', trip_end: '2026-11-24' },
  join_group: { target_group: '00000000-0000-0000-0000-000000000000', code: 'AAAAAA' },
  delete_group: { target_group: '00000000-0000-0000-0000-000000000000' },
  leave_group: { target_group: '00000000-0000-0000-0000-000000000000' },
  mark_invite_copied: { target_group: '00000000-0000-0000-0000-000000000000' },
  get_booking: { target_group: '00000000-0000-0000-0000-000000000000' },
  start_booking: { target_group: '00000000-0000-0000-0000-000000000000' },
  release_booking: { target_group: '00000000-0000-0000-0000-000000000000' },
  pay_booking: { target_group: '00000000-0000-0000-0000-000000000000' },
  save_preferences: { target_group: '00000000-0000-0000-0000-000000000000', place_ids: ['x'] },
};
const envPath = fileURLToPath(new URL('../.env', import.meta.url));

// Minimal .env reader: NAME=value lines, # comments, optional quotes.
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const file = readEnvFile(envPath);
const setting = (name) => (process.env[name] ?? file[name] ?? '').trim();
const url = setting('VITE_SUPABASE_URL').replace(/\/+$/, '');
const key = setting('VITE_SUPABASE_PUBLISHABLE_KEY');

const fail = (lines) => {
  console.error(['', ...[].concat(lines), ''].join('\n'));
  process.exit(1);
};

if (!url || !key) {
  fail([
    'Not set up yet.',
    `  Open ${envPath}`,
    `  and fill in ${[!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean).join(' and ')}.`,
    '  Both values are on the "API Keys" page of the Supabase dashboard.',
  ]);
}

// A legacy key is a JWT whose middle part says which role it carries.
function legacyRole(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}
const isLegacy = key.startsWith('eyJ');
if (key.startsWith('sb_secret_') || (isLegacy && legacyRole(key) === 'service_role')) {
  fail([
    'STOP: that is the SECRET key, not the publishable key.',
    '  The secret key bypasses every access rule and must never be in this file.',
    '  Replace it with the publishable key (starts with sb_publishable_), then, because the',
    '  secret key has now been written to disk, create a new secret key in the dashboard.',
  ]);
}
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  console.warn(`Note: the URL does not look like https://<project>.supabase.co. Continuing anyway.`);
}

const headers = { apikey: key, ...(isLegacy ? { Authorization: `Bearer ${key}` } : {}) };
async function get(path, postBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const options = postBody
      ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) }
      : { headers };
    const res = await fetch(`${url}${path}`, { ...options, signal: controller.signal });
    let body = null;
    try {
      body = await res.json();
    } catch {
      // Not JSON: leave the body empty.
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`\nProject: ${url}`);

let problems = 0;
try {
  const auth = await get('/auth/v1/settings');
  if (auth.status === 200) {
    console.log('  ok    The project answers and accepts the publishable key.');
  } else if (auth.status === 401 || auth.status === 403) {
    fail(['  FAIL  The project answered, but refused the key. Copy the publishable key again.']);
  } else {
    fail([`  FAIL  Unexpected answer from the project (HTTP ${auth.status}). Check the URL.`]);
  }

  console.log('\nTables (checked as a visitor who is NOT signed in):');
  for (const table of TABLES) {
    const { status, body } = await get(`/rest/v1/${table}?select=*&limit=1`);
    const code = body?.code;
    if (status === 404 || code === 'PGRST205' || code === '42P01') {
      console.log(`  --    ${table}: not created yet`);
      problems += 1;
    } else if (code === '42501' || status === 401 || status === 403) {
      console.log(`  ok    ${table}: exists, closed to visitors`);
    } else if (status === 200 && Array.isArray(body) && body.length === 0) {
      console.log(`  ok    ${table}: exists, visitors see no rows`);
    } else if (status === 200) {
      console.log(`  FAIL  ${table}: a visitor who is not signed in can read rows. The access rules are missing.`);
      problems += 1;
    } else {
      console.log(`  ??    ${table}: unexpected answer (HTTP ${status}${code ? `, ${code}` : ''})`);
      problems += 1;
    }
  }

  // A visitor must be refused by every function. (Being refused also proves it exists.)
  console.log('\nFunctions (called as a visitor who is NOT signed in):');
  for (const [name, args] of Object.entries(FUNCTIONS)) {
    const { status, body } = await get(`/rest/v1/rpc/${name}`, args);
    const code = body?.code;
    if (status === 404 || code === 'PGRST202') {
      console.log(`  --    ${name}: not created yet`);
      problems += 1;
    } else if (code === '42501' || status === 401 || status === 403) {
      console.log(`  ok    ${name}: exists, closed to visitors`);
    } else if (status >= 200 && status < 300) {
      console.log(`  FAIL  ${name}: a visitor who is not signed in could run it.`);
      problems += 1;
    } else {
      console.log(`  ??    ${name}: unexpected answer (HTTP ${status}${code ? `, ${code}` : ''})`);
      problems += 1;
    }
  }
} catch (error) {
  fail([
    '  FAIL  Could not reach the project.',
    `        ${error.name === 'AbortError' ? 'No answer within 10 seconds.' : error.message}`,
    '        Check the URL and your internet connection.',
  ]);
}

if (problems) {
  fail([
    `${problems} item(s) need attention.`,
    'If something is "not created yet", run the files in supabase/migrations in the Supabase',
    'SQL Editor, oldest first, then run this check again.',
  ]);
}
console.log('\nAll good: the app can reach the backend, and the tables and functions are protected.\n');
