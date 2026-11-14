// How each flight-planning status is shown on a member row.
export const MEMBER_STATUS = {
  browsing: { label: 'Browsing', tone: 'neutral' },
  picked: { label: 'Picked', tone: 'primary' },
  booked: { label: 'Booked', tone: 'sand' },
  invited: { label: 'Invited', tone: 'tint' },
  // Itinerary preferences: explicitly finished or still picking.
  ready: { label: 'Ready', tone: 'tint' },
  choosing: { label: 'Still picking', tone: 'neutral' },
};
