import { useCallback, useState } from 'react';

const KEY = 'cathay-demo-ui-v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY))?.visible !== false;
  } catch {
    return true;
  }
}

// Whether the demo panel is shown. Remembered between visits.
export function useDemoVisibility() {
  const [visible, setVisible] = useState(read);
  const update = useCallback((next) => {
    setVisible(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ visible: next }));
    } catch {
      // Not persisted.
    }
  }, []);
  return [visible, update];
}
