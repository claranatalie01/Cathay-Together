// Swipe choices and readiness for the current group deck.
export function responseFor(group, user, people, places) {
  const mine = group.preferences[user.id] ?? { choices: {}, saved: false };
  const readiness = [...group.members]
    .sort((a, b) => (a.userId === user.id ? -1 : b.userId === user.id ? 1 : 0) || (a.userId === group.creatorId ? -1 : b.userId === group.creatorId ? 1 : 0))
    .map((member) => ({
      userId: member.userId,
      name: people[member.userId].name,
      initial: people[member.userId].initial,
      airport: people[member.userId].airport,
      isViewer: member.userId === user.id,
      isCreator: member.userId === group.creatorId,
      ready: Boolean(group.preferences[member.userId]?.saved),
    }));
  const liked = places.filter(({ id }) => mine.choices[id] === 'like').length;
  const passed = places.filter(({ id }) => mine.choices[id] === 'pass').length;
  return {
    group: { id: group.id, name: group.name, destination: group.destination, datesLabel: group.datesLabel },
    places,
    choices: mine.choices,
    saved: mine.saved,
    counts: { total: places.length, chosen: liked + passed, liked, passed, neutral: places.length - liked - passed },
    readiness,
    readyCount: readiness.filter((m) => m.ready).length,
    itineraryBuilt: Boolean(group.itinerary),
  };
}
