import tokyoIdeas from '../../data/tokyoCategoryIdeas.json';
import { LEGACY_PLACES } from '../../data/legacyPlaces';
import { categoryFor, PREFERENCE_CATEGORIES } from '../../data/preferenceCategories';

export const placeNameKey = (name) => name.trim().toLowerCase().normalize('NFKD').replace(/\p{Mark}/gu, '');
export const visitMinutes = (place) => place.estimated_duration_min ?? place.visitMinutes ?? 60;

export function itineraryCatalogue(places, destination) {
  const extras = /^tokyo\b/i.test(destination) ? [...tokyoIdeas.ideas, ...LEGACY_PLACES] : [];
  return [...new Map([...extras, ...places].map((place) => [place.id, place])).values()];
}

export function catalogueResponse(ctx, plannedDays, categories) {
  const planned = new Set(plannedDays.flatMap(({ items }) => items.filter(({ kind }) => kind === 'place')
    .flatMap((item) => [item.placeId, placeNameKey(item.name)])));
  const choices = ctx.group.preferences[ctx.userId]?.choices ?? {};
  const likedNames = new Set(ctx.places.filter((place) => choices[place.id] === 'like').map((place) => placeNameKey(place.name)));
  const passedNames = new Set(ctx.places.filter((place) => choices[place.id] === 'pass').map((place) => placeNameKey(place.name)));
  const likedCategories = new Set(ctx.places.filter((place) => choices[place.id] === 'like').map(categoryFor));
  const savedCategories = new Set(categories ?? []);
  const labels = Object.fromEntries(PREFERENCE_CATEGORIES.map(({ id, label }) => [id, label]));
  const places = itineraryCatalogue(ctx.places, ctx.group.destination);
  const unique = new Map();
  for (const place of [...places].reverse()) {
    const name = placeNameKey(place.name);
    if (!unique.has(name)) unique.set(name, place);
  }

  return [...unique.values()].map((place) => {
    const name = placeNameKey(place.name);
    const category = categoryFor(place);
    const liked = likedNames.has(name);
    const affinity = (savedCategories.has(category) ? 4 : 0) + (likedCategories.has(category) ? 2 : 0);
    const score = planned.has(place.id) || planned.has(name) || passedNames.has(name) ? 0
      : affinity ? affinity + Number(!liked) : Number(liked);
    return {
      id: place.id, name: place.name, area: place.area, thumb: place.thumb || place.photo,
      category: labels[category], categoryKey: category, minutes: visitMinutes(place),
      scheduled: planned.has(place.id) || planned.has(name),
      score,
    };
  });
}
