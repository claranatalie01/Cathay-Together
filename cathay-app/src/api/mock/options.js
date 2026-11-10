// Switches for the mock backend (latency, forced failures). Stored separately
// from the data so they survive a data reset. Used by src/demo; the real
// backend does not need this file.
const KEY = 'cathay-mock-options-v1';
const DEFAULTS = { latencyMs: 250, failNext: false };

export function getMockOptions() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setMockOptions(patch) {
  const next = { ...getMockOptions(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: options simply do not persist.
  }
  return next;
}

// Returns true once if the next request should fail, then clears the flag.
export function consumeFailure() {
  const { failNext } = getMockOptions();
  if (failNext) setMockOptions({ failNext: false });
  return failNext;
}
