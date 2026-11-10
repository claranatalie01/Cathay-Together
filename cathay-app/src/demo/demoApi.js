// Demo-only operations that reach straight into the mock backend. A real
// backend has no equivalent of these: delete this folder when it arrives.
import { notifyDataChanged } from '../api/events';
import { USERS, getDb, resetDb, saveDb } from '../api/mock/db';
import { getMockOptions, setMockOptions } from '../api/mock/options';

export const listPersonas = () => Object.values(USERS);

export function readSnapshot() {
  const db = getDb();
  return { currentUserId: db.session.currentUserId, groups: db.groups, options: getMockOptions() };
}

function touch() {
  saveDb();
  notifyDataChanged();
}

export function setViewer(userId) {
  getDb().session.currentUserId = userId;
  touch();
}

export function addFriend(groupId, userId) {
  const group = getDb().groups.find((g) => g.id === groupId);
  if (!group || group.members.some((m) => m.userId === userId)) return;
  group.members.push({ userId, status: 'browsing' });
  group.invitations = group.invitations.filter((i) => i.userId !== userId);
  touch();
}

// Moves the other members to the states shown in the designs: the creator has
// booked and Kabe has picked a flight.
export function friendsPickAndBook(groupId) {
  const group = getDb().groups.find((g) => g.id === groupId);
  if (!group) return;
  if (!group.members.some((m) => m.userId === 'kabe')) {
    group.members.push({ userId: 'kabe', status: 'browsing' });
  }
  group.members.forEach((m) => {
    if (m.userId === group.creatorId) m.status = 'booked';
    else if (m.userId === 'kabe') m.status = 'picked';
  });
  touch();
}

export function setFailNext(failNext) {
  setMockOptions({ failNext });
}

export function resetDemo() {
  resetDb();
  setMockOptions({ failNext: false });
  notifyDataChanged();
}
