// Small helpers shared by the flight pages.
export const cityName = (airport) => airport.city;
export const routeTitle = (route) => `${route.from.city} to ${route.to.city}`;
export const hkd = (amount) => `HKD${amount.toLocaleString('en-US')}`;
export const cabinSub = (cabin) => (cabin.delta ? `+${hkd(cabin.delta)}` : null);

// 75 -> "1h 15m", 45 -> "45m", 120 -> "2h"
export const formatGap = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};
