// Itinerary: turn the group's votes into a timetable that cannot clash.
//
// The rules
//   1. Votes. A place is IN when more than half of the group liked it (a strict majority:
//      2 of 3, 2 of 2, 3 of 4, but not 2 of 4). A place with at least one like but no
//      majority is a "maybe". A place nobody liked is dropped.
//   2. Free time. The group is free from 90 minutes after the LAST person lands until
//      3 hours before the FIRST person takes off, and each day only between 08:00 and 21:30.
//   3. Scheduling (a "greedy" method: handle one item at a time, best first, and never move
//      something already placed). Winners go first, most-liked first. Each is offered to the
//      emptiest day and given the earliest start where it
//        - is inside the group's free time,
//        - is inside the place's opening hours,
//        - is not on a day the place is closed (`closedOn`: trip day numbers, 0 = first day),
//        - leaves travel time before and after its neighbours: the real estimate for that pair
//          when `travel(fromId, toId)` knows it, otherwise the standard 20 minutes.
//      A winner that fits nowhere is reported, not squeezed in.
//   4. Fillers (suggested stops nobody voted on) take whatever room is left, in their own day,
//      and only in a part of the day (morning, afternoon, evening) with no voted place.
//   5. checkPlan() re-reads the finished timetable and lists every rule it breaks.
//      An empty list is the proof that the plan is valid.
//
// Times are "trip minutes": minutes since 00:00 (destination time) on the first day.
// So 09:30 on day 2 is 1440 + 570 = 2010. Pure functions: no browser, storage or network.

export const DAY = 1440;

export const RULES = {
  dayStart: 8 * 60, // 08:00
  dayEnd: 21 * 60 + 30, // 21:30
  travelGap: 20, // minutes between two stops
  afterLanding: 90, // immigration, bags and the train into the city
  beforeTakeoff: 180, // the train back plus check-in
  step: 15, // start times are rounded up to a quarter of an hour
};

export const hasMajority = (vote) => vote.liked * 2 > vote.total;

// Splits the places by their votes. `places` order breaks ties.
export function rankVotes(places, votes) {
  const vote = (place) => votes[place.id] ?? { liked: 0, total: 0 };
  return {
    winners: places.filter((p) => hasMajority(vote(p))).sort((a, b) => vote(b).liked - vote(a).liked),
    maybe: places.filter((p) => !hasMajority(vote(p)) && vote(p).liked >= 1),
  };
}

const roundUp = (minutes, step) => Math.ceil(minutes / step) * step;

// The part of one day in which `item` may happen: [from, until] in trip minutes.
function allowedWindow(day, item, { freeFrom, freeUntil }, rules) {
  const base = day * DAY;
  return {
    from: Math.max(base + rules.dayStart, base + item.open, freeFrom),
    until: Math.min(base + rules.dayEnd, base + item.close, freeUntil),
  };
}

// Minutes of travel needed between two items. `travel(fromId, toId)` returns minutes or
// undefined when it does not know the pair (stops with no coordinates); then the standard gap.
const gapBetween = (travel, rules) => (fromId, toId) => {
  const minutes = travel ? travel(fromId, toId) : undefined;
  return Number.isFinite(minutes) ? minutes : rules.travelGap;
};

const clashes = (start, end, item, stops, gapOf) =>
  stops.some((s) => {
    const gap = gapOf(s.id, item.id);
    return start < s.end + gap && s.start < end + gap;
  });

// The earliest start for `item` on `day` that breaks no rule, or null.
function findStart(day, item, stops, free, rules, gapOf) {
  if (item.closedOn?.includes(day)) return null;
  const { from, until } = allowedWindow(day, item, free, rules);
  // Only these moments can be the earliest valid start: the opening of the window, the
  // preferred time, and just after each stop already on that day.
  const candidates = [from, ...stops.map((s) => s.end + gapOf(s.id, item.id))].map((t) => roundUp(Math.max(t, from), rules.step)).sort((a, b) => a - b);
  if (item.prefer != null) candidates.unshift(roundUp(Math.max(day * DAY + item.prefer, from), rules.step));
  for (const start of candidates) {
    const end = start + item.minutes;
    if (end <= until && !clashes(start, end, item, stops, gapOf)) return start;
  }
  return null;
}

// Builds the timetable.
//   dayCount   number of days in the trip
//   places     voted places: [{ id, minutes, open, close, prefer? }] (open/close/prefer = minutes of the day)
//   votes      { [placeId]: { liked, total } }
//   fillers    suggested stops: [{ id, day, minutes, open, close }]
//   freeFrom   trip minute the group is free from (null = start of the trip)
//   freeUntil  trip minute the group must be done by (null = end of the trip)
//   travel     optional (fromId, toId) => minutes between two stops; unknown pairs use rules.travelGap
//   places and fillers may also carry closedOn: [trip day numbers the place is closed]
// Returns { days: [[{ id, kind, start, end }]], maybe: [ids], unplaced: [ids], skippedFillers: [ids] }.
export function schedule({ dayCount, places, votes, fillers = [], freeFrom = null, freeUntil = null, travel = null, rules = RULES }) {
  const gapOf = gapBetween(travel, rules);
  const free = { freeFrom: freeFrom ?? 0, freeUntil: freeUntil ?? dayCount * DAY };
  const days = Array.from({ length: dayCount }, () => []);
  const { winners, maybe } = rankVotes(places, votes);
  const unplaced = [];
  const skippedFillers = [];

  // Middle days are full sightseeing days; the first and last are cut short by flights.
  const isEdge = (d) => dayCount > 2 && (d === 0 || d === dayCount - 1);
  const voted = (d) => days[d].filter((s) => s.kind === 'voted').length;

  winners.forEach((place) => {
    const order = days.map((_, d) => d).sort((a, b) => voted(a) - voted(b) || isEdge(a) - isEdge(b) || a - b);
    for (const d of order) {
      const start = findStart(d, place, days[d], free, rules, gapOf);
      if (start !== null) {
        days[d].push({ id: place.id, kind: 'voted', start, end: start + place.minutes });
        return;
      }
    }
    unplaced.push(place.id);
  });

  fillers.forEach((filler) => {
    // A filler only fills a gap: if a voted place already starts in its part of the day
    // (say, its evening), the group has something to do then and the filler is left out.
    const taken = filler.day < dayCount && days[filler.day].some((s) => s.kind === 'voted' && s.start % DAY >= filler.open && s.start % DAY < filler.close);
    const start = filler.day < dayCount && !taken ? findStart(filler.day, filler, days[filler.day], free, rules, gapOf) : null;
    if (start === null) skippedFillers.push(filler.id);
    else days[filler.day].push({ id: filler.id, kind: 'filler', start, end: start + filler.minutes });
  });

  days.forEach((stops) => stops.sort((a, b) => a.start - b.start));
  return { days, maybe: maybe.map((p) => p.id), unplaced, skippedFillers };
}

// Re-times one day after a person reorders or removes stops: keeps their order and packs the
// stops one after another. It respects opening times where the order allows; anything the
// order makes impossible is left for checkPlan to report.
export function retimeDay({ day, items, freeFrom = null, freeUntil = null, travel = null, rules = RULES }) {
  const gapOf = gapBetween(travel, rules);
  let previous = null;
  return items.map((item) => {
    const { from } = allowedWindow(day, item, { freeFrom: freeFrom ?? 0, freeUntil: freeUntil ?? Infinity }, rules);
    const ready = previous ? previous.end + gapOf(previous.id, item.id) : from;
    const start = roundUp(Math.max(from, ready), rules.step);
    previous = { id: item.id, end: start + item.minutes };
    return { id: item.id, kind: item.kind, start, end: start + item.minutes };
  });
}

// Lists every rule a timetable breaks. Empty list = valid.
// `plan` is what schedule() returned; the other arguments are the same inputs.
export function checkPlan(plan, { dayCount, places, votes, fillers = [], freeFrom = null, freeUntil = null, travel = null, rules = RULES }) {
  const gapOf = gapBetween(travel, rules);
  const problems = [];
  const free = { freeFrom: freeFrom ?? 0, freeUntil: freeUntil ?? dayCount * DAY };
  const items = new Map([...places, ...fillers].map((item) => [item.id, item]));
  const { winners } = rankVotes(places, votes);
  const seen = new Set();

  if (plan.days.length !== dayCount) problems.push(`Expected ${dayCount} days, found ${plan.days.length}.`);
  plan.days.forEach((stops, d) => {
    stops.forEach((stop, i) => {
      const item = items.get(stop.id);
      if (!item) return problems.push(`Day ${d + 1}: unknown stop ${stop.id}.`);
      if (seen.has(stop.id)) problems.push(`${stop.id} is scheduled twice.`);
      seen.add(stop.id);
      if (stop.end - stop.start !== item.minutes) problems.push(`${stop.id} is given ${stop.end - stop.start} minutes, not ${item.minutes}.`);
      if (item.closedOn?.includes(d)) problems.push(`${stop.id} is scheduled on day ${d + 1}, when it is closed.`);
      const { from, until } = allowedWindow(d, item, free, rules);
      if (stop.start < from) problems.push(`${stop.id} starts before it is allowed (closed, too early, or before everyone has landed).`);
      if (stop.end > until) problems.push(`${stop.id} ends after it is allowed (closed, too late, or too close to a flight).`);
      if (stop.kind === 'voted' && !winners.some((w) => w.id === stop.id)) problems.push(`${stop.id} is scheduled without a majority.`);
      const previous = stops[i - 1];
      const gap = previous ? gapOf(previous.id, stop.id) : 0;
      if (previous && stop.start < previous.end + gap) problems.push(`${stop.id} starts less than ${gap} minutes after ${previous.id} ends.`);
    });
  });
  winners.forEach((w) => {
    if (!seen.has(w.id) && !plan.unplaced.includes(w.id)) problems.push(`${w.id} won the vote but is neither scheduled nor reported as not fitting.`);
  });
  return problems;
}

// 'HH:MM' of a trip minute, and minutes of the day from 'HH:MM'.
export const clockOf = (tripMinute) => {
  const m = ((tripMinute % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const minutesOf = (clock) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
