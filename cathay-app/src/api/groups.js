// Everything the UI needs for travel groups. Pages call only these functions.
// Each one is async and resolves with the JSON a REST API would return.
import { notifyDataChanged } from './events';
import { request } from './http';

const enc = encodeURIComponent;

export async function getGroups() {
  const { groups } = await request('GET', '/groups');
  return groups;
}

export function getGroup(id) {
  return request('GET', `/groups/${enc(id)}`);
}

// Looks up the group behind an invite link. Rejects with ApiError codes
// invite_not_found (404).
export function getGroupByCode(code) {
  return request('GET', `/invitations/${enc(code)}`);
}

export async function createGroup(values) {
  const group = await request('POST', '/groups', {
    name: values.name,
    destination: values.destination,
    dates: values.dates,
  });
  notifyDataChanged();
  return group;
}

export async function joinGroup(groupId, inviteCode) {
  const group = await request('POST', `/groups/${enc(groupId)}/join`, { inviteCode });
  notifyDataChanged();
  return group;
}

export async function declineInvite(groupId, inviteCode) {
  const group = await request('POST', `/groups/${enc(groupId)}/decline`, { inviteCode });
  notifyDataChanged();
  return group;
}

export async function markInviteCopied(groupId) {
  const group = await request('POST', `/groups/${enc(groupId)}/invite-copied`);
  notifyDataChanged();
  return group;
}
