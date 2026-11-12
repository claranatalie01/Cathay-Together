import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isShared, notifyDataChanged } from '../../api';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import LoadingState from '../../components/ui/LoadingState';
import { useSession } from '../../hooks/useSession';

const REFRESH_MS = 5000;

// Wraps every screen that needs a signed-in person. A signed-out visitor is sent
// to the sign-in screen, which remembers where they were going (for example an
// invitation link) and returns them there afterwards.
// In mock mode everyone counts as signed in, so this does nothing.
export default function RequireSession() {
  const { status } = useSession();
  const { pathname, search } = useLocation();

  // With the shared backend other people change the data from their own phones. Every
  // 5 seconds, ask each screen to quietly re-read what it shows (useAsync does this without
  // a loading flash), so a new member appears without anyone reloading.
  useEffect(() => {
    if (!isShared || status !== 'signedIn') return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) notifyDataChanged();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [status]);

  if (status === 'loading') {
    return (
      <Screen>
        <StatusBar />
        <LoadingState />
      </Screen>
    );
  }
  if (status === 'signedOut') {
    return <Navigate to={`/sign-in?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <Outlet />;
}
