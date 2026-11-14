import catalog from './tokyoCategoryIdeas.json';

export const PREFERENCE_CATEGORIES = [
  { id: 'food', label: 'Food & Drink' },
  { id: 'culture', label: 'Culture & History' },
  { id: 'nature', label: 'Nature & Parks' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'views', label: 'Views & Landmarks' },
  { id: 'art', label: 'Art & Museums' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'relaxation', label: 'Relaxation' },
];

const knownKeys = new Set(PREFERENCE_CATEGORIES.map(({ id }) => id));
const legacyKeys = { relax: 'relaxation', nightlife: 'entertainment', adventure: 'entertainment' };

function categoryFor(place) {
  const key = (place.category_key ?? place.category ?? '').toLowerCase();
  // Older decks used broad categories for museum, landmark and entertainment cards.
  const detail = [place.name, ...(place.tags ?? [])].join(' ');
  if (['culture', 'scenery', 'nature', 'adventure'].includes(key)) {
    if (/\bmuseums?\b|\bgaller(?:y|ies)\b|teamlab/i.test(detail)) return 'art';
    if (/\b(?:tower|crossing|observator\w*|viewpoint|city view|skyline|shibuya sky)\b/i.test(detail)) return 'views';
  }
  if (key === 'scenery') return 'nature';
  return legacyKeys[key] ?? (knownKeys.has(key) ? key : 'culture');
}

export function groupPreferencePlaces(places) {
  const groups = Object.fromEntries(PREFERENCE_CATEGORIES.map(({ id }) => [id, []]));
  for (const place of places) groups[categoryFor(place)].push(place);
  return PREFERENCE_CATEGORIES.map((category) => ({
    ...category,
    places: groups[category.id].slice(0, 5),
  }));
}

// Keep stored place IDs and votes intact. Add a bundled Tokyo idea only where research left a category empty.
export function withCategoryIdeas(places, destination) {
  if (!places.length || !/^tokyo\b/i.test(destination)) return places;
  const existing = new Set(groupPreferencePlaces(places).filter((category) => category.places.length).map(({ id }) => id));
  return [...places, ...catalog.ideas.filter((place) => !existing.has(place.category_key))];
}
