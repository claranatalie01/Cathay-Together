// Saved itinerary display, flight windows and compatibility for older shared plans.
import { instantOf, legInstants } from '../../algorithms/arrivalWindow.js';
import { RULES, clockOf, minutesOf, retimeDay } from '../../algorithms/itinerary.js';
import { isPhysicalStop, savedTransferMinutes, travelTable } from '../../algorithms/travel.js';
import { PLACE_GEO } from '../../data/placeGeo.js';
import { LEGACY_PLACES } from '../../data/legacyPlaces.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Estimate travel between known places for older plans without stored transfers.
const TRAVEL = travelTable(PLACE_GEO);
const placeIdOf = (stopId) => (stopId?.startsWith('place-') ? stopId.slice('place-'.length) : null);
const travelBetweenStops = (fromId, toId) => TRAVEL[placeIdOf(fromId)]?.[placeIdOf(toId)];

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
const dayLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
};
const dayLong = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const weekday = (iso) => DAY_NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// Votes per place from the saved preferences of the group's members.
export function votesFor(group, userNames, places = LEGACY_PLACES) {
  const voters = group.members.map((m) => ({ userId: m.userId, name: userNames[m.userId], prefs: group.preferences?.[m.userId] }));
  return Object.fromEntries(
    places.map((place) => {
      const votes = voters.map((v) => ({ userId: v.userId, name: v.name, choice: v.prefs?.saved ? v.prefs.choices[place.id] ?? null : null }));
      return [place.id, { votes, liked: votes.filter((v) => v.choice === 'like').length, passed: votes.filter((v) => v.choice === 'pass').length, total: votes.length }];
    }),
  );
}

const timesOf = (timed) => ({ start: timed.start, end: timed.end, startTime: clockOf(timed.start), endTime: clockOf(timed.end), slot: slotOf(clockOf(timed.start)) });

// After someone reorders or removes stops, give the day's stops new times in the new order.
export function retimePlan(plan, days = plan.days) {
  if (!plan.free) return; // A plan saved before times existed: leave it as it is.
  days.forEach((day, d) => {
    const items = day.stopIds.map((id) => {
      const stop = plan.stops[id];
      const place = LEGACY_PLACES.find((p) => p.id === stop.placeId);
      return place
        ? { id, kind: 'voted', minutes: place.visitMinutes, open: minutesOf(place.open) }
        : { id, kind: 'filler', minutes: stop.minutes, open: RULES.dayStart };
    });
    retimeDay({
      day: d, items, ...plan.free,
      travel: (from, to) => TRAVEL[plan.stops[from]?.placeId ?? placeIdOf(from)]?.[plan.stops[to]?.placeId ?? placeIdOf(to)],
    }).forEach((timed) => Object.assign(plan.stops[timed.id], timesOf(timed)));
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
export function assemble({ plan, selection, votes, dates, places = LEGACY_PLACES }) {
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
  const scheduled = new Set(days.flatMap((day) => day.items.map((item) => item.placeId)));
  const maybe = (plan.maybe ?? []).flatMap((id) => {
    if (scheduled.has(id)) return [];
    const place = places.find((p) => p.id === id);
    return place ? [{ placeId: id, name: place.name, liked: votes[id]?.liked ?? 0, passed: votes[id]?.passed ?? 0, duration: place.duration, savedNote: place.savedNote }] : [];
  });
  return {
    builtAt: plan.builtAt,
    builtBy: plan.builtBy,
    usesOpenStreetMap: plan.transfers?.usesOpenStreetMap,
    usesGeoapify: plan.transfers?.usesGeoapify,
    days,
    maybe,
    summary: { places: placeCount, voted: days.reduce((n, d) => n + d.items.filter((i) => i.source === 'voted').length, 0), days: days.length, costPerPerson: totalCost, avgTravelMinutes: days.length ? Math.round(totalTravel / days.length) : 0, firstDate: dates[0], lastDate: dates[dates.length - 1] },
  };
}
