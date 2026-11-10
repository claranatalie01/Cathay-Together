// The four Tokyo suggestions (one per category), from the original Cathay Together prototype.
// Fictional demo content: budgets are rough yen estimates, not real prices.
export const PLACES = [
  {
    id: 'food',
    category: 'Food',
    name: 'Tsukiji Outer Market',
    area: 'Tsukiji · Chuo City',
    description: 'Taste fresh seafood bowls and warm tamagoyaki as you wander Tokyo’s lively market lanes.',
    budget: '¥2,000–3,500',
    savedNote: '¥2,000–3,500 est.',
    duration: '1–1.5 hrs',
    bestTime: 'Morning',
    tip: 'Go before 10am; some stalls are cash-only.',
    photo: '/assets/ab624.png',
    thumb: '/assets/2c161.png',
    alt: 'Seafood rice bowl at Tsukiji Outer Market',
  },
  {
    id: 'scenery',
    category: 'Scenery',
    name: 'Shinjuku Gyoen',
    area: 'Shinjuku · Garden escape',
    description: 'Slow down beside still ponds, landscaped gardens and the first golden colours of autumn.',
    budget: '¥500 entry',
    savedNote: '¥500 entry',
    duration: '1.5–2 hrs',
    bestTime: 'Afternoon',
    tip: 'Check opening days; last entry is before closing.',
    photo: '/assets/e1c39.png',
    thumb: '/assets/e1c39.png',
    alt: 'Autumn garden and pond at Shinjuku Gyoen',
  },
  {
    id: 'culture',
    category: 'Culture',
    name: 'Sensō-ji & Asakusa',
    area: 'Asakusa · Taito City',
    description: 'Step through the lantern gate, explore temple courtyards and browse Nakamise’s small shops.',
    budget: '¥0 entry · ¥1,000 extras',
    savedNote: 'Free entry',
    duration: '1.5–2 hrs',
    bestTime: 'Morning',
    tip: 'Arrive early for quieter courtyards and photos.',
    photo: '/assets/culture-photo.jpg',
    thumb: '/assets/71254.png',
    alt: 'Senso-ji temple and five-storey pagoda',
  },
  {
    id: 'shopping',
    category: 'Shopping',
    name: 'Omotesando stroll',
    area: 'Omotesando · Shibuya',
    description: 'Discover design-led boutiques, striking architecture and tucked-away cafés along leafy streets.',
    budget: '¥1,000–3,000 café stop',
    savedNote: '¥1,000–3,000 café stop',
    duration: '2 hrs',
    bestTime: 'Afternoon',
    tip: 'Shopping spend is extra; browsing is free.',
    photo: '/assets/shopping-photo.jpg',
    thumb: '/assets/shopping-photo.jpg',
    alt: 'A tree-lined street in Omotesando',
  },
];

export const PLACE_IDS = PLACES.map((place) => place.id);

// Members who are already "picked" or "booked" start with saved preferences (demo seed).
export const SEED_CHOICES = {
  gaudi: { food: 'like', scenery: 'pass', culture: 'like', shopping: 'pass' },
  kabe: { food: 'pass', scenery: 'like', culture: 'like', shopping: 'like' },
  clara: { food: 'like', scenery: 'pass', culture: 'like', shopping: 'pass' },
};
