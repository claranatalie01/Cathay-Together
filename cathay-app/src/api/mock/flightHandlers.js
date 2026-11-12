// Mock endpoints for flight booking (Flow B). Documented in docs/api-contract.md.
import { ApiError } from '../errors';
import { USERS, getDb, saveDb } from './db';
import {
  DESTINATION_AIRPORT,
  FARE_IDS,
  OUTBOUND_DATES,
  othersTimes,
  withTiming,
  RETURN_DATES,
  cabinsFor,
  comparison,
  faresFor,
  makeSelection,
  suggestionsFor,
  findFlight,
  flightsFor,
  isAvailable,
  longLabel,
  lowestEconomy,
  shortRange,
  tabLabel,
  windowOf,
} from './flightData';
import { currentUser, findGroup } from './helpers';

// The group the signed-in user belongs to, and that user's home airport.
function memberContext(params) {
  const db = getDb();
  const user = currentUser(db);
  const group = findGroup(db, params.id);
  if (!group.members.some((m) => m.userId === user.id)) {
    throw new ApiError(403, 'not_a_member', 'Only group members can book flights.');
  }
  return { group, user, home: USERS[user.id].airport, window: windowOf(group.datesLabel) };
}

export const flightRoutes = [
  // GET /groups/:id/flights/search-form – prefilled "Book a trip" form for the signed-in member
  ['GET', '/groups/:id/flights/search-form', ({ params }) => {
    const { home, window } = memberContext(params);
    return {
      status: 200,
      body: {
        origin: home,
        destination: DESTINATION_AIRPORT,
        departDate: window.start,
        returnDate: window.end,
        departLabel: longLabel(window.start),
        returnLabel: longLabel(window.end),
        cabins: cabinsFor(home.code).map(({ id, label }) => ({ id, label })),
        passengers: '1 Adult',
      },
    };
  }],

  // GET /groups/:id/flights?direction=outbound|return&date=YYYY-MM-DD&cabin=economy|premium|business
  ['GET', '/groups/:id/flights', ({ params, query }) => {
    const { group, user, home, window } = memberContext(params);
    const direction = query.direction === 'return' ? 'return' : 'outbound';
    const others = othersTimes({ group, viewerId: user.id, direction });
    const cabins = cabinsFor(home.code);
    const cabin = cabins.some((c) => c.id === query.cabin) ? query.cabin : 'economy';
    const dates = direction === 'outbound' ? OUTBOUND_DATES : RETURN_DATES;
    const date = query.date || (direction === 'outbound' ? window.start : window.end);
    if (!dates.includes(date) || !isAvailable(date)) {
      throw new ApiError(422, 'date_unavailable', 'No flights on that date. Choose another day.');
    }
    const from = direction === 'outbound' ? home : DESTINATION_AIRPORT;
    const to = direction === 'outbound' ? DESTINATION_AIRPORT : home;
    return {
      status: 200,
      body: {
        direction,
        route: { from, to },
        tripLabel: 'Return',
        rangeLabel: shortRange(window.start, window.end),
        date,
        cabin,
        cabins,
        dates: dates.map((d) => ({
          date: d,
          label: tabLabel(d),
          priceFrom: lowestEconomy({ home, direction, date: d }),
        })),
        groupWindow: { others: others.map(({ userId, time }) => ({ name: USERS[userId].name, time })) },
        flights: withTiming(flightsFor({ home, direction, date, cabin }), { direction, others }),
      },
    };
  }],

  // GET /groups/:id/flights/suggestions?direction=&cabin= – one flight per member, ranked three ways
  ['GET', '/groups/:id/flights/suggestions', ({ params, query }) => {
    const { group, user, window } = memberContext(params);
    const direction = query.direction === 'return' ? 'return' : 'outbound';
    const members = group.members.map((m) => ({
      userId: m.userId,
      name: USERS[m.userId].name,
      home: USERS[m.userId].airport,
      chosen: group.selections?.[m.userId]?.[direction],
    }));
    const cabins = cabinsFor(USERS[user.id].airport.code);
    const cabin = cabins.some((c) => c.id === query.cabin) ? query.cabin : 'economy';
    const body = suggestionsFor({ members, direction, date: direction === 'outbound' ? window.start : window.end, cabin });
    return { status: 200, body: { ...body, viewerId: user.id } };
  }],

  // GET /groups/:id/flights/:flightId/fares?cabin= – fare types for one flight
  ['GET', '/groups/:id/flights/:flightId/fares', ({ params, query }) => {
    const { home } = memberContext(params);
    const cabins = cabinsFor(home.code);
    const cabin = cabins.some((c) => c.id === query.cabin) ? query.cabin : 'economy';
    const base = findFlight({ home, flightId: params.flightId });
    if (!base) throw new ApiError(404, 'flight_not_found', 'That flight is no longer available.');
    const delta = cabins.find((c) => c.id === cabin).delta;
    const flight = { ...base, priceFrom: base.economyPrice + delta };
    return {
      status: 200,
      body: {
        direction: flight.id.startsWith('return') ? 'return' : 'outbound',
        flight,
        cabin,
        cabins,
        fares: faresFor(flight),
        comparison: comparison(),
        upgrade: { from: 'light', to: 'essential' },
      },
    };
  }],

  // GET /groups/:id/flights/selection – the signed-in member's chosen flights so far
  ['GET', '/groups/:id/flights/selection', ({ params }) => {
    const { group } = memberContext(params);
    const user = currentUser(getDb());
    return { status: 200, body: group.selections?.[user.id] ?? {} };
  }],

  // PUT /groups/:id/flights/selection  { flightId, cabin, fare } – saves the outbound or return choice
  ['PUT', '/groups/:id/flights/selection', ({ params, body }) => {
    const { group, home } = memberContext(params);
    const user = currentUser(getDb());
    const base = findFlight({ home, flightId: String(body?.flightId ?? '') });
    if (!base) throw new ApiError(404, 'flight_not_found', 'That flight is no longer available.');
    const chosen = makeSelection({ home, flightId: base.id, cabin: body?.cabin, fare: body?.fare });
    if (!chosen) {
      throw new ApiError(422, 'validation_failed', 'Choose a cabin and a fare.', { fare: 'Choose a fare.' });
    }
    const direction = base.id.startsWith('return') ? 'return' : 'outbound';
    group.selections = group.selections ?? {};
    const mine = (group.selections[user.id] = group.selections[user.id] ?? {});
    mine[direction] = chosen;
    // Outbound chosen again after a different outbound: the return choice is kept (route is the same).
    const member = group.members.find((m) => m.userId === user.id);
    if (mine.outbound && mine.return && member && member.status === 'browsing') member.status = 'picked';
    saveDb();
    return { status: 200, body: mine };
  }],
];
