import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './Toast.css';

const ToastContext = createContext(() => {});

// Short confirmation message, announced politely to screen readers.
export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef();

  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 3500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && <p className="toast">{message}</p>}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
