// Flight combinations: one flight per member, ranked three ways.
//
// A "combination" is one flight for every member of the group in one direction (everyone's
// outbound flight, or everyone's return flight). With 5 flights each and 3 members there are
// 5 x 5 x 5 = 125 combinations: few enough to try every one, so no clever search is needed.
//
// For each combination:
//   total   the sum of every member's price
//   spread  minutes between the earliest and latest meeting moment (landing on the way out,
//           take-off on the way home); see arrivalWindow.js
//
// The three results
//   cheapest  lowest total; a tie goes to the smaller spread
//   closest   smallest spread; a tie goes to the lower total
//   balanced  "best of both". Worked out in two steps:
//             1. Throw away every combination that another one beats outright, meaning the other
//                is no dearer AND no further apart, and better on at least one of the two.
//                What is left are the sensible trade-offs: from the cheapest to the closest, each
//                step costing more money to bring the group closer together.
//             2. Give each of those a score: how far its price is above the cheapest, as a share
//                of the price range, plus how far its spread is above the closest, as a share of
//                the spread range. 0 would be perfect on both. The lowest score wins; a tie goes
//                to the smaller spread, because landing together is the point of the feature.
//             There is no time window to set: closer is always treated as better.
//
// Also returned
//   featured  the three results above with duplicates merged: if one combination is both the
//             closest and the balanced one, it appears once with labels ['closest', 'balanced']
//   others    every other combination, best balance first (the same score, measured against the
//             same ranges), at most `othersLimit` of them
//
// A member who has already chosen a flight is FIXED: only that flight is tried for them, so the
// suggestion works around what people have decided. Everyone else is free to be placed.
//
// Pure functions: no browser, storage or network. Tested in combinations.test.js.

const MINUTE = 60000;
const EPSILON = 1e-9;

// members: [{ userId, flights: [{ id, price, instant }], fixedFlightId? }]
//   price    whole number in one currency; instant = the meeting moment in milliseconds
// Returns { cheapest, closest, balanced, featured, others, count } where each option is
//   { picks: [{ userId, flightId, price, instant, extra }], total, spreadMinutes }
// `extra` is how much more this member pays than their own cheapest flight (never negative;
// 0 for a member who has already chosen).
export function rankCombinations({ members, othersLimit = 30 }) {
  const candidates = members.map((member) => {
    const fixed = member.fixedFlightId ? member.flights.filter((f) => f.id === member.fixedFlightId) : [];
    return fixed.length ? fixed : member.flights;
  });
  // A member with no flights at all means there is nothing to combine.
  if (members.length === 0 || candidates.some((list) => list.length === 0)) {
    return { cheapest: null, closest: null, balanced: null, featured: [], others: [], count: 0 };
  }

  const cheapestOwn = members.map((member) => Math.min(...member.flights.map((f) => f.price)));
  const all = [];
  const pick = (index, chosen) => {
    if (index === candidates.length) {
      all.push(chosen);
      return;
    }
    candidates[index].forEach((flight) => pick(index + 1, [...chosen, flight]));
  };
  pick(0, []);

  const options = all.map((flights) => {
    const instants = flights.map((f) => f.instant);
    return {
      picks: flights.map((f, i) => ({
        userId: members[i].userId,
        flightId: f.id,
        price: f.price,
        instant: f.instant,
        // Someone who has already chosen has nothing extra: the choice is theirs.
        extra: members[i].fixedFlightId && f.id === members[i].fixedFlightId ? 0 : Math.max(0, f.price - cheapestOwn[i]),
      })),
      total: flights.reduce((sum, f) => sum + f.price, 0),
      spreadMinutes: flights.length < 2 ? 0 : Math.round((Math.max(...instants) - Math.min(...instants)) / MINUTE),
    };
  });

  // A fixed order for ties, so the same data always gives the same answer.
  const key = (option) => option.picks.map((p) => p.flightId).join('|');
  const best = (list, compare) => [...list].sort((a, b) => compare(a, b) || key(a).localeCompare(key(b)))[0];

  const cheapest = best(options, (a, b) => a.total - b.total || a.spreadMinutes - b.spreadMinutes);
  const closest = best(options, (a, b) => a.spreadMinutes - b.spreadMinutes || a.total - b.total);

  // Step 1: the sensible trade-offs. Every one of them costs between the cheapest and the
  // closest, and is between them in spread, so those two set the ranges for the score.
  const beats = (a, b) => a.total <= b.total && a.spreadMinutes <= b.spreadMinutes && (a.total < b.total || a.spreadMinutes < b.spreadMinutes);
  const tradeOffs = options.filter((o) => !options.some((other) => beats(other, o)));
  // Step 2: the score. A range of zero means everything is equal on that side, so it adds nothing.
  const share = (value, low, high) => (high > low ? (value - low) / (high - low) : 0);
  const score = (o) => share(o.total, cheapest.total, closest.total) + share(o.spreadMinutes, closest.spreadMinutes, cheapest.spreadMinutes);
  const byScore = (a, b) => {
    const difference = score(a) - score(b);
    return Math.abs(difference) > EPSILON ? difference : a.spreadMinutes - b.spreadMinutes || a.total - b.total;
  };
  const balanced = best(tradeOffs, byScore);

  // The same combination can win more than one rule: show it once, with every label it earned.
  const featured = [];
  [['cheapest', cheapest], ['closest', closest], ['balanced', balanced]].forEach(([label, option]) => {
    const existing = featured.find((f) => key(f.option) === key(option));
    if (existing) existing.labels.push(label);
    else featured.push({ labels: [label], option });
  });
  const shown = new Set(featured.map((f) => key(f.option)));
  const others = options
    .filter((o) => !shown.has(key(o)))
    .sort((a, b) => byScore(a, b) || key(a).localeCompare(key(b)))
    .slice(0, othersLimit);

  return { cheapest, closest, balanced, featured, others, count: options.length };
}
