// Local mutations, polling and trip preference notifications all use this
// signal to quietly refetch the current screens.
const listeners = new Set();

export function onDataChanged(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function notifyDataChanged() {
  listeners.forEach((callback) => callback());
}
