// Mock REST backend. Each handler mirrors an endpoint in docs/api-contract.md
// and returns exactly the JSON a real server would.
import { ApiError } from '../errors';
import { DATE_WINDOWS, USERS, getDb, inviteUrlFor, saveDb } from './db';
import { boardRoutes } from './boardHandlers';
import { flightRoutes } from './flightHandlers';
import { itineraryRoutes } from './itineraryHandlers';
import { preferenceRoutes } from './preferenceHandlers';
import { currentUser, findGroup } from './helpers';
import { makeInviteCode, uniqueGroupId } from './ids';

const GROUP_NAME_MAX = 30;

// What the signed-in user sees of a group.
function serialize(group, userId) {
  const member = group.members.find((m) => m.userId === userId);
  const invite = group.invitations.find((i) => i.userId === userId);
  return {
    id: group.id,
    name: group.name,
    destination: group.destination,
    datesLabel: group.datesLabel,
    code: group.code,
    inviteUrl: inviteUrlFor(group.code),
    creatorId: group.creatorId,
    inviteCopied: group.inviteCopied,
    members: group.members.map((m) => {
      const { name, initial, airport } = USERS[m.userId];
      return { userId: m.userId, name, initial, airport, status: m.status };
    }),
    viewerId: member ? userId : null,
    viewerRole: member ? (group.creatorId === userId ? 'creator' : 'member') : invite ? 'invitee' : null,
    invitation: member ? null : (invite?.status ?? null),
  };
}

function validateCreate(body) {
  const fields = {};
  const name = String(body?.name ?? '').trim();
  const destination = String(body?.destination ?? '').trim();
  const dates = String(body?.dates ?? '');
  if (!name) fields.name = 'Enter a group name.';
  else if (name.length > GROUP_NAME_MAX) fields.name = `Use ${GROUP_NAME_MAX} characters or fewer.`;
  if (!destination) fields.destination = 'Enter a destination.';
  else if (!/^tokyo\b/i.test(destination)) fields.destination = 'Only Tokyo, Japan is available in this demo.';
  if (!dates) fields.dates = 'Choose your travel dates.';
  else if (!DATE_WINDOWS[dates]?.available) fields.dates = 'Only Nov 7–10, 2026 is available in this demo.';
  if (Object.keys(fields).length) {
    throw new ApiError(422, 'validation_failed', 'Some fields need attention.', fields);
  }
  return { name, dates };
}

export const routes = [
  // GET /me
  ['GET', '/me', () => {
    const db = getDb();
    return { status: 200, body: currentUser(db) };
  }],

  // GET /groups – groups the user belongs to or has been invited to
  ['GET', '/groups', () => {
    const db = getDb();
    const user = currentUser(db);
    const visible = db.groups
      .filter((g) => g.members.some((m) => m.userId === user.id) || g.invitations.some((i) => i.userId === user.id))
      .sort((a, b) => {
        const mine = (g) => (g.members.some((m) => m.userId === user.id) ? 0 : 1);
        return mine(a) - mine(b) || b.createdAt - a.createdAt;
      });
    return { status: 200, body: { groups: visible.map((g) => serialize(g, user.id)) } };
  }],

  // POST /groups
  ['POST', '/groups', ({ body }) => {
    const db = getDb();
    const user = currentUser(db);
    const { name, dates } = validateCreate(body);
    const id = uniqueGroupId(name, db.groups.map((g) => g.id));
    const group = {
      id,
      name,
      destination: 'Tokyo, Japan',
      datesLabel: DATE_WINDOWS[dates].label,
      code: makeInviteCode(id),
      creatorId: user.id,
      inviteCopied: false,
      createdAt: Date.now(),
      members: [{ userId: user.id, status: 'browsing' }],
      invitations: [],
    };
    db.groups.push(group);
    saveDb();
    return { status: 201, body: serialize(group, user.id) };
  }],

  // GET /groups/:id
  ['GET', '/groups/:id', ({ params }) => {
    const db = getDb();
    const user = currentUser(db);
    return { status: 200, body: serialize(findGroup(db, params.id), user.id) };
  }],

  // POST /groups/:id/join   { inviteCode }
  ['POST', '/groups/:id/join', ({ params, body }) => {
    const db = getDb();
    const user = currentUser(db);
    const group = findGroup(db, params.id);
    if (group.members.some((m) => m.userId === user.id)) {
      return { status: 200, body: serialize(group, user.id) };
    }
    const hasInvite = group.invitations.some((i) => i.userId === user.id);
    if (!hasInvite && String(body?.inviteCode ?? '').toUpperCase() !== group.code) {
      throw new ApiError(403, 'invalid_invite_code', 'That invite code does not match this group.');
    }
    group.members.push({ userId: user.id, status: 'browsing' });
    group.invitations = group.invitations.filter((i) => i.userId !== user.id);
    saveDb();
    return { status: 200, body: serialize(group, user.id) };
  }],

  // POST /groups/:id/decline   { inviteCode }
  ['POST', '/groups/:id/decline', ({ params, body }) => {
    const db = getDb();
    const user = currentUser(db);
    const group = findGroup(db, params.id);
    if (group.members.some((m) => m.userId === user.id)) {
      throw new ApiError(409, 'already_member', 'You are already a member of this group.');
    }
    const hasInvite = group.invitations.some((i) => i.userId === user.id);
    if (!hasInvite && String(body?.inviteCode ?? '').toUpperCase() !== group.code) {
      throw new ApiError(403, 'invalid_invite_code', 'That invite code does not match this group.');
    }
    const existing = group.invitations.find((i) => i.userId === user.id);
    if (existing) existing.status = 'declined';
    else group.invitations.push({ userId: user.id, status: 'declined' });
    saveDb();
    return { status: 200, body: serialize(group, user.id) };
  }],

  // POST /groups/:id/invite-copied
  ['POST', '/groups/:id/invite-copied', ({ params }) => {
    const db = getDb();
    const user = currentUser(db);
    const group = findGroup(db, params.id);
    if (!group.members.some((m) => m.userId === user.id)) {
      throw new ApiError(403, 'not_a_member', 'Only group members can do that.');
    }
    group.inviteCopied = true;
    saveDb();
    return { status: 200, body: serialize(group, user.id) };
  }],

  // GET /invitations/:code – preview of the group behind an invite link
  ['GET', '/invitations/:code', ({ params }) => {
    const db = getDb();
    const user = currentUser(db);
    const group = db.groups.find((g) => g.code === params.code.toUpperCase());
    if (!group) throw new ApiError(404, 'invite_not_found', 'This invitation link is not valid.');
    return { status: 200, body: serialize(group, user.id) };
  }],

  ...flightRoutes,
  ...preferenceRoutes,
  ...itineraryRoutes,
  ...boardRoutes,
];
