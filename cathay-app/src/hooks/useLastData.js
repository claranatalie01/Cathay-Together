import { useEffect, useRef } from 'react';

// Keeps the last successful result of useAsync, so a page can keep showing it while the next
// one (another day, another cabin) loads instead of flashing a loading state.
export function useLastData(status, data) {
  const last = useRef(null);
  useEffect(() => {
    if (status === 'success') last.current = data;
  }, [status, data]);
  return status === 'success' ? data : status === 'loading' ? last.current : null;
}
