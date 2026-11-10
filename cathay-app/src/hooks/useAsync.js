import { useCallback, useEffect, useRef, useState } from 'react';
import { onDataChanged } from '../api';

// Runs an async loader and tracks loading / success / error.
// - Re-runs when `deps` change (shows the loading state again).
// - Quietly refetches after any mutation (keeps showing the current data).
// - reload() is the "Retry" action.
export function useAsync(load, deps) {
  const [state, setState] = useState({ status: 'loading', data: undefined, error: null });
  const loadRef = useRef(load);
  loadRef.current = load;
  const runId = useRef(0);

  const run = useCallback((silent) => {
    const id = ++runId.current;
    if (!silent) setState({ status: 'loading', data: undefined, error: null });
    loadRef.current().then(
      (data) => {
        if (id === runId.current) setState({ status: 'success', data, error: null });
      },
      (error) => {
        if (id !== runId.current) return;
        // A failed background refresh keeps what is already on screen.
        setState((current) => (silent && current.status === 'success' ? current : { status: 'error', data: undefined, error }));
      },
    );
  }, []);

  useEffect(() => {
    run(false);
    return () => {
      runId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => onDataChanged(() => run(true)), [run]);

  return { ...state, reload: () => run(false) };
}
