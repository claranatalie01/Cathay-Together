#!/usr/bin/env node
// Saves a snapshot of real Cathay Pacific and HK Express schedules from the OAG Flight Info API.
//
//   npm run fetch:oag
//
// Why a snapshot: the app never calls OAG itself. Calling it from the browser would expose the
// key, and a slow API could break a live demo. Instead this script runs once, on your own
// machine, and writes src/data/oagSnapshot.json. The app reads that file.
//
// What it fetches (all on the trip dates, direct flights only, passenger flights only):
//   Hong Kong -> Tokyo Haneda          the direct Cathay and HK Express flights
//   each home airport -> Hong Kong     so a traveller can connect through Hong Kong
//   Tokyo Haneda -> Hong Kong, and Hong Kong -> each home airport, for the way back
// Flights from other airlines are not fetched: the demo is for Cathay, and HK Express is part of
// the Cathay Group. Cathay and HK Express have no direct flights to Haneda from the other airports.
//
// The key: OAG_SUBSCRIPTION_KEY in cathay-app/.env (git-ignored). It is never printed.
// Limits (organiser guide): 1,000 requests per 30 days and 10 results per request. This script
// follows the "next page" link and stops at MAX_REQUESTS so it cannot use the quota up.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const outPath = fileURLToPath(new URL('../src/data/oagSnapshot.json', import.meta.url));

const HOME_AIRPORTS = ['SHA', 'PVG', 'SIN', 'TPE', 'ICN', 'MNL', 'BKK', 'KUL', 'CAN'];
const HUB = 'HKG';
const DESTINATION = 'HND';
const CARRIERS = 'CX,UO';
const OUTBOUND_DAYS = ['2026-11-20', '2026-11-21', '2026-11-22'];
const RETURN_DAYS = ['2026-11-22', '2026-11-23', '2026-11-24'];
const MAX_REQUESTS = 150;

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const key = (process.env.OAG_SUBSCRIPTION_KEY ?? readEnvFile(envPath).OAG_SUBSCRIPTION_KEY ?? '').trim();
if (!key) {
  console.error(`\nOAG_SUBSCRIPTION_KEY is not set.\n  Add it to ${envPath}\n  (the key is on your Subscriptions page at developers.oag.com).\n`);
  process.exit(1);
}

const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Every (from, to, date) to ask for, without repeats.
const wanted = new Map();
const want = (from, to, date) => wanted.set(`${from}-${to}-${date}`, { from, to, date });
OUTBOUND_DAYS.forEach((d) => {
  HOME_AIRPORTS.forEach((home) => want(home, HUB, d)); // the first leg
  want(HUB, DESTINATION, d); // the second leg, the same day ...
  want(HUB, DESTINATION, addDays(d, 1)); // ... or early next day after a late arrival
});
RETURN_DAYS.forEach((d) => {
  want(DESTINATION, HUB, d);
  HOME_AIRPORTS.forEach((home) => {
    want(HUB, home, d);
    want(HUB, home, addDays(d, 1));
  });
});

let requests = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PAUSE_MS = 1500; // OAG answers HTTP 429 when requests come too fast

async function get(url) {
  for (let attempt = 1; ; attempt += 1) {
    if (++requests > MAX_REQUESTS) throw new Error(`Stopped after ${MAX_REQUESTS} requests to protect the quota.`);
    const res = await fetch(url, { headers: { 'Subscription-Key': key } });
    await sleep(PAUSE_MS);
    if (res.status === 429 && attempt < 5) {
      // Too many requests: wait as long as OAG asks (or 15 seconds), then try the same one again.
      const wait = Number(res.headers.get('retry-after'));
      await sleep((Number.isFinite(wait) && wait > 0 ? wait : 15) * 1000);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error(`OAG refused the key (HTTP ${res.status}).`);
    if (!res.ok) throw new Error(`OAG answered HTTP ${res.status} for a request.`);
    return res.json();
  }
}

const stamp = (part) => `${part.date.utc}T${part.time.utc}:00Z`;

async function fetchRoute({ from, to, date }) {
  const query = new URLSearchParams({ DepartureDateTime: date, DepartureAirport: from, ArrivalAirport: to, CarrierCode: CARRIERS, CodeType: 'IATA', Codeshare: 'OPERATING', Limit: '10', version: 'v2' });
  let url = `https://api.oag.com/flight-instances/?${query}`;
  const found = [];
  for (let page = 0; url && page < 6; page += 1) {
    const body = await get(url);
    found.push(...(body.data ?? []));
    url = body.paging?.next || '';
  }
  return found
    // Scheduled passenger flights with no stop on the way (freighters are service type F).
    .filter((f) => f.flightType === 'Scheduled' && f.serviceType?.iata === 'J' && (f.segmentInfo?.numberOfStops ?? 0) === 0)
    .filter((f) => f.departure.date.local === date)
    .map((f) => ({
      flightNo: `${f.carrier.iata}${f.flightNumber}`,
      carrier: f.carrier.iata,
      from: f.departure.airport.iata,
      to: f.arrival.airport.iata,
      departLocal: `${f.departure.date.local}T${f.departure.time.local}`,
      arriveLocal: `${f.arrival.date.local}T${f.arrival.time.local}`,
      departAt: stamp(f.departure),
      arriveAt: stamp(f.arrival),
      minutes: f.elapsedTime,
    }));
}

const flights = [];
const empty = [];
for (const route of wanted.values()) {
  const found = await fetchRoute(route);
  if (found.length === 0) empty.push(`${route.from}-${route.to} ${route.date}`);
  flights.push(...found);
}

// The same flight can be found twice (a day-end query and the next day's); keep one of each.
const unique = [...new Map(flights.map((f) => [`${f.flightNo}-${f.departAt}`, f])).values()].sort((a, b) => a.departAt.localeCompare(b.departAt));

const snapshot = {
  source: 'OAG Flight Info API (api.oag.com/flight-instances, version v2)',
  fetchedAt: new Date().toISOString(),
  carriers: CARRIERS.split(','),
  note: 'Real schedules, direct passenger flights only. Prices are not part of this data: the app uses fictional prices.',
  flights: unique,
};
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`\nSaved ${unique.length} flights to src/data/oagSnapshot.json using ${requests} requests.`);
const count = (from, to) => unique.filter((f) => f.from === from && f.to === to).length;
console.log(`  ${HUB} -> ${DESTINATION}: ${count(HUB, DESTINATION)}   ${DESTINATION} -> ${HUB}: ${count(DESTINATION, HUB)}`);
HOME_AIRPORTS.forEach((home) => console.log(`  ${home} -> ${HUB}: ${count(home, HUB)}   ${HUB} -> ${home}: ${count(HUB, home)}`));
if (empty.length) console.log(`\nNo Cathay or HK Express flights found for ${empty.length} searches (normal for airports they do not serve on that day).`);
console.log(`Quota used by this run: ${requests} of 1,000 requests per 30 days.\n`);
