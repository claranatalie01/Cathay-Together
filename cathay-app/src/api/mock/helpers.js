// Shared by the mock handlers: who is signed in, and finding a group.
import { ApiError } from '../errors';
import { USERS } from './db';

export function currentUser(db) {
  const user = USERS[db.session.currentUserId];
  if (!user) throw new ApiError(401, 'unauthenticated', 'You are not signed in.');
  return user;
}

export function findGroup(db, id) {
  const group = db.groups.find((g) => g.id === id);
  if (!group) throw new ApiError(404, 'group_not_found', 'That group does not exist.');
  return group;
}
