// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLACE_GEO } from '../data/placeGeo.js';
import { distanceKm, savedTransferMinutes, travelMinutes, travelTable } from './travel.js';

test('one degree of latitude is about 111 km', () => {
  const km = distanceKm({ lat: 35, lon: 139 }, { lat: 36, lon: 139 });
  assert.ok(km > 110.5 && km < 111.9, `got ${km}`);
});

test('a place is zero distance from itself', () => {
  assert.equal(distanceKm(PLACE_GEO.tower, PLACE_GEO.tower), 0);
});

test('Tokyo Tower to Zōjō-ji is next door: a 5-minute walk', () => {
  assert.equal(travelMinutes(PLACE_GEO.tower, PLACE_GEO.zojoji), 5);
});

test('Sensō-ji to Shinjuku Gyoen is a long hop by train', () => {
  const minutes = travelMinutes(PLACE_GEO.culture, PLACE_GEO.scenery);
  assert.ok(minutes >= 30 && minutes <= 60, `got ${minutes}`);
});

test('travel time is the same in both directions and in steps of 5 minutes', () => {
  const ids = Object.keys(PLACE_GEO);
  const table = travelTable(PLACE_GEO);
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      assert.equal(table[a][b], table[b][a], `${a} <-> ${b}`);
      assert.equal(table[a][b] % 5, 0);
      assert.ok(table[a][b] >= 5);
    }
  }
  assert.equal(Object.keys(table).length, ids.length);
});

test('every place has real Tokyo coordinates', () => {
  for (const [id, geo] of Object.entries(PLACE_GEO)) {
    assert.ok(geo.lat > 35.5 && geo.lat < 35.8 && geo.lon > 139.6 && geo.lon < 139.9, id);
  }
});

test('a saved transfer is looked up by place id, or by the stop id for a generic meal', () => {
  const transfers = { fallbackMinutes: 30, between: { gyoen: { tower: 25, 'meal-lunch': 10 }, 'meal-lunch': { tower: 20 } } };
  const gyoen = { id: 'place-gyoen', placeId: 'gyoen' };
  const tower = { id: 'place-tower', placeId: 'tower' };
  const lunch = { id: 'meal-lunch' }; // no placeId
  assert.equal(savedTransferMinutes(transfers, gyoen, tower), 25);
  assert.equal(savedTransferMinutes(transfers, gyoen, lunch), 10);
  assert.equal(savedTransferMinutes(transfers, lunch, tower), 20);
  assert.equal(savedTransferMinutes(transfers, tower, { id: 'meal-dinner' }), 30, 'an unknown pair uses the fallback');
});
