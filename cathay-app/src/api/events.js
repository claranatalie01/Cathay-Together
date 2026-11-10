// Tiny change bus. Mutations call notifyDataChanged(); screens that show data
// listen with onDataChanged() and quietly refetch. A real backend can keep
// using it (or swap it for polling / websockets).
const listeners = new Set();

export function onDataChanged(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function notifyDataChanged() {
  listeners.forEach((callback) => callback());
}
