import { useEffect, useState } from 'react';
import { onSessionChanged } from '../api';

// Whether someone is signed in: 'loading', 'signedIn' or 'signedOut'.
export function useSession() {
  const [session, setSession] = useState({ status: 'loading', userId: null });

  useEffect(() => {
    return onSessionChanged((current) => {
      setSession(current ? { status: 'signedIn', userId: current.userId } : { status: 'signedOut', userId: null });
    });
  }, []);

  return session;
}
