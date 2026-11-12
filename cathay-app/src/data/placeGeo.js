// Where each voted place really is, and what OpenStreetMap says about its opening hours.
// Looked up on 11 November 2026 from OpenStreetMap (Overpass API). No key was needed.
//
//   lat, lon     real coordinates (of the named object itself, not a bus stop beside it)
//   osm          the OpenStreetMap object the coordinates came from
//   osmHours     opening hours exactly as OpenStreetMap writes them, or null when the map has none
//
// Only three places have hours on the map. For the rest, the hours in
// src/api/mock/placeData.js are still our own estimates and must be shown as estimates.
// Where OpenStreetMap's hours disagree with the estimate, the estimate is NOT changed here:
// `note` records the difference so a person decides.
//
// Credit required by the licence (ODbL): "© OpenStreetMap contributors".
// Pure data, no imports, so Node tests can read it.
export const OSM_CREDIT = '© OpenStreetMap contributors';

export const PLACE_GEO = {
  food: { lat: 35.66536, lon: 139.77053, osm: 'way/606978548', osmHours: null },
  scenery: {
    lat: 35.6851,
    lon: 139.70989,
    osm: 'way/15772074',
    osmHours:
      'Mo off; Oct 01-Mar 14 Tu-Su 09:00-16:30; Mar 15-Jun 30 Tu-Su 09:00-18:00; Jul 01-Aug 20 Tu-Su 09:00-19:00; Aug 21-Sep 30 Tu-Su 09:00-18:00; Dec 29-Jan 03 off',
    closedWeekdays: [1], // 0 = Sunday, 1 = Monday ... as written in osmHours ("Mo off")
    note: 'Closed on Mondays. 21–24 Nov 2026 is Sat–Tue, so the garden is closed on Monday 23 Nov. The estimate 09:00–16:30 matches the autumn hours.',
  },
  culture: {
    lat: 35.71345,
    lon: 139.79595,
    osm: 'way/173154847',
    osmHours: 'Mo-Su 06:00-17:00',
    note: 'The temple grounds open at 06:00; our estimate of 09:00 is later, which is safe.',
  },
  shopping: { lat: 35.66518, lon: 139.71256, osm: 'way/375809333', osmHours: null },
  ameyoko: { lat: 35.71002, lon: 139.77454, osm: 'node/4496960001', osmHours: null },
  yokocho: { lat: 35.69307, lon: 139.6995, osm: 'node/4154282189', osmHours: null },
  shibuya: { lat: 35.65948, lon: 139.70057, osm: 'node/291758776', osmHours: null },
  tower: {
    lat: 35.65856,
    lon: 139.74544,
    osm: 'relation/4247312',
    osmHours: 'Mo-Su 09:00-23:00',
    note: 'The map says 09:00–23:00; our estimate closes at 21:30, which is safe.',
  },
  roppongi: { lat: 35.66045, lon: 139.72928, osm: 'way/153924771', osmHours: null },
  zojoji: {
    lat: 35.65719,
    lon: 139.74821,
    osm: 'way/744348814',
    osmHours: '24/7',
    note: 'The map says the grounds are always open; our estimate of 09:00–17:00 is the temple hall, which is safe.',
  },
  azabudai: { lat: 35.66143, lon: 139.74195, osm: 'way/741596532', osmHours: null },
};
