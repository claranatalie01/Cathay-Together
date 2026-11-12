// Shared-mode answers to the app's requests, backed by Supabase.
// Same shape as src/api/mock/handlers.js: [method, path pattern, handler], and each
// handler returns { status, body } as described in docs/api-contract.md.
//
// Connected: profile, group, flight, board, booking, preference and itinerary endpoints.
// Every other request answers
// "not connected yet" (see http.js) until its endpoint is added here.
//
// The group RPCs in supabase/migrations decide who may read or change groups and memberships.
import { ApiError } from '../errors';
import { getSupabase } from '../supabaseClient';
// Fixtures, not user data: the date window and the sample fares are the same in both modes.
import { DATE_WINDOWS } from '../mock/db';
import {
  DESTINATION_AIRPORT,
  OUTBOUND_DATES,
  RETURN_DATES,
  cabinsFor,
  comparison,
  faresFor,
  findFlight,
  flightsFor,
  isAvailable,
  longLabel,
  lowestEconomy,
  makeSelection,
  othersTimes,
  shortRange,
  suggestionsFor,
  tabLabel,
  withTiming,
} from '../mock/flightData';
// The same builders the mock uses, fed with real data, so both modes answer alike.
import { boardFor, bookingFor } from '../mock/boardHandlers';
import { applyItineraryEdit, bodyFor as itineraryBody, buildItinerary, stopBody } from '../mock/itineraryHandlers';
import { datesBetween, votesFor } from '../mock/itineraryData';
import { PLACE_IDS } from '../mock/placeData';
import { responseFor as preferencesBody } from '../mock/preferenceHandlers';

const UNREACHABLE = () => new ApiError(503, 'service_unavailable', 'The service is temporarily unavailable.');

// The signed-in person's id, taken from their verified session. Never from the request.
async function requireUserId(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw UNREACHABLE();
  if (!data.session) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  return data.session.user.id;
}

// Runs one database query and returns its rows, or throws the app's error type.
async function rows(query) {
  const { data, error } = await query;
  if (error) throw UNREACHABLE();
  return data;
}

// What the database functions refuse with, and the error the app shows for each.
const REFUSALS = {
  unauthenticated: [401, 'Sign in to continue.'],
  profile_not_found: [404, 'This account has no profile yet. Ask the team to add it.'],
  group_not_found: [404, 'That group does not exist.'],
  invite_not_found: [404, 'This invitation link is not valid.'],
  invalid_invite_code: [403, 'That invite code does not match this group.'],
  creator_required: [403, 'Only the creator can delete this group.'],
  creator_cannot_leave: [409, 'The creator can delete this group from the group list.'],
  validation_failed: [422, 'Some fields need attention.'],
  no_flights: [409, 'Choose your outbound and return flights first.'],
  already_booked: [409, 'You have already booked this trip.'],
  hold_expired: [410, 'Your payment time ran out. Start again to hold your fare.'],
  choices_incomplete: [422, 'Choose Pass or Like for every suggestion first.'],
};

// Calls one database function and returns its JSON answer.
async function call(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (!error) return data;
  const refusal = REFUSALS[error.message];
  if (refusal) throw new ApiError(refusal[0], error.message, refusal[1]);
  throw UNREACHABLE();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Group ids are UUIDs here. Anything else cannot be a group, so do not ask the database.
function groupId(params) {
  if (!UUID.test(params.id)) throw new ApiError(404, 'group_not_found', 'That group does not exist.');
  return params.id;
}

// Invitations this person declined. There is no table for this yet, so it is remembered
// only in this browser tab until it is reloaded.
const declined = new Set();

export function clearDeclinedInvitations() {
  declined.clear();
}

const DESTINATIONS = { HND: 'Tokyo, Japan' };

// Turns the database's group JSON into the Group shape in docs/api-contract.md.
function toGroup(raw, userId) {
  const window = Object.values(DATE_WINDOWS).find((w) => w.start === raw.startDate && w.end === raw.endDate);
  const isMember = raw.isMember;
  return {
    id: raw.id,
    name: raw.name,
    destination: DESTINATIONS[raw.destinationAirport] ?? raw.destinationAirport,
    datesLabel: window?.label ?? `${raw.startDate} – ${raw.endDate}`,
    code: raw.code,
    // A real link into this app, so a friend can open it on their own phone.
    inviteUrl: `${globalThis.location.origin}/invite/${raw.code}`,
    creatorId: raw.creatorId,
    inviteCopied: raw.inviteCopied,
    members: raw.members.map((m) => ({ ...m, initial: m.name.charAt(0).toUpperCase() })),
    viewerId: isMember ? userId : null,
    viewerRole: isMember ? (raw.creatorId === userId ? 'creator' : 'member') : 'invitee',
    invitation: isMember ? null : declined.has(raw.id) ? 'declined' : 'pending',
  };
}

// Same checks and messages as the mock, so the Create group form behaves the same.
function validateCreate(body) {
  const fields = {};
  const name = String(body?.name ?? '').trim();
  const destination = String(body?.destination ?? '').trim();
  const window = DATE_WINDOWS[String(body?.dates ?? '')];
  if (!name) fields.name = 'Enter a group name.';
  else if (name.length > 30) fields.name = 'Use 30 characters or fewer.';
  if (!destination) fields.destination = 'Enter a destination.';
  else if (!/^tokyo\b/i.test(destination)) fields.destination = 'Only Tokyo, Japan is available in this demo.';
  if (!body?.dates) fields.dates = 'Choose your travel dates.';
  else if (!window?.available) fields.dates = 'Only Nov 21–24, 2026 is available in this demo.';
  if (Object.keys(fields).length) {
    throw new ApiError(422, 'validation_failed', 'Some fields need attention.', fields);
  }
  return { name, window };
}

async function getMe(supabase, userId) {
  const [profile] = await rows(supabase.from('profiles').select('id, display_name, home_airport').eq('id', userId));
  if (!profile) {
    throw new ApiError(404, 'profile_not_found', 'This account has no profile yet. Ask the team to add it.');
  }
  const [airport] = await rows(supabase.from('airports').select('code, city').eq('code', profile.home_airport));
  return {
    id: profile.id,
    name: profile.display_name,
    initial: profile.display_name.charAt(0).toUpperCase(),
    airport: airport ?? { code: profile.home_airport, city: profile.home_airport },
  };
}

// Shared start of every handler: the Supabase client and who is signed in.
async function context() {
  const supabase = await getSupabase();
  return { supabase, userId: await requireUserId(supabase) };
}

// ---- Profile --------------------------------------------------------------------------------------
// A person's name and home airport live in `profiles`. The access rules let them create and
// change only their own row.
async function listHomeAirports(supabase) {
  const list = await rows(supabase.from('airports').select('code, city, latitude, longitude').neq('code', DESTINATION_AIRPORT.code).order('city'));
  return list.map((a) => ({ code: a.code, city: a.city, lat: Number(a.latitude), lon: Number(a.longitude) }));
}

const profileRoutes = [
  // GET /airports – the airports offered as a home airport (not the destination).
  ['GET', '/airports', async () => {
    const { supabase } = await context();
    return { status: 200, body: { airports: await listHomeAirports(supabase) } };
  }],

  // PUT /me   { name, airport } – create or change the signed-in person's profile.
  ['PUT', '/me', async ({ body }) => {
    const { supabase, userId } = await context();
    const name = String(body?.name ?? '').trim();
    const airport = String(body?.airport ?? '');
    const offered = await listHomeAirports(supabase);
    const fields = {};
    if (!name) fields.name = 'Enter your name.';
    else if (name.length > 40) fields.name = 'Use 40 characters or fewer.';
    if (!offered.some((a) => a.code === airport)) fields.airport = 'Choose where you fly from.';
    if (Object.keys(fields).length) throw new ApiError(422, 'validation_failed', 'Some fields need attention.', fields);
    const { error } = await supabase.from('profiles').upsert({ id: userId, display_name: name, home_airport: airport }, { onConflict: 'id' });
    if (error) throw UNREACHABLE();
    return { status: 200, body: await getMe(supabase, userId) };
  }],
];

const groupRoutes = [
  // GET /groups – the groups the person belongs to, newest first.
  ['GET', '/groups', async () => {
    const { supabase, userId } = await context();
    const list = await call(supabase, 'list_my_groups');
    return { status: 200, body: { groups: list.map((raw) => toGroup(raw, userId)) } };
  }],

  // GET /date-windows – fixture fares from the person's own airport.
  ['GET', '/date-windows', async () => {
    const { supabase, userId } = await context();
    const me = await getMe(supabase, userId);
    const windows = Object.entries(DATE_WINDOWS)
      .filter(([, w]) => w.available)
      .map(([id, w]) => {
        const fares = [];
        for (let t = Date.parse(`${w.start}T12:00:00Z`); t <= Date.parse(`${w.end}T12:00:00Z`); t += 86400000) {
          const date = new Date(t).toISOString().slice(0, 10);
          fares.push({ date, priceFrom: lowestEconomy({ home: me.airport, direction: 'outbound', date }) });
        }
        return { id, label: w.label, start: w.start, end: w.end, fares };
      });
    return { status: 200, body: { origin: me.airport.code, destination: DESTINATION_AIRPORT.code, currency: 'HKD', windows } };
  }],

  // POST /groups – the caller becomes the creator and first member.
  ['POST', '/groups', async ({ body }) => {
    const { name, window } = validateCreate(body);
    const { supabase, userId } = await context();
    const raw = await call(supabase, 'create_group', { group_name: name, trip_start: window.start, trip_end: window.end });
    return { status: 201, body: toGroup(raw, userId) };
  }],

  // GET /groups/:id – members only; to anyone else the group does not exist.
  ['GET', '/groups/:id', async ({ params }) => {
    const id = groupId(params);
    const { supabase, userId } = await context();
    return { status: 200, body: toGroup(await call(supabase, 'get_group', { target_group: id }), userId) };
  }],

  // POST /groups/:id/join   { inviteCode } – the database checks the code.
  ['POST', '/groups/:id/join', async ({ params, body }) => {
    const id = groupId(params);
    const { supabase, userId } = await context();
    const raw = await call(supabase, 'join_group', { target_group: id, code: String(body?.inviteCode ?? '') });
    declined.delete(id);
    return { status: 200, body: toGroup(raw, userId) };
  }],

  ['DELETE', '/groups/:id', async ({ params }) => {
    const id = groupId(params);
    const { supabase } = await context();
    await call(supabase, 'delete_group', { target_group: id });
    declined.delete(id);
    return { status: 200, body: null };
  }],

  ['DELETE', '/groups/:id/membership', async ({ params }) => {
    const id = groupId(params);
    const { supabase } = await context();
    await call(supabase, 'leave_group', { target_group: id });
    return { status: 200, body: null };
  }],

  // POST /groups/:id/decline   { inviteCode } – not stored in the database (see `declined`).
  ['POST', '/groups/:id/decline', async ({ params, body }) => {
    const id = groupId(params);
    const { supabase, userId } = await context();
    const raw = await call(supabase, 'preview_invitation', { code: String(body?.inviteCode ?? '') });
    if (raw.id !== id) throw new ApiError(403, 'invalid_invite_code', 'That invite code does not match this group.');
    if (raw.isMember) throw new ApiError(409, 'already_member', 'You are already a member of this group.');
    declined.add(id);
    return { status: 200, body: toGroup(raw, userId) };
  }],

  // POST /groups/:id/invite-copied
  ['POST', '/groups/:id/invite-copied', async ({ params }) => {
    const id = groupId(params);
    const { supabase, userId } = await context();
    return { status: 200, body: toGroup(await call(supabase, 'mark_invite_copied', { target_group: id }), userId) };
  }],

  // GET /invitations/:code – the group behind an invite link, for any signed-in person.
  ['GET', '/invitations/:code', async ({ params }) => {
    const { supabase, userId } = await context();
    return { status: 200, body: toGroup(await call(supabase, 'preview_invitation', { code: params.code }), userId) };
  }],
];

// ---- Flights -------------------------------------------------------------------------------------
// The flight catalogue is generated by src/api/mock/flightData.js (fictional flights and
// prices, the same in both modes). What is stored in Supabase is each member's CHOICE, one row
// per person and direction in `flight_selections`. The access rules in the database let a member
// read the group's choices and change only their own.

// The group, the viewer's own airport and every member's chosen flights.
async function flightContext(params) {
  const id = groupId(params);
  const { supabase, userId } = await context();
  const raw = await call(supabase, 'get_group', { target_group: id });
  const me = raw.members.find((m) => m.userId === userId);
  const stored = await rows(supabase.from('flight_selections').select('user_id, direction, offer_id, cabin, fare').eq('group_id', id));
  // Rebuild each full selection from the stored offer, cabin and fare, using that member's own airport.
  const selections = {};
  for (const row of stored) {
    const member = raw.members.find((m) => m.userId === row.user_id);
    if (!member) continue;
    const chosen = makeSelection({ home: member.airport, flightId: row.offer_id, cabin: row.cabin, fare: row.fare });
    if (chosen) (selections[row.user_id] ??= {})[row.direction] = chosen;
  }
  return { supabase, userId, id, raw, home: me.airport, window: { start: raw.startDate, end: raw.endDate }, group: { members: raw.members, selections } };
}

const directionOfFlight = (flightId) => (flightId.startsWith('return') ? 'return' : 'outbound');

const flightRoutes = [
  // GET /groups/:id/flights/search-form
  ['GET', '/groups/:id/flights/search-form', async ({ params }) => {
    const { home, window } = await flightContext(params);
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

  // GET /groups/:id/flights?direction=&date=&cabin=
  ['GET', '/groups/:id/flights', async ({ params, query }) => {
    const { userId, home, window, group } = await flightContext(params);
    const direction = query.direction === 'return' ? 'return' : 'outbound';
    const others = othersTimes({ group, viewerId: userId, direction });
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
        dates: dates.map((d) => ({ date: d, label: tabLabel(d), priceFrom: lowestEconomy({ home, direction, date: d }) })),
        groupWindow: { others: others.map(({ userId: id, time }) => ({ name: group.members.find((m) => m.userId === id)?.name ?? '', time })) },
        flights: withTiming(flightsFor({ home, direction, date, cabin }), { direction, others }),
      },
    };
  }],

  // GET /groups/:id/flights/suggestions?direction=&cabin=
  ['GET', '/groups/:id/flights/suggestions', async ({ params, query }) => {
    const { userId, home, window, group } = await flightContext(params);
    const direction = query.direction === 'return' ? 'return' : 'outbound';
    const cabin = cabinsFor(home.code).some((c) => c.id === query.cabin) ? query.cabin : 'economy';
    const members = group.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      home: m.airport,
      chosen: group.selections[m.userId]?.[direction],
    }));
    const body = suggestionsFor({ members, direction, date: direction === 'outbound' ? window.start : window.end, cabin });
    return { status: 200, body: { ...body, viewerId: userId } };
  }],

  // GET /groups/:id/flights/:flightId/fares?cabin=
  ['GET', '/groups/:id/flights/:flightId/fares', async ({ params, query }) => {
    const { home } = await flightContext(params);
    const cabins = cabinsFor(home.code);
    const cabin = cabins.some((c) => c.id === query.cabin) ? query.cabin : 'economy';
    const base = findFlight({ home, flightId: params.flightId });
    if (!base) throw new ApiError(404, 'flight_not_found', 'That flight is no longer available.');
    const flight = { ...base, priceFrom: base.economyPrice + cabins.find((c) => c.id === cabin).delta };
    return {
      status: 200,
      body: {
        direction: directionOfFlight(flight.id),
        flight,
        cabin,
        cabins,
        fares: faresFor(flight),
        comparison: comparison(),
        upgrade: { from: 'light', to: 'essential' },
      },
    };
  }],

  // GET /groups/:id/flights/selection – the signed-in member's own choices
  ['GET', '/groups/:id/flights/selection', async ({ params }) => {
    const { userId, group } = await flightContext(params);
    return { status: 200, body: group.selections[userId] ?? {} };
  }],

  // PUT /groups/:id/flights/selection  { flightId, cabin, fare } – saves one direction
  ['PUT', '/groups/:id/flights/selection', async ({ params, body }) => {
    const { supabase, userId, id, home, group } = await flightContext(params);
    const base = findFlight({ home, flightId: String(body?.flightId ?? '') });
    if (!base) throw new ApiError(404, 'flight_not_found', 'That flight is no longer available.');
    const chosen = makeSelection({ home, flightId: base.id, cabin: body?.cabin, fare: body?.fare });
    if (!chosen) throw new ApiError(422, 'validation_failed', 'Choose a cabin and a fare.', { fare: 'Choose a fare.' });
    // A paid trip is not changed from here. (Checked in the app only; the database does not stop it yet.)
    if (group.members.find((m) => m.userId === userId)?.status === 'booked') {
      throw new ApiError(409, 'already_booked', 'You have already booked this trip.');
    }
    const direction = directionOfFlight(base.id);
    // One row per person and direction: choosing again replaces the earlier choice.
    const { error } = await supabase.from('flight_selections').upsert(
      {
        group_id: id,
        user_id: userId,
        direction,
        offer_id: base.id,
        flight_no: chosen.flightNo,
        cabin: chosen.cabin,
        fare: chosen.fare,
        depart_at: chosen.departAt,
        arrive_at: chosen.arriveAt,
        price_minor: chosen.price * 100,
        currency: 'HKD',
      },
      { onConflict: 'group_id,user_id,direction' },
    );
    if (error) throw UNREACHABLE();
    return { status: 200, body: { ...(group.selections[userId] ?? {}), [direction]: chosen } };
  }],
];

// ---- Board, booking, preferences, itinerary ----------------------------------------------------
// These screens were built against the mock's "group" object. tripContext() loads the real rows
// and arranges them in that same shape, then the mock's own builders produce the answer.
//   want.votes      also load everyone's swipes
//   want.itinerary  also load the saved plan
async function tripContext(params, want = {}) {
  const base = await flightContext(params);
  const { supabase, userId, id, raw } = base;
  const shown = toGroup(raw, userId);
  const people = Object.fromEntries(shown.members.map((m) => [m.userId, { id: m.userId, name: m.name, initial: m.initial, airport: m.airport }]));
  const group = {
    id,
    name: shown.name,
    destination: shown.destination,
    datesLabel: shown.datesLabel,
    creatorId: shown.creatorId,
    members: raw.members.map((m) => ({ userId: m.userId, status: m.status })),
    invitations: [],
    selections: base.group.selections,
    bookings: {},
    preferences: Object.fromEntries(raw.members.map((m) => [m.userId, { choices: {}, saved: Boolean(m.preferencesSaved) }])),
    itinerary: null,
  };
  if (want.votes) {
    const votes = await rows(supabase.from('votes').select('user_id, place_id, choice').eq('group_id', id));
    votes.forEach((v) => {
      if (group.preferences[v.user_id] && PLACE_IDS.includes(v.place_id)) group.preferences[v.user_id].choices[v.place_id] = v.choice;
    });
  }
  if (want.itinerary) {
    const [saved] = await rows(supabase.from('itineraries').select('plan').eq('group_id', id));
    group.itinerary = saved?.plan ?? null;
  }
  const names = Object.fromEntries(Object.values(people).map((p) => [p.id, p.name]));
  return {
    supabase,
    userId,
    id,
    group,
    people,
    names,
    user: { id: userId },
    dates: datesBetween(raw.startDate, raw.endDate),
    votes: want.votes ? votesFor(group, names) : null,
  };
}

// The booking screens' answer, from the database's booking record. Times are milliseconds.
function bookingBody(ctx, record) {
  ctx.group.bookings[ctx.userId] = {
    hold: record.holdExpiresAt ? { expiresAt: record.holdExpiresAt } : undefined,
    ticket: record.paidAt
      ? { reference: record.reference, ticketNumber: record.ticketNumber, paidAt: record.paidAt, total: record.totalMinor / 100 }
      : undefined,
  };
  return bookingFor(ctx.group, ctx.userId, record.serverNow);
}

// A booking change, then the fresh state (the member's status may have just become "booked").
const bookingAction = (name) => async ({ params }) => {
  const id = groupId(params);
  const { supabase } = await context();
  const record = await call(supabase, name, { target_group: id });
  return { status: 200, body: bookingBody(await tripContext(params), record) };
};

const saveItinerary = async (ctx) => {
  const { error } = await ctx.supabase
    .from('itineraries')
    .upsert({ group_id: ctx.id, plan: ctx.group.itinerary, updated_by: ctx.userId, updated_at: new Date().toISOString() }, { onConflict: 'group_id' });
  if (error) throw UNREACHABLE();
};

const tripRoutes = [
  // GET /groups/:id/board – "View everyone's flights"
  ['GET', '/groups/:id/board', async ({ params }) => {
    const ctx = await tripContext(params);
    return { status: 200, body: boardFor(ctx.group, ctx.userId, ctx.people) };
  }],

  // GET /groups/:id/booking – the signed-in member's trip, total and payment state
  ['GET', '/groups/:id/booking', async ({ params }) => {
    const ctx = await tripContext(params);
    return { status: 200, body: bookingBody(ctx, await call(ctx.supabase, 'get_booking', { target_group: ctx.id })) };
  }],

  // The hold and the pretend payment are decided by the database (its clock, its total).
  ['POST', '/groups/:id/booking/start', bookingAction('start_booking')],
  ['POST', '/groups/:id/booking/release', bookingAction('release_booking')],
  ['POST', '/groups/:id/booking/pay', bookingAction('pay_booking')],

  // GET /groups/:id/preferences – the places, the caller's swipes and who is ready
  ['GET', '/groups/:id/preferences', async ({ params }) => {
    const ctx = await tripContext(params, { votes: true, itinerary: true });
    return { status: 200, body: preferencesBody(ctx.group, ctx.user, ctx.people) };
  }],

  // PUT /groups/:id/preferences/choices  { placeId, choice } – one swipe, one row in `votes`
  ['PUT', '/groups/:id/preferences/choices', async ({ params, body }) => {
    if (!PLACE_IDS.includes(body?.placeId) || !['like', 'pass'].includes(body?.choice)) {
      throw new ApiError(422, 'validation_failed', 'Choose Pass or Like for a suggestion.', { choice: 'Choose Pass or Like.' });
    }
    const ctx = await tripContext(params, { votes: true, itinerary: true });
    const { error } = await ctx.supabase
      .from('votes')
      .upsert({ group_id: ctx.id, user_id: ctx.userId, place_id: body.placeId, choice: body.choice, updated_at: new Date().toISOString() }, { onConflict: 'group_id,user_id,place_id' });
    if (error) throw UNREACHABLE();
    // The database has just un-marked "saved" for this member (a trigger); mirror that here.
    const mine = ctx.group.preferences[ctx.userId];
    mine.choices[body.placeId] = body.choice;
    mine.saved = false;
    return { status: 200, body: preferencesBody(ctx.group, ctx.user, ctx.people) };
  }],

  // POST /groups/:id/preferences/save – the database checks every place has an answer
  ['POST', '/groups/:id/preferences/save', async ({ params }) => {
    const ctx = await tripContext(params, { votes: true, itinerary: true });
    await call(ctx.supabase, 'save_preferences', { target_group: ctx.id, place_ids: PLACE_IDS });
    ctx.group.preferences[ctx.userId].saved = true;
    return { status: 200, body: preferencesBody(ctx.group, ctx.user, ctx.people) };
  }],

  // POST /groups/:id/itinerary/build – needs everyone ready; saved once so every phone shows the same plan
  ['POST', '/groups/:id/itinerary/build', async ({ params }) => {
    const ctx = await tripContext(params, { votes: true, itinerary: true });
    ctx.group.itinerary = buildItinerary(ctx);
    await saveItinerary(ctx);
    return { status: 200, body: itineraryBody(ctx) };
  }],

  // GET /groups/:id/itinerary
  ['GET', '/groups/:id/itinerary', async ({ params }) => {
    const ctx = await tripContext(params, { votes: true, itinerary: true });
    return { status: 200, body: itineraryBody(ctx) };
  }],

  // PUT /groups/:id/itinerary  { days: [{ date, stopIds }] } – remove and reorder stops
  ['PUT', '/groups/:id/itinerary', async ({ params, body }) => {
    const ctx = await tripContext(params, { votes: true, itinerary: true });
    applyItineraryEdit(ctx.group.itinerary, body);
    await saveItinerary(ctx);
    return { status: 200, body: itineraryBody(ctx) };
  }],

  // GET /groups/:id/itinerary/stops/:stopId
  ['GET', '/groups/:id/itinerary/stops/:stopId', async ({ params }) => {
    const ctx = await tripContext(params, { votes: true, itinerary: true });
    const initials = Object.fromEntries(Object.values(ctx.people).map((p) => [p.id, p.initial]));
    return { status: 200, body: stopBody(ctx, params.stopId, initials) };
  }],
];

export const routes = [
  // GET /me – the signed-in person, read from their row in `profiles`.
  ['GET', '/me', async () => {
    const { supabase, userId } = await context();
    return { status: 200, body: await getMe(supabase, userId) };
  }],
  ...profileRoutes,
  ...groupRoutes,
  ...flightRoutes,
  ...tripRoutes,
];
