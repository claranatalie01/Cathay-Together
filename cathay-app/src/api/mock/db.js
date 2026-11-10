// The mock "database": users, groups and the signed-in session, persisted in
// localStorage. Only src/api/mock and src/demo import this file.
import { seedSelectionFor, windowOf } from './flightData';
import { PLACE_IDS, SEED_CHOICES } from './placeData';

const KEY = 'cathay-mock-db-v3';

export const USERS = {
  clara: { id: 'clara', name: 'Clara', initial: 'C', airport: { code: 'SHA', city: 'Shanghai' } },
  gaudi: { id: 'gaudi', name: 'Gaudi', initial: 'G', airport: { code: 'HKG', city: 'Hong Kong' } },
  kabe: { id: 'kabe', name: 'Kabe', initial: 'K', airport: { code: 'SIN', city: 'Singapore' } },
};

// Windows the server accepts when creating a group.
export const DATE_WINDOWS = {
  'nov-7-10': { label: 'Nov 7–10, 2026', available: true },
  'nov-14-17': { label: 'Nov 14–17, 2026', available: false },
  'nov-21-24': { label: 'Nov 21–24, 2026', available: false },
};

const INVITE_BASE_URL = 'https://flights.cathaypacific.com/share/';
export const inviteUrlFor = (code) => `${INVITE_BASE_URL}${code}`;

function seed() {
  return {
    session: { currentUserId: 'gaudi' },
    groups: [
      {
        id: 'tokyo-together',
        name: 'Tokyo together',
        destination: 'Tokyo, Japan',
        datesLabel: 'Nov 7–10, 2026',
        code: 'VFX37K',
        creatorId: 'gaudi',
        inviteCopied: false,
        createdAt: 1,
        members: [
          { userId: 'gaudi', status: 'booked' },
          { userId: 'kabe', status: 'picked' },
        ],
        invitations: [{ userId: 'clara', status: 'pending' }],
      },
      {
        id: 'neon-nights', name: 'Neon nights', destination: 'Tokyo, Japan', datesLabel: 'Nov 14–17, 2026',
        code: 'NEON42', creatorId: 'gaudi', inviteCopied: false, createdAt: 2,
        members: [{ userId: 'gaudi', status: 'picked' }], invitations: [],
      },
      {
        id: 'kyoto-autumn', name: 'Kyoto autumn', destination: 'Kyoto, Japan', datesLabel: 'Nov 21–24, 2026',
        code: 'KYO777', creatorId: 'kabe', inviteCopied: false, createdAt: 3,
        members: [{ userId: 'kabe', status: 'booked' }, { userId: 'gaudi', status: 'picked' }], invitations: [],
      },
    ],
  };
}

// Members who are already "picked" or "booked" get real flight choices, so the board, the Members
// page and the group timing agree. Also fills them in for data saved before this existed.
function ensureSelections(data) {
  data.groups.forEach((group) => {
    const window = windowOf(group.datesLabel);
    group.selections = group.selections ?? {};
    group.members.forEach((member) => {
      if (group.selections[member.userId] || (member.status !== 'picked' && member.status !== 'booked')) return;
      const seeded = seedSelectionFor({ userId: member.userId, home: USERS[member.userId].airport, status: member.status, window });
      if (seeded) group.selections[member.userId] = seeded;
    });
  });
  return data;
}

// Members who are "picked" or "booked" have already saved their itinerary preferences (demo seed).
function ensurePreferences(data) {
  data.groups.forEach((group) => {
    group.preferences = group.preferences ?? {};
    group.members.forEach((member) => {
      if (group.preferences[member.userId] || (member.status !== 'picked' && member.status !== 'booked')) return;
      const choices = SEED_CHOICES[member.userId];
      if (choices) group.preferences[member.userId] = { choices: Object.fromEntries(PLACE_IDS.map((id) => [id, choices[id]])), saved: true };
    });
  });
  return data;
}

let db = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Array.isArray(saved.groups) && saved.session) return ensurePreferences(ensureSelections(saved));
  } catch {
    // Missing or corrupt: start from the seed.
  }
  return ensurePreferences(ensureSelections(seed()));
}

export function getDb() {
  if (!db) db = load();
  return db;
}

export function saveDb() {
  try {
    localStorage.setItem(KEY, JSON.stringify(getDb()));
  } catch {
    // Storage unavailable: data lives in memory for this page load.
  }
}

export function resetDb() {
  db = ensurePreferences(ensureSelections(seed()));
  saveDb();
}
