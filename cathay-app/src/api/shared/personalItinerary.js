import { DAY, RULES, activityTimes, clockOf, minutesOf } from '../../algorithms/itinerary.js';
import { isPhysicalStop, savedTransferMinutes, travelMinutes } from '../../algorithms/travel.js';
import { PLACE_GEO } from '../../data/placeGeo.js';
import { ApiError } from '../errors.js';

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const validTime = (stop) => Number.isInteger(stop.start) && Number.isInteger(stop.end) && stop.end > stop.start;
const isSafeImage = (url) => typeof url === 'string' && /^(?:https:\/\/|\/assets\/)/.test(url);
const overlaps = (a, b) => validTime(a) && validTime(b) && a.start < b.end && b.start < a.end;
const sameStop = (a, b) => a && b && a.name === b.name && a.placeId === b.placeId && a.start === b.start && a.end === b.end;
const safeStopId = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id) && !Object.hasOwn(Object.prototype, id);

const invalidEdit = (message) => new ApiError(422, 'invalid_edit', message);

// A saved override contains its own activity and time, so a later shared replacement,
// removal or rebuild does not discard it. Only overridden slots are copied.
function overridesFor(changes, date) {
  const day = changes?.[date];
  if (!isRecord(day)) return [];
  return Object.entries(day).filter(([id, change]) => {
    if (!safeStopId(id) || !isRecord(change) || typeof change.name !== 'string') return false;
    const { stop } = change;
    return stop === null || (isRecord(stop) && stop.id === id && stop.kind === 'place' &&
      typeof stop.name === 'string' && safeStopId(stop.placeId ?? stop.id) && Number.isFinite(stop.minutes) && Number.isFinite(stop.cost) &&
      (validTime(stop) || (stop.start == null && stop.end == null)) &&
      (stop.photo == null || isSafeImage(stop.photo)) && (stop.thumb == null || isSafeImage(stop.thumb)) && typeof stop.slot === 'string');
  });
}

export function withPersonalChanges(plan, changes) {
  const stops = { ...plan.stops };
  let transfers = plan.transfers ? structuredClone(plan.transfers) : undefined;
  const days = plan.days.map((day) => {
    const entries = overridesFor(changes, day.date);
    if (!entries.length) return day;

    const overrides = new Map(entries);
    const personalStops = entries.map(([, { stop }]) => stop).filter(Boolean);
    for (const [id, { stop, order }] of entries) {
      if (!stop) continue;
      stops[id] = { ...stop, myChange: !day.stopIds.includes(id) || !sameStop(stop, plan.stops[id]) || (Number.isInteger(order) && day.stopIds.indexOf(id) !== order) };
      if (stop.transfer) {
        transfers ??= { between: {}, fallbackMinutes: RULES.travelGap };
        const key = stop.placeId ?? stop.id;
        const { between, usesOpenStreetMap, usesGeoapify } = stop.transfer;
        if (isRecord(between)) {
          for (const [other, minutes] of Object.entries(between)) {
            if (!safeStopId(other) || !Number.isFinite(minutes) || minutes < 0) continue;
            transfers.between[key] = { ...transfers.between[key], [other]: minutes };
            transfers.between[other] = { ...transfers.between[other], [key]: minutes };
          }
        }
        transfers.usesOpenStreetMap ||= usesOpenStreetMap === true;
        transfers.usesGeoapify ||= usesGeoapify === true;
      }
    }

    const stopIds = day.stopIds.filter((id) => {
      if (overrides.has(id)) return overrides.get(id).stop !== null;
      return !personalStops.some((stop) => overlaps(stop, stops[id]));
    });
    for (const stop of personalStops) {
      if (!stopIds.includes(stop.id)) stopIds.push(stop.id);
    }
    if (stopIds.every((id) => validTime(stops[id]))) {
      stopIds.sort((a, b) => stops[a].start - stops[b].start);
    } else {
      // Older plans can have no clock times. Preserve the personal order of moved stops.
      for (const [id, { order }] of entries.filter(([, item]) => Number.isInteger(item.order)).sort((a, b) => a[1].order - b[1].order)) {
        const current = stopIds.indexOf(id);
        if (current < 0) continue;
        stopIds.splice(current, 1);
        stopIds.splice(order, 0, id);
      }
    }
    return { ...day, stopIds };
  });
  return { ...plan, days, stops, transfers };
}

const timesFor = (stop) => stop ? activityTimes(stop) : null;

function timedStop(stop) {
  const times = timesFor(stop);
  return times ? { id: stop.id, name: stop.name, ...times } : null;
}

export function personalRemovals(plan, changes) {
  return Object.fromEntries(plan.days.map((day) => [
    day.date,
    overridesFor(changes, day.date).filter(([id, change]) => change.stop === null && day.stopIds.includes(id))
      .map(([id]) => ({ id, name: plan.stops[id].name })),
  ]));
}

export function itineraryTimeline(plan, people, personalRows, viewerId) {
  const members = Object.values(people).sort((a, b) => a.id.localeCompare(b.id)).map(({ id, name }) => ({ id, name, isViewer: id === viewerId }));
  const personal = new Map(personalRows.map((row) => [row.user_id, withPersonalChanges(plan, row.changes)]));
  return plan.days.map((day, index) => ({
    date: day.date,
    groupStops: day.stopIds.map((id) => timedStop(plan.stops[id])).filter(Boolean),
    untimed: day.stopIds.filter((id) => !timesFor(plan.stops[id])).map((id) => plan.stops[id].name),
    members: members.map((member) => {
      const custom = personal.get(member.id);
      const ids = custom?.days[index].stopIds ?? day.stopIds;
      const active = new Set(ids);
      const groupIds = new Set(day.stopIds);
      const changed = ids.filter((id) => !groupIds.has(id) || !sameStop(custom?.stops[id] ?? plan.stops[id], plan.stops[id]) || custom?.stops[id]?.myChange);
      const skipped = day.stopIds.filter((id) => !active.has(id));
      const events = changed.map((id) => timedStop(custom?.stops[id])).filter(Boolean);
      const untimed = changed.filter((id) => !timesFor(custom.stops[id])).map((id) => ({ name: custom.stops[id].name }));
      untimed.push(...skipped.filter((id) => !timesFor(plan.stops[id])).map((id) => ({ name: plan.stops[id].name, skipped: true })));
      events.push(...skipped.map((id) => {
        const item = timedStop(plan.stops[id]);
        if (!item || events.some((event) => event.start < item.end && item.start < event.end)) return null;
        return { ...item, skipped: true };
      }).filter(Boolean));
      const deviations = [...changed.map((id) => timedStop(custom?.stops[id])), ...skipped.map((id) => timedStop(plan.stops[id]))].filter(Boolean);
      const common = day.stopIds.filter((id) => active.has(id) && !changed.includes(id))
        .map((id) => timedStop(plan.stops[id])).filter(Boolean).sort((a, b) => a.start - b.start);
      const rejoins = [...new Set(deviations
        .map(({ end }) => common.find(({ start }) => start >= end && !deviations.some((item) => item.start <= start && item.end > start))?.start)
        .filter((time) => time != null))];
      return { ...member, untimed, events: events.sort((a, b) => a.start - b.start), skipped, changed, rejoins };
    }),
  }));
}

export function personalChangesFor(changes, before, after, date) {
  const oldDay = before.days.find((day) => day.date === date);
  const newDay = after.days.find((day) => day.date === date);
  const overrides = Object.fromEntries(overridesFor(changes, date));
  for (const id of oldDay.stopIds) {
    const oldStop = before.stops[id];
    if (!newDay.stopIds.includes(id)) {
      if (oldStop.personalAddition) delete overrides[id];
      else overrides[id] = { name: oldStop.name, stop: null };
    } else {
      const current = after.stops[id];
      const index = newDay.stopIds.indexOf(id);
      const movedWithoutTime = !validTime(current) && index !== oldDay.stopIds.indexOf(id);
      if (!sameStop(oldStop, current) || movedWithoutTime) {
        const { myChange, ...snapshot } = current;
        overrides[id] = { name: oldStop.name, stop: snapshot, ...(movedWithoutTime ? { order: index } : {}) };
      }
    }
  }
  for (const id of newDay.stopIds) {
    if (!oldDay.stopIds.includes(id)) {
      const { myChange, ...snapshot } = after.stops[id];
      overrides[id] = { name: snapshot.name, stop: snapshot };
    }
  }
  return { ...changes, [date]: overrides };
}

export function restoreGroupStop(changes, date, stopId) {
  if (!safeStopId(stopId)) throw invalidEdit('That stop is unavailable.');
  const overrides = Object.fromEntries(overridesFor(changes, date));
  delete overrides[stopId];
  return { ...changes, [date]: overrides };
}

export function addTransfers(plan, place, places) {
  if (!plan.transfers) return;
  const byId = new Map(places.map((item) => [item.id, item.coordinates ?? PLACE_GEO[item.id]]));
  const coordinates = byId.get(place.id);
  if (!coordinates) return;
  const between = plan.transfers.between;
  const pairs = between[place.id] ?? {};
  for (const [id, other] of byId) {
    if (!other || id === place.id || pairs[id] !== undefined) continue;
    const minutes = travelMinutes(coordinates, other);
    pairs[id] = minutes;
    between[id] = { ...between[id], [place.id]: minutes };
  }
  between[place.id] = pairs;
  if (place.coordinateSource?.includes('openstreetmap.org') || place.coordinateSource?.includes('geoapify.com') || PLACE_GEO[place.id]) plan.transfers.usesOpenStreetMap = true;
  if (place.coordinateSource?.includes('geoapify.com')) plan.transfers.usesGeoapify = true;
}

export function replaceItineraryStop(plan, day, stopId, place, places, free) {
  const current = plan.stops[stopId];
  if (!validTime(current)) throw invalidEdit('Choose a stop with a scheduled time to replace.');
  if (day.stopIds.some((id) => id !== stopId && plan.stops[id].placeId === place.id)) {
    throw invalidEdit('That activity is already on this day.');
  }
  const minutes = place.estimated_duration_min ?? place.visitMinutes ?? current.minutes;
  const start = current.start;
  const end = start + minutes;
  const startOfDay = Math.floor(start / DAY) * DAY;
  const scheduleHours = place.opening_hours?.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})/);
  const opens = scheduleHours?.[1].padStart(5, '0') ?? place.open;
  const closes = scheduleHours?.[2].padStart(5, '0') ?? place.close;
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(day.date));
  const closed = place.closed_days?.some((value) => value.slice(0, 3).toLowerCase() === weekday.toLowerCase());
  if (closed || (opens && start < startOfDay + minutesOf(opens)) || (closes && end > startOfDay + minutesOf(closes))) {
    throw invalidEdit('That activity is closed at this time.');
  }
  if (start < (free.freeFrom ?? -Infinity) || end > Math.min(startOfDay + RULES.dayEnd, free.freeUntil ?? Infinity)) {
    throw invalidEdit('That activity does not fit before the next stop or within the flight buffers.');
  }
  const cost = place.estimated_cost_jpy ?? place.cost ?? 0;
  const replacement = {
    id: stopId, kind: 'place', source: 'suggested', placeId: place.id,
    name: place.name, area: place.area, description: place.description, cost, costLabel: place.budget,
    photo: place.photo, thumb: place.thumb || place.photo, alt: place.alt, category_key: place.category_key,
    slot: current.slot.split(' · ')[0], start, end, startTime: clockOf(start), endTime: clockOf(end), minutes,
  };
  addTransfers(plan, place, places);
  const index = day.stopIds.indexOf(stopId);
  const previous = day.stopIds.slice(0, index).map((id) => plan.stops[id]);
  const next = day.stopIds.slice(index + 1).map((id) => plan.stops[id]);
  const pairs = [[previous.at(-1), replacement], [replacement, next[0]]];
  if (plan.transfers) {
    pairs.push([previous.findLast(isPhysicalStop), replacement], [replacement, next.find(isPhysicalStop)]);
  }
  if (pairs.some(([a, b]) => a && b && validTime(a) && validTime(b) &&
      b.start - a.end < (plan.transfers && isPhysicalStop(a) && isPhysicalStop(b) ? savedTransferMinutes(plan.transfers, a, b) : 0))) {
    throw invalidEdit('That activity does not fit between the surrounding stops and transfers.');
  }
  if (plan.transfers?.between[place.id]) {
    replacement.transfer = {
      between: plan.transfers.between[place.id],
      usesOpenStreetMap: plan.transfers.usesOpenStreetMap,
      usesGeoapify: plan.transfers.usesGeoapify,
    };
  }
  plan.stops[stopId] = replacement;
  return replacement;
}
