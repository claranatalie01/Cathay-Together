import { useEffect, useState } from 'react';
import { isShared, onSessionChanged } from '../api';

// Whether someone is signed in: 'loading', 'signedIn' or 'signedOut'.
// In mock mode there is no sign-in, so it is always 'signedIn'.
export function useSession() {
  const [session, setSession] = useState(isShared ? { status: 'loading', userId: null } : { status: 'signedIn', userId: 'mock' });

  useEffect(() => {
    if (!isShared) return undefined;
    return onSessionChanged((current) => {
      setSession(current ? { status: 'signedIn', userId: current.userId } : { status: 'signedOut', userId: null });
    });
  }, []);

  return session;
}
