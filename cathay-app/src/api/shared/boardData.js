// Board and booking responses from stored group selections and booking records.
import { DESTINATION_AIRPORT, dayLabel } from './flightData';
import { UTC_OFFSET_HOURS, meetingInstant } from '../../algorithms/arrivalWindow.js';

function memberOf(group, userId) {
  return group.members.find((m) => m.userId === userId) ?? null;
}

const sum = (selection) => (selection.outbound?.price ?? 0) + (selection.return?.price ?? 0);

// Points on one timeline column: members sharing a time share a point.
function column({ group, direction, viewerId, people }) {
  const key = direction === 'outbound' ? 'arriveTime' : 'departTime';
  const byTime = new Map();
  let date = null;
  group.members.forEach((member) => {
    const chosen = group.selections?.[member.userId]?.[direction];
    if (!chosen) return;
    date = chosen.date;
    const time = chosen[key];
    // Position by the exact moment (as minutes on the Tokyo clock, counted across days),
    // so a landing after midnight sits after one before it.
    const instant = meetingInstant(chosen, direction);
    const point = byTime.get(instant) ?? { time, minutes: Math.round(instant / 60000) + UTC_OFFSET_HOURS[DESTINATION_AIRPORT.code] * 60, names: [], includesViewer: false };
    point.names.push(member.userId === viewerId ? 'You' : people[member.userId].name);
    point.includesViewer = point.includesViewer || member.userId === viewerId;
    byTime.set(instant, point);
  });
  const points = [...byTime.values()].sort((a, b) => a.minutes - b.minutes);
  const spanMinutes = points.length > 1 ? points[points.length - 1].minutes - points[0].minutes : 0;
  return { dateLabel: date ? dayLabel(date) : null, points, spanMinutes };
}

function legOf(selection, direction) {
  if (!selection) return null;
  const outbound = direction === 'outbound';
  return {
    dateLabel: dayLabel(selection.date),
    time: outbound ? selection.arriveTime : selection.departTime,
    airport: DESTINATION_AIRPORT.code,
    flightNo: selection.flightNo,
  };
}

const STATUS_ORDER = { booked: 0, picked: 1, browsing: 2 };

// `people` is { [userId]: { id, name, initial, airport } } for joined group members.
export function boardFor(group, viewerId, people) {
  const members = group.members
    .map((member, index) => {
      const user = people[member.userId];
      const chosen = group.selections?.[member.userId] ?? {};
      const hasFlights = Boolean(chosen.outbound && chosen.return);
      return {
        userId: member.userId,
        name: user.name,
        initial: user.initial,
        airport: user.airport,
        status: member.status,
        isViewer: member.userId === viewerId,
        index,
        hasFlights,
        arrive: legOf(chosen.outbound, 'outbound'),
        leave: legOf(chosen.return, 'return'),
      };
    })
    .sort((a, b) => (a.isViewer ? -1 : b.isViewer ? 1 : 0) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.index - b.index)
    .map(({ index, ...rest }) => rest);
  const arrivals = column({ group, direction: 'outbound', viewerId, people });
  const departures = column({ group, direction: 'return', viewerId, people });
  const viewer = members.find((m) => m.isViewer);
  return {
    group: { id: group.id, name: group.name, destination: group.destination, datesLabel: group.datesLabel },
    destination: DESTINATION_AIRPORT,
    summary: {
      members: members.length,
      joined: members.filter((m) => m.status !== 'invited').length,
      picked: members.filter((m) => m.status === 'picked').length,
      booked: members.filter((m) => m.status === 'booked').length,
    },
    members,
    timeline: { arrivals, departures },
    viewerAction: viewer.status === 'booked' ? 'booked' : viewer.hasFlights ? 'book' : 'pick',
  };
}

// The signed-in member's trip: chosen flights, what they cost, and where payment stands.
// `now` is the clock the hold is measured against (the shared backend passes the database's).
export function bookingFor(group, userId, now = Date.now()) {
  const selection = group.selections?.[userId] ?? {};
  const record = group.bookings?.[userId] ?? {};
  const hold = record.hold && record.hold.expiresAt > now ? record.hold : null;
  const base = sum(selection);
  const member = memberOf(group, userId);
  return {
    status: member.status,
    outbound: selection.outbound ?? null,
    return: selection.return ?? null,
    total: base,
    hold: hold ? { expiresAt: hold.expiresAt } : null,
    holdExpired: Boolean(record.hold && !hold && !record.ticket),
    ticket: record.ticket ?? null,
    serverNow: now,
  };
}
