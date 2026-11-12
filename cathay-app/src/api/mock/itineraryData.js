// Itinerary builder for the demo. Voted places come from the members' saved preferences; the
// "suggested" stops only fill the days and carry no vote count. All costs are rough yen estimates
// and travel times are approximate (fictional demo data).
// The scheduling rules themselves are in src/algorithms/itinerary.js.
import { instantOf, legInstants } from '../../algorithms/arrivalWindow.js';
import { RULES, checkPlan, clockOf, minutesOf, retimeDay, schedule } from '../../algorithms/itinerary.js';
import { isPhysicalStop, savedTransferMinutes, travelTable } from '../../algorithms/travel.js';
import { PLACE_GEO } from '../../data/placeGeo.js';
import { PLACES } from './placeData.js';

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

// Estimated minutes between two voted places, from their real coordinates (see
// src/algorithms/travel.js). Stops without coordinates, such as suggested fillers, are unknown
// and the scheduler uses its standard gap for them.
const TRAVEL = travelTable(PLACE_GEO);
const placeIdOf = (stopId) => (stopId?.startsWith('place-') ? stopId.slice('place-'.length) : null);
export const travelBetweenStops = (fromId, toId) => TRAVEL[placeIdOf(fromId)]?.[placeIdOf(toId)];

// Trip day numbers (0 = first day) on which a place is closed, from OpenStreetMap's closed weekdays.
const weekdayOf = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const closedDays = (place, dates) => {
  const weekdays = PLACE_GEO[place.id]?.closedWeekdays ?? [];
  return dates.flatMap((date, day) => (weekdays.includes(weekdayOf(date)) ? [day] : []));
};

const MID_TITLES = ['Old Tokyo & lively lanes', 'Market mornings, city evenings'];
const MID_FILL = [['ueno', 'akihabara'], ['ginza', 'marunouchi']];

// When a suggested stop may happen, by its slot. (Voted places carry their own hours.)
const SLOT_HOURS = { Morning: ['08:00', '12:00'], Afternoon: ['12:00', '17:30'], Evening: ['17:30', '21:30'] };
// Where a place is tried first: a morning place as early as possible, the others from here.
const PREFERRED_START = { Morning: null, Afternoon: 13 * 60, Evening: 17 * 60 + 30 };

// What the scheduler needs to know about each place and suggested stop.
const placeItem = (place, dates = []) => ({
  closedOn: closedDays(place, dates),
  id: `place-${place.id}`,
  minutes: place.visitMinutes,
  open: minutesOf(place.open),
  close: minutesOf(place.close),
  prefer: PREFERRED_START[place.bestTime] ?? null,
});
const fillerItem = (s, day) => ({ id: `suggested-${s.id}`, day, minutes: s.minutes, open: minutesOf(SLOT_HOURS[s.slot][0]), close: minutesOf(SLOT_HOURS[s.slot][1]) });

// When the whole group is in Tokyo, in trip minutes (see src/algorithms/itinerary.js):
// from 90 minutes after the last landing until 3 hours before the first take-off.
// Members who have not chosen a flight are left out; with no flights there is no limit.
export function groupFreeTime({ selections, dates, rules }) {
  const tripStart = instantOf(dates[0], '00:00', 'HND');
  const tripMinute = (instant) => Math.round((instant - tripStart) / 60000);
  const legs = Object.values(selections ?? {});
  const landings = legs.filter((s) => s?.outbound).map((s) => legInstants(s.outbound).arriveAt);
  const takeoffs = legs.filter((s) => s?.return).map((s) => legInstants(s.return).departAt);
  return {
    freeFrom: landings.length ? tripMinute(Math.max(...landings)) + rules.afterLanding : null,
    freeUntil: takeoffs.length ? tripMinute(Math.min(...takeoffs)) - rules.beforeTakeoff : null,
  };
}

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
export function votesFor(group, userNames, places = PLACES) {
  const voters = group.members.map((m) => ({ userId: m.userId, name: userNames[m.userId], prefs: group.preferences?.[m.userId] }));
  return Object.fromEntries(
    places.map((place) => {
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
  slot: place.bestTime,
  name: place.name,
  area: place.area,
  description: place.description,
  minutes: place.visitMinutes,
  cost: place.cost,
  costLabel: place.budget,
  durationLabel: place.duration,
  photo: place.photo,
  thumb: place.thumb,
  alt: place.alt,
  liked: vote.liked,
  total: vote.total,
});
const suggestedStop = (s) => ({ id: `suggested-${s.id}`, kind: 'place', source: 'suggested', suggestedId: s.id, slot: s.slot, name: s.name, area: s.area, description: s.description, minutes: s.minutes, cost: s.cost, costLabel: s.costLabel, photo: s.photo, thumb: s.thumb, alt: s.alt });

// Builds the stored plan: which stops are on which day and at what time (each viewer's own
// flights are added when it is read). `selections` are every member's chosen flights.
export function buildPlan({ dates, votes, selections }) {
  const last = dates.length - 1;
  const mids = dates.slice(1, last);
  const voteCounts = Object.fromEntries(PLACES.map((p) => [`place-${p.id}`, votes[p.id]]));
  const places = PLACES.map((place) => placeItem(place, dates));
  const fillers = [
    fillerItem(byId('ramen'), 0),
    ...mids.flatMap((_, m) => MID_FILL[m % MID_FILL.length].map((id) => fillerItem(byId(id), m + 1))),
    ...(last > 0 ? [fillerItem(byId('breakfast'), last)] : []),
  ];
  const rules = RULES;
  const free = groupFreeTime({ selections, dates, rules });
  const inputs = { dayCount: dates.length, places, votes: voteCounts, fillers, ...free, travel: travelBetweenStops, rules };
  const result = schedule(inputs);

  const stops = {};
  const details = (id) => {
    const place = PLACES.find((p) => `place-${p.id}` === id);
    return place ? placeStop(place, votes[place.id]) : suggestedStop(SUGGESTED.find((x) => `suggested-${x.id}` === id));
  };
  const days = dates.map((date, i) => ({
    date,
    title: i === 0 ? 'Arrive & settle in' : i === last ? 'A gentle goodbye' : MID_TITLES[(i - 1) % MID_TITLES.length],
    stopIds: result.days[i].map((timed) => {
      stops[timed.id] = { ...details(timed.id), ...timesOf(timed) };
      return timed.id;
    }),
  }));
  const idOf = (stopId) => stopId.replace(/^place-/, '');
  return {
    days,
    stops,
    // Places without a majority, then winners that did not fit in the group's free time.
    maybe: [...result.maybe, ...result.unplaced].map(idOf),
    didNotFit: result.unplaced.map(idOf),
    free,
    problems: checkPlan(result, inputs),
  };
}

const timesOf = (timed) => ({ start: timed.start, end: timed.end, startTime: clockOf(timed.start), endTime: clockOf(timed.end), slot: slotOf(clockOf(timed.start)) });

// After someone reorders or removes stops, give the day's stops new times in the new order.
export function retimePlan(plan, days = plan.days) {
  if (!plan.free) return; // A plan saved before times existed: leave it as it is.
  days.forEach((day, d) => {
    const items = day.stopIds.map((id) => {
      const stop = plan.stops[id];
      const place = PLACES.find((p) => p.id === stop.placeId);
      const base = place ? placeItem(place, days.map((day) => day.date)) : fillerItem({ ...stop, id: stop.suggestedId, slot: 'Morning' }, d);
      // A moved suggested stop may happen at any time of day.
      return place ? { ...base, kind: 'voted' } : { ...base, kind: 'filler', open: RULES.dayStart, close: RULES.dayEnd };
    });
    retimeDay({ day: d, items, ...plan.free, travel: travelBetweenStops }).forEach((timed) => Object.assign(plan.stops[timed.id], timesOf(timed)));
  });
}

function slotOf(hhmm) {
  const h = Number(hhmm.slice(0, 2));
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}
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
  const minutes = travelBetweenStops(a.id, b.id);
  if (minutes === undefined) return { minutes: 20, text: 'by train · estimated' };
  return { minutes, text: `${minutes <= 15 ? 'on foot' : 'by train'} · estimated` };
}

// Reads the stored plan for one viewer: adds their own flights, travel between stops and totals.
export function assemble({ plan, selection, votes, dates, places = PLACES }) {
  const days = plan.days.map((day, index) => {
    const items = [];
    if (index === 0) items.push(selection?.outbound ? flightStop(selection.outbound, true) : { id: 'flight-arrival', kind: 'flight-missing', slot: 'Afternoon', title: 'Arrival' });
    // A timed stop shows its time after the part of the day: "Morning · 09:00–10:30".
    day.stopIds.forEach((id) => plan.stops[id] && items.push(plan.stops[id].startTime ? { ...plan.stops[id], slot: `${plan.stops[id].slot.split(' · ')[0]} · ${plan.stops[id].startTime}–${plan.stops[id].endTime}` } : plan.stops[id]));
    if (index === plan.days.length - 1 && plan.days.length > 1) items.push(selection?.return ? flightStop(selection.return, false) : { id: 'flight-departure', kind: 'flight-missing', slot: 'Afternoon', title: 'Departure' });
    let previousPlace;
    const withTravel = items.map((item, i) => {
      const previous = items[i - 1];
      let travelBefore = null;
      if (plan.transfers) {
        if (isPhysicalStop(item)) {
          if (previousPlace) travelBefore = { minutes: savedTransferMinutes(plan.transfers, previousPlace, item), text: 'estimated transfer' };
          previousPlace = item;
        }
      } else if (previous && previous.kind !== 'flight-missing' && item.kind !== 'flight-missing') {
        if (plan.builtBy === 'ai' && previous.kind === 'place' && item.kind === 'place') {
          const minutes = Math.min(30, item.start - previous.end);
          if (minutes > 0 && previous.suggestedId !== 'free' && item.suggestedId !== 'free') travelBefore = { minutes, text: 'Estimated transfer' };
        } else {
          travelBefore = travelBetween(previous, item);
        }
      }
      return { ...item, travelBefore };
    });
    const allowance = plan.builtBy === 'ai' ? 0 : (index === 0 || index === plan.days.length - 1 ? 1000 : 500);
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
  const maybe = plan.maybe.flatMap((id) => {
    const place = places.find((p) => p.id === id);
    return place ? [{ placeId: id, name: place.name, liked: votes[id]?.liked ?? 0, passed: votes[id]?.passed ?? 0, duration: place.duration, savedNote: place.savedNote }] : [];
  });
  return {
    builtAt: plan.builtAt,
    builtBy: plan.builtBy,
    usesOpenStreetMap: plan.transfers?.usesOpenStreetMap,
    days,
    maybe,
    summary: { places: placeCount, voted: days.reduce((n, d) => n + d.items.filter((i) => i.source === 'voted').length, 0), days: days.length, costPerPerson: totalCost, avgTravelMinutes: days.length ? Math.round(totalTravel / days.length) : 0, firstDate: dates[0], lastDate: dates[dates.length - 1] },
  };
}
