// Travel time between two places, estimated from their coordinates. An ESTIMATE, not a
// timetable: it has no train data. Label it "estimated travel" wherever it is shown.
//
// The rule
//   1. Straight-line distance (haversine formula: distance over the curve of the Earth).
//   2. Streets are not straight, so multiply by 1.3.
//   3. Up to 1.2 km: walk at 5 km/h.
//      Further: a train or bus, 10 minutes for waiting and walking to the station, then 25 km/h
//      (a typical average in central Tokyo once stops are counted).
//   4. Round up to a whole 5 minutes, and never less than 5.
//
// Pure functions: no browser, storage or network. Run `npm test` to check the examples.

const EARTH_RADIUS_KM = 6371;
const DETOUR = 1.3;
const WALK_LIMIT_KM = 1.2;
const WALK_KMH = 5;
const TRANSIT_KMH = 25;
const TRANSIT_OVERHEAD_MIN = 10;

const radians = (degrees) => (degrees * Math.PI) / 180;

// Straight-line kilometres between two { lat, lon } points.
export function distanceKm(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Estimated minutes to get from a to b, in whole 5-minute steps.
export function travelMinutes(a, b) {
  const km = distanceKm(a, b) * DETOUR;
  const minutes = km <= WALK_LIMIT_KM ? (km / WALK_KMH) * 60 : TRANSIT_OVERHEAD_MIN + (km / TRANSIT_KMH) * 60;
  return Math.max(5, Math.ceil(minutes / 5) * 5);
}

// Every pair: { [fromId]: { [toId]: minutes } }. `geo` is { [id]: { lat, lon } }.
export function travelTable(geo) {
  const ids = Object.keys(geo);
  return Object.fromEntries(
    ids.map((from) => [from, Object.fromEntries(ids.filter((to) => to !== from).map((to) => [to, travelMinutes(geo[from], geo[to])]))]),
  );
}
