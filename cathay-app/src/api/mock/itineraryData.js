// Itinerary builder for the demo. Voted places come from the members' saved preferences; the
// "suggested" stops only fill the days and carry no vote count. All costs are rough yen estimates
// and travel times are approximate (fictional demo data).
import { PLACES } from './placeData';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Stops that fill a day when there are not enough voted places. They are not voted on.
const SUGGESTED = [
  { id: 'ramen', slot: 'Evening', name: 'Neighbourhood ramen', area: 'Near your hotel', description: 'A warm bowl near your hotel.', minutes: 60, cost: 1500, costLabel: '¥1,500', photo: '/assets/photos/shibuya-neon-signs-cover.jpg', thumb: '/assets/photos/shibuya-neon-signs-thumb.jpg', alt: 'Neon signs lining a Shibuya street at night' },
  { id: 'ueno', slot: 'Afternoon', name: 'Ueno Park & cafés', area: 'Ueno · Taito City', description: 'Autumn paths and a cosy café stop.', minutes: 90, cost: 1000, costLabel: '¥1,000', photo: '/assets/photos/ueno-street-dusk-cover.jpg', thumb: '/assets/photos/ueno-street-dusk-thumb.jpg', alt: 'Ueno side street at dusk with hanging lanterns' },
  { id: 'akihabara', slot: 'Evening', name: 'Akihabara & dinner', area: 'Akihabara · Chiyoda City', description: 'Arcades, glowing streets and casual dining.', minutes: 90, cost: 2500, costLabel: '¥2,500', photo: '/assets/photos/shinjuku-neon-night-cover.jpg', thumb: '/assets/photos/shinjuku-neon-night-thumb.jpg', alt: 'Neon-lit street at night' },
  { id: 'ginza', slot: 'Afternoon', name: 'Ginza architecture walk', area: 'Ginza · Chuo City', description: 'Window-shop Tokyo’s design landmarks.', minutes: 90, cost: 0, costLabel: 'Free', photo: '/assets/photos/tokyo-tower-street-train-cover.jpg', thumb: '/assets/photos/tokyo-tower-street-train-thumb.jpg', alt: 'Tokyo Tower at dusk down a street' },
  { id: 'marunouchi', slot: 'Evening', name: 'Marunouchi evening walk', area: 'Marunouchi · Chiyoda City', description: 'City architecture and a warming dinner.', minutes: 90, cost: 2000, costLabel: '¥2,000 dinner', photo: '/assets/photos/tokyo-skyline-night-cover.jpg', thumb: '/assets/photos/tokyo-skyline-night-thumb.jpg', alt: 'Tokyo skyline at night' },
  { id: 'breakfast', slot: 'Morning', name: 'Slow breakfast & packing', area: 'Near your hotel', description: 'Take it easy before heading to the airport.', minutes: 60, cost: 1000, costLabel: '¥1,000', photo: '/assets/photos/tokyo-tower-golden-cover.jpg', thumb: '/assets/photos/tokyo-tower-golden-thumb.jpg', alt: 'Tokyo Tower glowing in golden light' },
];
const byId = (id) => SUGGESTED.find((s) => s.id === id);

const MID_TITLES = ['Old Tokyo & lively lanes', 'Market mornings, city evenings'];
const MID_FILL = [['ueno', 'akihabara'], ['ginza', 'marunouchi']];
const MIDPOINT_COST = { food: 2750, scenery: 500, culture: 1000, shopping: 2000 };
const MINUTES = { food: 90, scenery: 120, culture: 120, shopping: 120 };

export function datesBetween(start, end) {
  const out = [];
  for (let d = new Date(`${start}T12:00:00Z`); d <= new Date(`${end}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}
export const dayLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
};
const dayLong = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const weekday = (iso) => DAY_NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// Votes per place from the saved preferences of the group's members.
export function votesFor(group, userNames) {
  const voters = group.members.map((m) => ({ userId: m.userId, name: userNames[m.userId], prefs: group.preferences?.[m.userId] }));
  return Object.fromEntries(
    PLACES.map((place) => {
      const votes = voters.map((v) => ({ userId: v.userId, name: v.name, choice: v.prefs?.saved ? v.prefs.choices[place.id] ?? null : null }));
      return [place.id, { votes, liked: votes.filter((v) => v.choice === 'like').length, passed: votes.filter((v) => v.choice === 'pass').length, total: votes.length }];
    }),
  );
}

const placeStop = (place, vote) => ({
  id: `place-${place.id}`,
  kind: 'place',
  source: 'voted',
  placeId: place.id,
  slot: place.bestTime === 'Morning' ? 'Morning' : 'Afternoon',
  name: place.name,
  area: place.area,
  description: place.description,
  minutes: MINUTES[place.id] ?? 90,
  cost: MIDPOINT_COST[place.id] ?? 0,
  costLabel: place.budget,
  durationLabel: place.duration,
  photo: place.photo,
  thumb: place.thumb,
  alt: place.alt,
  liked: vote.liked,
  total: vote.total,
});
const suggestedStop = (s) => ({ id: `suggested-${s.id}`, kind: 'place', source: 'suggested', suggestedId: s.id, slot: s.slot, name: s.name, area: s.area, description: s.description, minutes: s.minutes, cost: s.cost, costLabel: s.costLabel, photo: s.photo, thumb: s.thumb, alt: s.alt });

// Builds the stored plan: which stops are on which day (flights are added when it is read).
export function buildPlan({ dates, votes }) {
  const majority = (v) => v.liked * 2 > v.total;
  const scheduled = PLACES.filter((p) => majority(votes[p.id])).sort((a, b) => votes[b.id].liked - votes[a.id].liked);
  const maybe = PLACES.filter((p) => !majority(votes[p.id]) && votes[p.id].liked >= 1).map((p) => p.id);
  const stops = {};
  const add = (stop) => ((stops[stop.id] = stop), stop.id);
  const days = dates.map((date, i) => ({ date, title: '', stopIds: [] }));
  const last = days.length - 1;
  days[0].title = 'Arrive & settle in';
  if (last > 0) {
    days[last].title = 'A gentle goodbye';
    days[last].stopIds.push(add(suggestedStop(byId('breakfast'))));
  }
  const mids = days.slice(1, last);
  mids.forEach((day, m) => {
    day.title = MID_TITLES[m % MID_TITLES.length];
    const place = scheduled[m] ?? null;
    if (place) day.stopIds.push(add(placeStop(place, votes[place.id])));
    MID_FILL[m % MID_FILL.length].forEach((id) => day.stopIds.push(add(suggestedStop(byId(id)))));
  });
  // Voted places that did not fit a middle day go in the next free morning.
  scheduled.slice(mids.length).forEach((place, k) => {
    const day = mids[k % Math.max(mids.length, 1)] ?? days[0];
    day.stopIds.unshift(add(placeStop(place, votes[place.id])));
  });
  days[0].stopIds.push(add(suggestedStop(byId('ramen'))));
  return { days, stops, maybe };
}

const slotOf = (hhmm) => {
  const h = Number(hhmm.slice(0, 2));
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
};
const flightStop = (selection, arrival) => ({
  id: arrival ? 'flight-arrival' : 'flight-departure',
  kind: arrival ? 'flight-arrival' : 'flight-departure',
  slot: slotOf(arrival ? selection.arriveTime : selection.departTime),
  title: arrival ? 'Arrival' : 'Departure',
  from: selection.from,
  to: selection.to,
  date: selection.date,
  departTime: selection.departTime,
  arriveTime: selection.arriveTime,
  flightNo: selection.flightNo,
});

function travelBetween(a, b) {
  if (a.kind === 'flight-arrival') return { minutes: 60, text: 'by train · airport to city' };
  if (b.kind === 'flight-departure') return { minutes: 60, text: 'by train · city to airport' };
  return { minutes: 20, text: 'by train' };
}

// Reads the stored plan for one viewer: adds their own flights, travel between stops and totals.
export function assemble({ plan, selection, votes, dates }) {
  const days = plan.days.map((day, index) => {
    const items = [];
    if (index === 0) items.push(selection?.outbound ? flightStop(selection.outbound, true) : { id: 'flight-arrival', kind: 'flight-missing', slot: 'Afternoon', title: 'Arrival' });
    day.stopIds.forEach((id) => plan.stops[id] && items.push(plan.stops[id]));
    if (index === plan.days.length - 1 && plan.days.length > 1) items.push(selection?.return ? flightStop(selection.return, false) : { id: 'flight-departure', kind: 'flight-missing', slot: 'Afternoon', title: 'Departure' });
    const withTravel = items.map((item, i) => ({ ...item, travelBefore: i > 0 && items[i - 1].kind !== 'flight-missing' && item.kind !== 'flight-missing' ? travelBetween(items[i - 1], item) : null }));
    const allowance = index === 0 || index === plan.days.length - 1 ? 1000 : 500;
    const travelMinutes = withTravel.reduce((sum, item) => sum + (item.travelBefore?.minutes ?? 0), 0);
    const visitMinutes = items.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
    return {
      index: index + 1,
      date: day.date,
      weekday: weekday(day.date),
      label: dayLabel(day.date),
      longLabel: dayLong(day.date),
      title: day.title,
      items: withTravel,
      totals: { cost: items.reduce((sum, item) => sum + (item.cost ?? 0), 0) + allowance, allowance, minutes: visitMinutes + travelMinutes, travelMinutes },
    };
  });
  const placeCount = days.reduce((n, d) => n + d.items.filter((i) => i.kind === 'place').length, 0);
  const totalCost = days.reduce((n, d) => n + d.totals.cost, 0);
  const totalTravel = days.reduce((n, d) => n + d.totals.travelMinutes, 0);
  const maybe = plan.maybe.map((id) => {
    const place = PLACES.find((p) => p.id === id);
    return { placeId: id, name: place.name, liked: votes[id].liked, passed: votes[id].passed, duration: place.duration, savedNote: place.savedNote };
  });
  return {
    builtAt: plan.builtAt,
    days,
    maybe,
    summary: { places: placeCount, voted: days.reduce((n, d) => n + d.items.filter((i) => i.source === 'voted').length, 0), days: days.length, costPerPerson: totalCost, avgTravelMinutes: days.length ? Math.round(totalTravel / days.length) : 0, firstDate: dates[0], lastDate: dates[dates.length - 1] },
  };
}
