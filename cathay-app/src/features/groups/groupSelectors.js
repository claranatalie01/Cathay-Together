// Presentation helpers that turn API group data into what screens show.

// Members in display order: the signed-in user first, then the creator, then the rest.
export function orderedMembers(group) {
  const rank = (m) => (m.userId === group.viewerId ? 0 : m.userId === group.creatorId ? 1 : 2);
  return group.members
    .map((m, index) => ({ ...m, index }))
    .sort((a, b) => rank(a) - rank(b) || a.index - b.index)
    .map((m) => ({
      ...m,
      isViewer: m.userId === group.viewerId,
      isCreator: m.userId === group.creatorId,
    }));
}

export function memberSummary(members) {
  const count = members.length;
  const airports = members.map((m) => m.airport.code).join(', ');
  return count === 1
    ? `1 member · ${airports} · Invite your friends`
    : `${count} members · ${airports}`;
}
