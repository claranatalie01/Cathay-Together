import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useMatch } from 'react-router-dom';
import { notifyDataChanged } from '../../api';
import { watchTripPreferences } from '../../api/tripPreferenceUpdates';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import LoadingState from '../../components/ui/LoadingState';
import { useSession } from '../../hooks/useSession';

const REFRESH_MS = 5000;

// Wraps every screen that needs a signed-in person. A signed-out visitor is sent
// to the sign-in screen, which remembers where they were going (for example an
// invitation link) and returns them there afterwards.
export default function RequireSession() {
  const { status, userId } = useSession();
  const { pathname, search } = useLocation();
  const groupId = useMatch('/groups/:groupId/*')?.params.groupId;

  useEffect(() => watchTripPreferences(groupId, userId), [groupId, userId]);

  // Polling covers a disconnected socket and shared changes other than a save,
  // such as new members and flight picks. useAsync keeps the current view visible.
  useEffect(() => {
    if (status !== 'signedIn') return undefined;
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
