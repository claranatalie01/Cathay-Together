// Destination photo library (Unsplash, free licence). Each photo has two
// pre-cropped files in /assets/photos: `-cover` (880x600) and `-thumb` (240x240).
// Photographer credits: add `credit` when confirmed from the Unsplash photo page.
const photo = (id, place, alt) => ({
  id,
  place,
  alt,
  cover: `/assets/photos/${id}-cover.jpg`,
  thumb: `/assets/photos/${id}-thumb.jpg`,
  credit: null,
});

const PHOTOS = {
  tokyo: [
    photo('tokyo-tower-golden', 'Tokyo', 'Tokyo Tower glowing orange in golden-hour light above the city'),
    photo('tokyo-tower-blue-hour', 'Tokyo', 'Tokyo Tower lit up at blue hour with Tokyo Bay behind'),
    photo('tokyo-skyline-night', 'Tokyo', 'Tokyo skyline at night with Tokyo Tower in the distance'),
    photo('tokyo-tower-street-train', 'Tokyo', 'Tokyo Tower at dusk seen down a street, with a train passing in front'),
    photo('shibuya-neon-signs', 'Shibuya', 'Neon signs lining a Shibuya street at night'),
    photo('shinjuku-neon-night', 'Shinjuku', 'Neon-lit Shinjuku street at night with a tall hotel tower'),
    photo('ueno-street-dusk', 'Ueno', 'Crowded Ueno side street at dusk with hanging signs and lanterns'),
  ],
};

// Pick a stable photo for a destination so a group keeps its picture.
// The demo only supports Tokyo, so `destination` is kept for the call sites and a future second city.
// eslint-disable-next-line no-unused-vars
export function pickPhoto(destination = '', key = '') {
  const list = PHOTOS.tokyo;
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

// Header photo for the flight-booking screens (from the original Cathay Together prototype).
export const WING_PHOTO = {
  id: 'aircraft-wing',
  place: 'In flight',
  alt: 'Aircraft wing above the clouds at sunset',
  cover: '/assets/52e22.png',
};

const PLACE_FALLBACKS = new Map([
  ['food', '/assets/ab624.png'],
  ['culture', '/assets/culture-photo.jpg'],
  ['nature', '/assets/e1c39.png'],
  ['shopping', '/assets/shopping-photo.jpg'],
  ['views', '/assets/photos/tokyo-tower-blue-hour-cover.jpg'],
  ['art', '/assets/culture-photo.jpg'],
  ['entertainment', '/assets/photos/shinjuku-neon-night-cover.jpg'],
  ['nightlife', '/assets/photos/shinjuku-neon-night-cover.jpg'],
  ['adventure', '/assets/photos/tokyo-skyline-night-cover.jpg'],
  ['relaxation', '/assets/e1c39.png'],
]);

// A photo host can remove an image or block embedding after the deck is saved.
export function fallbackTo(category) {
  const fallback = PLACE_FALLBACKS.get(category) ?? PLACE_FALLBACKS.get('culture');
  return (event) => {
    const img = event.currentTarget;
    if (img.getAttribute('src') !== fallback) img.src = fallback;
  };
}
