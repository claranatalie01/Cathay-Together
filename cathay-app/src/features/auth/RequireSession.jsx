import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import LoadingState from '../../components/ui/LoadingState';
import { useSession } from '../../hooks/useSession';

// Wraps every screen that needs a signed-in person. A signed-out visitor is sent
// to the sign-in screen, which remembers where they were going (for example an
// invitation link) and returns them there afterwards.
// In mock mode everyone counts as signed in, so this does nothing.
export default function RequireSession() {
  const { status } = useSession();
  const { pathname, search } = useLocation();

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
