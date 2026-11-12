// Trip options and imagery. The demo only supports Tokyo, 21–24 November 2026.
export const DESTINATIONS = ['Tokyo, Japan'];

export const DATE_WINDOWS = {
  'nov-21-24': { label: 'Nov 21–24, 2026', start: '2026-11-21', end: '2026-11-24', available: true },
};

export const DATE_OPTIONS = Object.entries(DATE_WINDOWS).map(([value, { label, available }]) => ({ value, label, available }));

export const DEFAULT_GROUP_VALUES = {
  name: 'Tokyo together',
  destination: 'Tokyo, Japan',
  dates: 'nov-21-24',
};

export const GROUP_NAME_MAX_LENGTH = 30;

import { pickPhoto } from './photos';

const thumbOf = (p) => ({ src: p.thumb, alt: p.alt });
const coverOf = (p) => ({ src: p.cover, alt: p.alt });

export const TRIP_PHOTO = thumbOf(pickPhoto('Tokyo', 'tokyo-together'));

export const INVITE_PHOTO = coverOf(pickPhoto('Tokyo', 'tokyo-together'));


// Photo per group: stable for the same group, varied across groups.
export function photoFor(destination, key) {
  return thumbOf(pickPhoto(destination, key));
}
