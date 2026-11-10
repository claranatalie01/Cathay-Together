// Bottom navigation: icon files per active tab. The designs swap icon files
// (and tweak their offsets) depending on which tab is highlighted.
export const NAV_VARIANTS = {
  groups: {
    active: 'groups',
    icons: { profile: '2fa4b.svg', trips: 'e2721.svg', book: '47480.svg', groups: '5abd4.svg', home: 'cda7a.svg' },
  },
  groups2: {
    active: 'groups',
    icons: { profile: '2fa4b.svg', trips: 'e2721.svg', book: '47480.svg', groups: 'ee380.svg', home: '2fe35.svg' },
    groupsAlt: true,
    homeAlt: true,
  },
  groups3: {
    active: 'groups',
    icons: { profile: '2fa4b.svg', trips: 'e2721.svg', book: '47480.svg', groups: '4c5a4.svg', home: '1169e.svg' },
    groupsAlt: true,
    homeAlt2: true,
  },
  book: {
    active: 'book',
    icons: { profile: '2fa4b.svg', trips: 'e2721.svg', book: 'c92e8.svg', groups: '447b4.svg', home: 'cda7a.svg' },
    bookRotated: true,
    groupsAlt: true,
  },
  book2: {
    active: 'book',
    icons: { profile: '2fa4b.svg', trips: 'e2721.svg', book: 'c92e8.svg', groups: '447b4.svg', home: '1611f.svg' },
    bookRotated: true,
    groupsAlt: true,
  },
};

export const NAV_TABS = [
  { key: 'home', label: 'Home' },
  { key: 'book', label: 'Book' },
  { key: 'trips', label: 'My Trips' },
  { key: 'profile', label: 'Profile' },
  { key: 'groups', label: 'Travel Groups' },
];

// Where each tab leads. Tabs without a designed screen go to a placeholder.
export function navPath(key, groupId) {
  switch (key) {
    case 'book':
      return groupId ? `/groups/${groupId}/flights/search` : '/coming-soon/book';
    case 'groups':
      return '/groups';
    case 'trips':
      return '/coming-soon/my-trips';
    case 'profile':
      return '/coming-soon/profile';
    default:
      return '/coming-soon/home';
  }
}

// Design system v2.0 (real-app first). Home, Book, My trips and Profile follow the real app's
// icons (new files, redrawn from the screenshots: grey outline, teal filled when active).
// Travel Groups keeps the Cathay Together icon files. The older files above are untouched.
export const NAV_ICONS_V2 = {
  home: { off: 'nav-home.svg', on: 'nav-home-active.svg' },
  book: { off: 'nav-book.svg', on: 'nav-book-active.svg' },
  trips: { off: 'nav-trips.svg', on: 'nav-trips-active.svg' },
  profile: { off: 'nav-profile.svg', on: 'nav-profile-active.svg' },
  groups: { off: '447b4.svg', on: '5abd4.svg' },
};
export const NAV_LABELS_V2 = { home: 'Home', book: 'Book', trips: 'My trips', profile: 'Profile', groups: 'Travel Groups' };
