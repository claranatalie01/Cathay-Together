// Mock endpoints for Flow C: the group board and individual booking. Documented in docs/api-contract.md.
// Everything is derived from the flights each member has chosen (group.selections), so the board, the
// Members page, the flight results and the payment screens always agree.
import { ApiError } from '../errors';
import { USERS, getDb, saveDb } from './db';
import { DESTINATION_AIRPORT, dayLabel } from './flightData';
import { currentUser, findGroup } from './helpers';

const HOLD_MS = 20 * 60 * 1000;

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

function memberOf(group, userId) {
  return group.members.find((m) => m.userId === userId) ?? null;
}

function memberContext(params) {
  const db = getDb();
  const user = currentUser(db);
  const group = findGroup(db, params.id);
  const member = memberOf(group, user.id);
  if (!member) throw new ApiError(403, 'not_a_member', 'Only group members can do that.');
  return { group, user, member };
}

const sum = (selection) => (selection.outbound?.price ?? 0) + (selection.return?.price ?? 0);

function hash(text) {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Points on one timeline column: members sharing a time share a point.
function column({ group, direction, viewerId }) {
  const key = direction === 'outbound' ? 'arriveTime' : 'departTime';
  const byTime = new Map();
  let date = null;
  group.members.forEach((member) => {
    const chosen = group.selections?.[member.userId]?.[direction];
    if (!chosen) return;
    date = chosen.date;
    const time = chosen[key];
    const point = byTime.get(time) ?? { time, minutes: toMinutes(time), names: [], includesViewer: false };
    point.names.push(member.userId === viewerId ? 'You' : USERS[member.userId].name);
    point.includesViewer = point.includesViewer || member.userId === viewerId;
    byTime.set(time, point);
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

function boardFor(group, viewerId) {
  const members = group.members
    .map((member, index) => {
      const user = USERS[member.userId];
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
  // People invited but not joined yet are part of the group too: shown as "Invited", with no flights.
  (group.invitations ?? [])
    .filter((invite) => invite.status === 'pending')
    .forEach((invite) => {
      const user = USERS[invite.userId];
      members.push({ userId: user.id, name: user.name, initial: user.initial, airport: user.airport, status: 'invited', isViewer: false, hasFlights: false, arrive: null, leave: null });
    });
  const arrivals = column({ group, direction: 'outbound', viewerId });
  const departures = column({ group, direction: 'return', viewerId });
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
function bookingFor(group, userId) {
  const selection = group.selections?.[userId] ?? {};
  const record = group.bookings?.[userId] ?? {};
  const now = Date.now();
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

function ensureTrip(group, user, member) {
  const selection = group.selections?.[user.id];
  if (!selection?.outbound || !selection?.return) {
    throw new ApiError(409, 'no_flights', 'Choose your outbound and return flights first.');
  }
  if (member.status === 'booked') throw new ApiError(409, 'already_booked', 'You have already booked this trip.');
  group.bookings = group.bookings ?? {};
  return (group.bookings[user.id] = group.bookings[user.id] ?? {});
}

function startHold(record) {
  record.hold = { expiresAt: Date.now() + HOLD_MS };
}

export const boardRoutes = [
  // GET /groups/:id/board
  ['GET', '/groups/:id/board', ({ params }) => {
    const { group, user } = memberContext(params);
    return { status: 200, body: boardFor(group, user.id) };
  }],

  // GET /groups/:id/booking
  ['GET', '/groups/:id/booking', ({ params }) => {
    const { group, user } = memberContext(params);
    return { status: 200, body: bookingFor(group, user.id) };
  }],

  // POST /groups/:id/booking/start – "Confirm and pay"
  ['POST', '/groups/:id/booking/start', ({ params }) => {
    const { group, user, member } = memberContext(params);
    const record = ensureTrip(group, user, member);
    if (!record.hold || record.hold.expiresAt <= Date.now()) startHold(record);
    saveDb();
    return { status: 200, body: bookingFor(group, user.id) };
  }],

  // POST /groups/:id/booking/release – "Change flight": gives up the hold
  ['POST', '/groups/:id/booking/release', ({ params }) => {
    const { group, user } = memberContext(params);
    if (group.bookings?.[user.id]) delete group.bookings[user.id].hold;
    saveDb();
    return { status: 200, body: bookingFor(group, user.id) };
  }],

  // POST /groups/:id/booking/pay – simulated payment; no card data is ever taken
  ['POST', '/groups/:id/booking/pay', ({ params }) => {
    const { group, user, member } = memberContext(params);
    const record = ensureTrip(group, user, member);
    if (!record.hold || record.hold.expiresAt <= Date.now()) {
      throw new ApiError(410, 'hold_expired', 'Your payment time ran out. Start again to hold your fare.');
    }
    const total = bookingFor(group, user.id).total;
    const seed = hash(`${group.id}:${user.id}`);
    record.ticket = {
      reference: seed.toString(36).toUpperCase().padStart(6, '0').slice(0, 6),
      ticketNumber: `160 ${String(1000000000 + (seed % 9000000000))}`,
      paidAt: Date.now(),
      total,
    };
    delete record.hold;
    member.status = 'booked';
    saveDb();
    return { status: 200, body: bookingFor(group, user.id) };
  }],
];
