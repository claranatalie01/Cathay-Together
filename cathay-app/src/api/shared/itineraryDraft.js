import { DAY, RULES, activityTimes, clockOf, localClockLabel, minutesOf } from '../../algorithms/itinerary.js';
import { isPhysicalStop, travelMinutes } from '../../algorithms/travel.js';
import { PLACE_GEO } from '../../data/placeGeo.js';
import { ApiError } from '../errors.js';
import { groupFreeTime } from './itineraryData.js';
import { addTransfers, personalChangesFor, restoreGroupStop, withPersonalChanges } from './personalItinerary.js';

const validId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(id) && !Object.hasOwn(Object.prototype, id);
const validDuration = (value) => Number.isInteger(value) && value > 0 && value <= 720;
const validClock = (value) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const fixed = (stop) => stop.booked === true || stop.kind === 'booking' || stop.fixed === true;
const keyFor = (stop) => stop.placeId ?? stop.id;
const changed = (a, b) => !a || !b || a.name !== b.name || a.placeId !== b.placeId ||
  a.startTime !== b.startTime || a.endTime !== b.endTime || a.minutes !== b.minutes;

function updateTime(stop, start, end) {
  const hour = Math.floor((start % DAY) / 60);
  Object.assign(stop, {
    start, end, startTime: clockOf(start), endTime: clockOf(end),
    slot: hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening',
  });
}

function bounds(place, date) {
  const match = place?.opening_hours?.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})/);
  const open = place?.open ?? match?.[1].padStart(5, '0');
  const close = place?.close ?? match?.[2].padStart(5, '0');
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(date)).toLowerCase();
  return {
    opens: validClock(open) ? minutesOf(open) : 0,
    closes: validClock(close) ? minutesOf(close) : DAY,
    closed: place?.closed_days?.some((value) => value.slice(0, 3).toLowerCase() === weekday),
  };
}

function transfer(plan, from, to, places) {
  const a = keyFor(from), b = keyFor(to);
  if (a === b) return 0;
  const cached = plan.transfers.between[a]?.[b];
  if (cached !== undefined) return cached;
  const first = places.get(a)?.coordinates ?? PLACE_GEO[a];
  const second = places.get(b)?.coordinates ?? PLACE_GEO[b];
  if (!first || !second) return plan.transfers.fallbackMinutes;
  const minutes = travelMinutes(first, second);
  plan.transfers.between[a] = { ...plan.transfers.between[a], [b]: minutes };
  plan.transfers.between[b] = { ...plan.transfers.between[b], [a]: minutes };
  return minutes;
}

function newStop(id, place, minutes) {
  return {
    id, kind: 'place', source: 'suggested', placeId: place.id, name: place.name, area: place.area,
    description: place.description, photo: place.photo, thumb: place.thumb || place.photo,
    alt: place.alt, category_key: place.category_key, cost: place.estimated_cost_jpy ?? place.cost ?? 0,
    costLabel: place.budget, minutes, slot: 'Morning',
  };
}

function saveTransferSnapshot(plan, stop) {
  stop.transfer = {
    between: plan.transfers.between[keyFor(stop)] ?? {},
    usesOpenStreetMap: plan.transfers.usesOpenStreetMap, usesGeoapify: plan.transfers.usesGeoapify,
  };
}

function reschedule(plan, day, previousDay, before, requested, moved, reviewMoves, free, places, report) {
  const midnight = plan.days.indexOf(day) * DAY;
  const firstSaved = previousDay.stopIds.length ? activityTimes(before.stops[previousDay.stopIds[0]])?.start : undefined;
  let previous;
  let previousPlace;
  let scheduling = false;

  for (const [index, id] of day.stopIds.entries()) {
    const stop = plan.stops[id];
    const times = activityTimes(stop);
    const travel = previousPlace && isPhysicalStop(stop) ? transfer(plan, previousPlace, stop, places) : 0;
    const ready = Math.max(
      midnight + RULES.dayStart, free.freeFrom ?? 0, previous?.end ?? 0, previousPlace ? previousPlace.end + travel : 0,
    );
    const { opens, closes, closed } = bounds(places.get(stop.placeId), day.date);
    const explicit = requested.get(id);
    scheduling ||= previousDay.stopIds[index] !== id || explicit !== undefined || (times && stop.minutes !== times.end - times.start);
    const preferred = midnight + (times?.start ?? firstSaved ?? RULES.dayStart);
    let start = preferred;
    if (explicit !== undefined) {
      start = midnight + explicit;
    } else if (reviewMoves.has(id)) {
      start = Math.max(midnight + RULES.dayStart, previous?.end ?? preferred);
    } else if (scheduling && !fixed(stop)) {
      const preferredStart = moved.has(id) ? midnight + (firstSaved ?? RULES.dayStart) : preferred;
      start = Math.max(ready, midnight + opens, preferredStart);
    }
    const end = start + (stop.minutes ?? (times ? times.end - times.start : 60));
    if (!times || start !== preferred || end - start !== times.end - times.start) {
      updateTime(stop, start, end);
    } else Object.assign(stop, { start, end });
    if (scheduling) {
      const tooLateForFlight = end > (free.freeUntil ?? Infinity);
      const notReady = start < ready;
      if (notReady && fixed(stop)) {
        report(day.date, previous ?? stop, `Overlaps a booked commitment: ${stop.name} starts at ${localClockLabel(start)}.`, 'latest');
      } else if (tooLateForFlight) {
        report(day.date, stop, `The visit must end by ${localClockLabel(free.freeUntil)} to leave time for the flight.`, 'latest');
      } else if (start < (free.freeFrom ?? 0)) {
        report(day.date, stop, `Allow time to get from the airport. Activities can start from ${localClockLabel(free.freeFrom)}.`);
      } else if (notReady) {
        const reason = previousPlace && travel && previousPlace.end + travel >= (previous?.end ?? 0)
          ? `Your previous stop ends at ${localClockLabel(previousPlace.end)}. Allow ${travel} minutes to get to ${stop.name}.`
          : previous ? `${previous.name} ends at ${localClockLabel(previous.end)}.` : 'That start is before the itinerary day begins.';
        report(day.date, stop, reason);
      } else if (closed || start < midnight + opens || end > midnight + closes) {
        report(day.date, stop, 'Outside the activity’s saved opening hours.', end > midnight + closes ? 'latest' : undefined);
      } else if (end > midnight + RULES.dayEnd) {
        report(day.date, stop, 'The visit ends after the itinerary day finishes.', 'latest');
      }
    }
    previous = stop;
    if (isPhysicalStop(stop)) previousPlace = stop;
  }

  for (const id of day.stopIds) saveTransferSnapshot(plan, plan.stops[id]);
}

function insertAtTime(plan, day, requested, id, start) {
  const next = day.stopIds.findIndex((candidate) => (requested.get(candidate) ?? activityTimes(plan.stops[candidate])?.start ?? Infinity) > start);
  day.stopIds.splice(next < 0 ? day.stopIds.length : next, 0, id);
  requested.set(id, start);
}

function groupConflicts(ctx, before, plan, touched, places, report) {
  for (const person of ctx.personalRows) {
    const personal = withPersonalChanges(before, person.changes);
    const owner = ctx.people[person.user_id]?.name ?? 'another traveller';
    for (const date of touched) {
      const sharedDay = plan.days.find((day) => day.date === date);
      const ownDay = personal.days.find((day) => day.date === date);
      for (const sharedId of sharedDay.stopIds) {
        const stop = plan.stops[sharedId];
        if (!changed(before.stops[sharedId], stop)) continue;
        for (const id of ownDay.stopIds) {
          const own = personal.stops[id];
          if (!own.myChange || id === sharedId || !Number.isFinite(own.start)) continue;
          const overlap = stop.start < own.end && own.start < stop.end;
          const travel = isPhysicalStop(own) && isPhysicalStop(stop) ? transfer(plan, stop, own, places) : 0;
          const gap = Math.max(stop.start - own.end, own.start - stop.end);
          if (overlap || gap < travel) {
            report(date, stop, `Clashes with ${owner}’s personal stop, ${own.name}.`);
          }
        }
      }
    }
  }
}

// Try a full visit in gaps between the current day's commitments. The draft is
// recalculated after applying the suggestion, including any movable later stops.
function availableStarts(plan, day, stop, free, places, reservations, preceding = []) {
  const midnight = plan.days.indexOf(day) * DAY;
  const { opens, closes, closed } = bounds(places.get(stop.placeId), day.date);
  if (closed) return [];
  const gap = (from, to) => isPhysicalStop(from) && isPhysicalStop(to) ? transfer(plan, from, to, places) : 0;
  const earliest = Math.max(midnight + RULES.dayStart, midnight + opens, free.freeFrom ?? 0,
    ...preceding.filter((item) => Number.isFinite(item.end)).map((item) => item.end + gap(item, stop)));
  const latest = Math.min(midnight + RULES.dayEnd, midnight + closes, free.freeUntil ?? Infinity) - stop.minutes;
  const taken = reservations.filter((item) => item.id !== stop.id && Number.isFinite(item.start) && Number.isFinite(item.end));
  const from = [], to = [];
  for (const item of taken) {
    from.push(item.end + gap(item, stop));
    to.push(item.start - gap(stop, item) - stop.minutes);
  }
  const fits = (start) => start >= earliest && start <= latest &&
    taken.every((_, index) => start >= from[index] || start <= to[index]);
  const first = [earliest, ...from].sort((a, b) => a - b).find(fits);
  const last = [latest, ...to].sort((a, b) => b - a).find(fits);
  return first === undefined ? [] : [first, last];
}

function timeFixes(ctx, plan, shared, personal, issues, free, places, requested) {
  const memberPlans = personal ? [] : ctx.personalRows.map(({ changes }) => withPersonalChanges(shared, changes));
  return issues.map(({ direction, ...issue }) => {
    const day = plan.days.find(({ date }) => date === issue.date);
    const stop = plan.stops[issue.id];
    if (!day.stopIds.includes(issue.id) || !stop || fixed(stop)) return issue;
    const boundsForDay = (entry, includeLaterStops) => {
      const items = entry.stopIds.map((id) => plan.stops[id]);
      const stopIndex = entry.stopIds.indexOf(stop.id);
      const reserved = items.filter((item, index) => includeLaterStops || fixed(item) || requested.has(item.id) || index < stopIndex);
      for (const member of memberPlans) {
        const memberDay = member.days.find(({ date }) => date === entry.date);
        reserved.push(...memberDay.stopIds.map((id) => member.stops[id]).filter((item) => item.myChange));
      }
      return availableStarts(plan, entry, stop, free, places, reserved, includeLaterStops ? [] : items.slice(0, stopIndex));
    };
    const [first, last] = boundsForDay(day, direction === 'latest');
    const sameDay = direction === 'latest' ? last : first;
    if (sameDay !== undefined && clockOf(sameDay) !== stop.startTime) {
      return { ...issue, suggestedStart: clockOf(sameDay), reorder: direction === 'latest' };
    }
    const alternativeDays = plan.days.flatMap((entry) => {
      if (entry === day || entry.stopIds.some((id) => plan.stops[id].placeId && plan.stops[id].placeId === stop.placeId)) return [];
      const [slot] = boundsForDay(entry, true);
      return slot === undefined ? [] : [{ date: entry.date, start: clockOf(slot) }];
    });
    return { ...issue, alternativeDays };
  });
}

export function makeItineraryDraft(ctx, body, catalogue) {
  if (!['personal', 'group'].includes(body?.scope) || !Array.isArray(body.operations) || body.operations.length > 150) {
    throw new ApiError(422, 'invalid_edit', 'Choose an edit scope and a valid set of changes.');
  }
  const personal = body.scope === 'personal';
  const own = ctx.personalRows.find((row) => row.user_id === ctx.userId);
  const shared = ctx.group.itinerary;
  const before = personal ? withPersonalChanges(shared, own?.changes) : shared;
  const plan = structuredClone(before);
  plan.transfers ??= { between: {}, fallbackMinutes: RULES.travelGap };
  const places = new Map(catalogue.map((place) => [place.id, place]));
  const free = groupFreeTime({
    selections: personal ? { [ctx.userId]: ctx.group.selections[ctx.userId] } : ctx.group.selections,
    dates: ctx.dates, rules: RULES,
  });
  const issues = [];
  const report = (date, stop, reason, direction) => {
    if (!issues.some((issue) => issue.date === date && issue.id === stop.id)) {
      issues.push({ date, id: stop.id, name: stop.name, reason, direction });
    }
  };
  const touched = new Set();
  const schedules = new Set();
  const requested = new Map();
  const moved = new Set();
  const reviewMoves = new Set();
  const restored = [];
  const conflicts = [];
  let overrides = own?.changes ?? {};

  for (const op of body.operations) {
    if (!op || !validId(op.id)) throw new ApiError(422, 'invalid_edit', 'That stop is unavailable.');
    const day = plan.days.find(({ date }) => date === op.date);
    if (!day) throw new ApiError(422, 'invalid_edit', 'That day is unavailable.');
    const existing = day.stopIds.indexOf(op.id);
    const current = plan.stops[op.id];
    const original = before.stops[op.id];
    if (op.expected && original && changed(op.expected, original) && !conflicts.some((entry) => entry.id === op.id && entry.date === op.date)) {
      conflicts.push({ date: day.date, id: op.id, name: original.name, reason: 'This stop changed in the latest itinerary.' });
    }
    touched.add(day.date);
    if (op.type === 'add' || op.type === 'replace') {
      const place = places.get(op.placeId);
      const minutes = op.type === 'add' ? op.minutes : place?.estimated_duration_min ?? place?.visitMinutes ?? current?.minutes;
      if (!place || !validDuration(minutes) || (op.type === 'add' && (!validClock(op.start) || Object.hasOwn(plan.stops, op.id))) ||
        (op.type === 'replace' && (existing < 0 || fixed(current)))) {
        report(day.date, { id: op.id, name: current?.name ?? place?.name ?? 'New activity' }, 'This activity or its scheduled time is unavailable.');
        continue;
      }
      if (day.stopIds.some((id) => id !== op.id && plan.stops[id].placeId === place.id)) {
        report(day.date, { id: op.id, name: place.name }, 'This activity is already on this day.');
        continue;
      }
      const stop = newStop(op.id, place, minutes);
      if (current?.personalAddition) stop.personalAddition = true;
      addTransfers(plan, place, catalogue);
      if (op.type === 'add') {
        if (personal) stop.personalAddition = true;
        insertAtTime(plan, day, requested, op.id, minutesOf(op.start));
      } else {
        const times = activityTimes(current);
        if (times) updateTime(stop, plan.days.indexOf(day) * DAY + times.start, plan.days.indexOf(day) * DAY + times.start + minutes);
        if (times) requested.set(op.id, times.start);
      }
      plan.stops[op.id] = stop;
    } else if (op.type === 'restore' && personal) {
      restored.push(op);
      overrides = restoreGroupStop(overrides, op.date, op.id);
      const sharedDay = shared.days.find(({ date }) => date === day.date);
      if (sharedDay.stopIds.includes(op.id)) {
        plan.stops[op.id] = { ...shared.stops[op.id] };
        if (existing < 0) day.stopIds.push(op.id);
        day.stopIds.sort((a, b) => (activityTimes(plan.stops[a])?.start ?? Infinity) - (activityTimes(plan.stops[b])?.start ?? Infinity));
      } else if (existing >= 0) day.stopIds.splice(existing, 1);
      requested.delete(op.id);
    } else if (existing < 0 || fixed(current)) {
      report(day.date, { id: op.id, name: current?.name ?? op.name ?? 'Activity' }, 'This stop changed or is a fixed booking.');
      continue;
    } else if (op.type === 'time' && validClock(op.start)) {
      const targetDay = op.targetDate ? plan.days.find(({ date }) => date === op.targetDate) : day;
      if (!targetDay) throw new ApiError(422, 'invalid_edit', 'That day is unavailable.');
      if (targetDay !== day || op.reorder) {
        if (targetDay !== day && current.placeId && targetDay.stopIds.some((id) => plan.stops[id].placeId === current.placeId)) {
          report(day.date, current, 'This activity is already on that day.');
          continue;
        }
        const id = targetDay === day ? op.id : op.newId;
        if (targetDay !== day && (!validId(id) || Object.hasOwn(plan.stops, id))) {
          throw new ApiError(422, 'invalid_edit', 'That activity could not be moved to another day.');
        }
        if (id !== op.id) {
          plan.stops[id] = { ...current, id };
          if (personal) plan.stops[id].personalAddition = true;
        }
        day.stopIds.splice(existing, 1);
        insertAtTime(plan, targetDay, requested, id, minutesOf(op.start));
        touched.add(targetDay.date);
        schedules.add(targetDay.date);
      } else requested.set(op.id, minutesOf(op.start));
      reviewMoves.delete(op.id);
    } else if (op.type === 'duration' && validDuration(op.minutes) && (op.start === undefined || validClock(op.start))) {
      current.minutes = op.minutes;
      delete current.durationLabel;
      if (op.start) {
        day.stopIds.splice(existing, 1);
        insertAtTime(plan, day, requested, op.id, minutesOf(op.start));
      }
    } else if (op.type === 'remove') {
      day.stopIds.splice(existing, 1);
      requested.delete(op.id);
    } else if (op.type === 'move') {
      const target = day.stopIds.indexOf(op.target);
      if (target < 0 || target === existing) {
        report(day.date, current, 'The stop it was moved beside has changed.');
        continue;
      }
      day.stopIds.splice(existing, 1);
      day.stopIds.splice(target, 0, op.id);
      requested.delete(op.id);
      moved.add(op.id);
      if (op.reviewTime && target < existing) reviewMoves.add(op.id);
      else reviewMoves.delete(op.id);
    } else throw new ApiError(422, 'invalid_edit', 'That edit is unavailable.');
    schedules.add(day.date);
  }

  for (const date of schedules) {
    const day = plan.days.find((entry) => entry.date === date);
    const original = before.days.find((entry) => entry.date === date);
    reschedule(plan, day, original, before, requested, moved, reviewMoves, free, places, report);
    if (personal) overrides = personalChangesFor(overrides, before, plan, date);
  }
  for (const { date, id } of restored) {
    const current = plan.days.find((day) => day.date === date).stopIds.includes(id) ? plan.stops[id] : null;
    const original = shared.days.find((day) => day.date === date).stopIds.includes(id) ? shared.stops[id] : null;
    if ((!current && !original) || !changed(original, current)) overrides = restoreGroupStop(overrides, date, id);
  }
  if (!personal) groupConflicts(ctx, shared, plan, touched, places, report);

  const updates = [...touched].flatMap((date) => {
    const from = before.days.find((day) => day.date === date);
    const to = plan.days.find((day) => day.date === date);
    return [...new Set([...to.stopIds, ...from.stopIds])].flatMap((id) => {
      const old = from.stopIds.includes(id) ? before.stops[id] : null;
      const next = to.stopIds.includes(id) ? plan.stops[id] : null;
      if (!changed(old, next) && !(moved.has(id) && from.stopIds.indexOf(id) !== to.stopIds.indexOf(id))) return [];
      return [{ date, id, previous: old, next }];
    });
  });
  const personalRevisions = Object.fromEntries(ctx.personalRows.map(({ user_id, updated_at }) => [user_id, updated_at]));
  return {
    plan, overrides, issues: timeFixes(ctx, plan, shared, personal, issues, free, places, requested),
    updates, conflicts, revisions: { group: ctx.itineraryRevision, personal: own?.updated_at ?? null, people: personalRevisions },
  };
}
