// Calls the Python itinerary service (server/, Explorer -> Curator -> Scheduler -> Quality Check).
// The service holds the Poe, Tavily and Google keys; the browser only sends trip details and votes.
// Switch it on with VITE_ITINERARY_WORKFLOW_PROVIDER in .env (any value except empty, "mock" or "off").
// With it off, the app keeps using the four sample places and the built-in sample plan.
import { ApiError } from '../errors';
import { USERS } from './db';
import { DESTINATION_AIRPORT, windowOf } from './flightData';

const FLAG = String(import.meta.env?.VITE_ITINERARY_WORKFLOW_PROVIDER ?? '').trim().toLowerCase();
export const AI_ENABLED = FLAG !== '' && FLAG !== 'mock' && FLAG !== 'off';

const BASE = '/api/itinerary';
const TIMEOUT_MS = 180000;

// A request already running is shared (React's development double-render must not start two searches).
const running = new Map();
function once(key, work) {
  if (!running.has(key)) running.set(key, work().finally(() => running.delete(key)));
  return running.get(key);
}

// 424 (failed dependency) so the UI shows the message instead of the generic "could not reach" text.
async function callService(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'The itinerary planner took too long. Try again.'
      : 'The itinerary planner is not running. Start it with "npm run dev:api", then try again.';
    throw new ApiError(424, 'planner_unreachable', message);
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => null);
  // Vite answers 500/502/504 with no JSON when the Python service is not running.
  if (!response.ok && !data) {
    throw new ApiError(424, 'planner_unreachable', 'The itinerary planner is not running. Start it with "npm run dev:api", then try again.');
  }
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : 'The itinerary planner could not finish. Try again.';
    throw new ApiError(response.status === 422 ? 422 : 424, data?.code ?? 'agent_failed', message, data?.fields ?? null);
  }
  return data;
}

// What the agents need to know about the trip, taken from the group and each member's chosen flights.
function contextFor(group) {
  const win = windowOf(group.datesLabel);
  const flights = group.members
    .map((member) => {
      const choice = group.selections?.[member.userId];
      if (!choice?.outbound && !choice?.return) return null;
      return {
        member: USERS[member.userId].name,
        origin: USERS[member.userId].airport.code,
        destination: DESTINATION_AIRPORT.code,
        arrival_date: choice.outbound?.date ?? null,
        arrival_time: choice.outbound?.arriveTime ?? null,
        departure_date: choice.return?.date ?? null,
        departure_time: choice.return?.departTime ?? null,
      };
    })
    .filter(Boolean);
  return {
    destination: group.destination,
    dates: { start: win.start, end: win.end },
    group_size: group.members.length,
    interests: [],
    budget_per_person: 15000,
    budget_level: 'moderate',
    pace: 'moderate',
    flights,
  };
}

// Explorer + Curator: search the web and return places to swipe on, with the sources they cite.
export function discover(group) {
  return once(`discover:${group.id}`, async () => {
    const result = await callService('/discover', { context: contextFor(group) });
    return { places: result.places, sources: result.sources };
  });
}

// Scheduler + Quality Check: `cards` are the places with like_count and total_members added.
export function planTrip(group, cards, sources) {
  return once(`plan:${group.id}`, async () => (await callService('/plan', { context: contextFor(group), cards, sources })).plan);
}
